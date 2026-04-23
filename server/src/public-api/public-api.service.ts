import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatType, MemberRole, MessageStatus, MessageType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';
import { NotificationService } from '../notification/notification.service';
import { UploadService } from '../upload/upload.service';
import { phoneLookupCandidates } from './utils/phone.util';
import { PublicApiCaller } from './guards/api-key.guard';

const ALLOWED_VOICE_MIMES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
  'audio/webm',
]);

@Injectable()
export class PublicApiService {
  private readonly logger = new Logger(PublicApiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
    private readonly notificationService: NotificationService,
    private readonly uploadService: UploadService,
    private readonly configService: ConfigService,
  ) {}

  // ─────────────────────────── Text ───────────────────────────

  async sendTextMessage(
    caller: PublicApiCaller,
    phone: string,
    content: string,
    externalId?: string,
  ) {
    if (!caller.canSendText) {
      throw new ForbiddenException('API key does not have permission to send text messages');
    }

    const trimmed = (content ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException('Message content cannot be empty');
    }

    const recipient = await this.resolveRecipient(phone);
    const chat = await this.getOrCreatePrivateChat(caller.owner.id, recipient.id);

    const message = await this.createMessageAndBroadcast({
      chatId: chat.id,
      senderId: caller.owner.id,
      recipientId: recipient.id,
      type: MessageType.TEXT,
      data: { content: trimmed },
    });

    this.logger.log(
      `[public-api] text → user=${recipient.id} key=${caller.keyPrefix} msg=${message.id}`,
    );

    return {
      success: true,
      message: 'Message sent successfully',
      data: {
        messageId: message.id,
        chatId: chat.id,
        type: message.type,
        recipient: {
          id: recipient.id,
          name: recipient.name,
          phone: recipient.phone,
          countryCode: recipient.countryCode,
        },
        externalId: externalId ?? null,
        createdAt: message.createdAt,
      },
    };
  }

  // ─────────────────────────── Voice ───────────────────────────

  async sendVoiceMessage(
    caller: PublicApiCaller,
    phone: string,
    file: Express.Multer.File,
    duration?: number,
    externalId?: string,
  ) {
    if (!caller.canSendVoice) {
      throw new ForbiddenException('API key does not have permission to send voice messages');
    }

    if (!file) {
      throw new BadRequestException('Voice file is required (multipart field "voice")');
    }

    if (!ALLOWED_VOICE_MIMES.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported audio format "${file.mimetype}". Use mp3, m4a, wav, aac, ogg or webm.`,
      );
    }

    const recipient = await this.resolveRecipient(phone);

    // Persist the file first so we can reject early on storage failure,
    // before any DB writes are made.
    const uploaded = await this.uploadService.uploadFile(file, 'public-api');

    const chat = await this.getOrCreatePrivateChat(caller.owner.id, recipient.id);

    const message = await this.createMessageAndBroadcast({
      chatId: chat.id,
      senderId: caller.owner.id,
      recipientId: recipient.id,
      type: MessageType.AUDIO,
      data: {
        mediaUrl: uploaded.url,
        mediaType: file.mimetype,
        mediaDuration: Number.isFinite(duration) ? Math.max(0, Math.round(duration!)) : undefined,
        fileName: file.originalname,
        fileSize: file.size,
      },
    });

    this.logger.log(
      `[public-api] voice → user=${recipient.id} key=${caller.keyPrefix} msg=${message.id} file=${uploaded.filename}`,
    );

    return {
      success: true,
      message: 'Message sent successfully',
      data: {
        messageId: message.id,
        chatId: chat.id,
        type: message.type,
        mediaUrl: uploaded.url,
        recipient: {
          id: recipient.id,
          name: recipient.name,
          phone: recipient.phone,
          countryCode: recipient.countryCode,
        },
        externalId: externalId ?? null,
        createdAt: message.createdAt,
      },
    };
  }

  // ─────────────────────────── Internals ───────────────────────────

  private async resolveRecipient(phoneRaw: string) {
    if (!phoneRaw || typeof phoneRaw !== 'string') {
      throw new BadRequestException('phone is required');
    }

    const candidates = phoneLookupCandidates(phoneRaw);
    if (candidates.length === 0) {
      throw new BadRequestException('Invalid phone number format');
    }

    const user = await this.prisma.user.findFirst({
      where: { phone: { in: candidates } },
      select: {
        id: true,
        name: true,
        phone: true,
        countryCode: true,
        fcmToken: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User with this phoneNumber does not exists!');
    }

    return user;
  }

  private async getOrCreatePrivateChat(senderId: string, recipientId: string) {
    if (senderId === recipientId) {
      throw new BadRequestException('API key owner cannot message themselves');
    }

    const existing = await this.prisma.chat.findFirst({
      where: {
        type: ChatType.PRIVATE,
        AND: [
          { members: { some: { userId: senderId } } },
          { members: { some: { userId: recipientId } } },
        ],
      },
      select: { id: true },
    });

    if (existing) return existing;

    return this.prisma.chat.create({
      data: {
        type: ChatType.PRIVATE,
        members: {
          create: [
            { userId: senderId, role: MemberRole.MEMBER },
            { userId: recipientId, role: MemberRole.MEMBER },
          ],
        },
      },
      select: { id: true },
    });
  }

  /**
   * Shared write path for text + voice messages. Persists the Message row,
   * bumps the chat's updatedAt, increments the recipient's unread counter,
   * then hands the fully-hydrated message to ChatGateway so the socket /
   * FCM fallout matches exactly what an in-app send would produce.
   */
  private async createMessageAndBroadcast(args: {
    chatId: string;
    senderId: string;
    recipientId: string;
    type: MessageType;
    data: {
      content?: string;
      mediaUrl?: string;
      mediaType?: string;
      mediaDuration?: number;
      fileName?: string;
      fileSize?: number;
    };
  }) {
    const message = await this.prisma.message.create({
      data: {
        chatId: args.chatId,
        senderId: args.senderId,
        type: args.type,
        content: args.data.content,
        mediaUrl: args.data.mediaUrl,
        mediaType: args.data.mediaType,
        mediaDuration: args.data.mediaDuration,
        fileName: args.data.fileName,
        fileSize: args.data.fileSize,
        status: MessageStatus.SENT,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            type: true,
            sender: { select: { id: true, name: true } },
          },
        },
      },
    });

    await this.prisma.chat.update({
      where: { id: args.chatId },
      data: { updatedAt: new Date() },
    });

    await this.prisma.chatMember.updateMany({
      where: { chatId: args.chatId, userId: args.recipientId, leftAt: null },
      data: { unreadCount: { increment: 1 }, isHidden: false },
    });

    await this.deliverToRecipient({
      message,
      chatId: args.chatId,
      senderId: args.senderId,
      recipientId: args.recipientId,
    });

    return message;
  }

  private async deliverToRecipient(args: {
    message: any;
    chatId: string;
    senderId: string;
    recipientId: string;
  }) {
    const { message, chatId, recipientId, senderId } = args;

    // Socket fan-out — the chat/[id].tsx screen listens for `new_message`
    // on both the personal user_<id> room and the chat_<id> room. This
    // reuses the same path the in-app socket gateway takes so no client
    // changes are needed.
    const server = (this.chatGateway as any).server;
    if (server) {
      server.to(`chat_${chatId}`).emit('new_message', message);
      server.to(`user_${recipientId}`).emit('new_message', message);
    }

    // FCM fallback when the recipient isn't connected.
    if (!this.chatGateway.isUserOnline(recipientId)) {
      try {
        const sender = await this.notificationService.getUserWithDetails(senderId);
        const preview = this.notificationService.getMessagePreview(
          message.type,
          message.content ?? undefined,
        );
        await this.notificationService.sendMessageNotification(
          recipientId,
          sender?.name || 'New message',
          preview,
          chatId,
          senderId,
          'PRIVATE',
        );
      } catch (err: any) {
        this.logger.warn(`[public-api] FCM fallback failed: ${err.message}`);
      }
    }
  }
}

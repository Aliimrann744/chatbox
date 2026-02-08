import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChatDto, SendMessageDto } from './dto';
import { ChatType, MessageStatus, MemberRole } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  // ==================== CHAT OPERATIONS ====================

  async createPrivateChat(userId: string, participantId: string) {
    // Prevent chatting with yourself
    if (userId === participantId) {
      throw new BadRequestException('Cannot create a chat with yourself');
    }

    // Check if chat already exists between these users
    const existingChat = await this.prisma.chat.findFirst({
      where: {
        type: ChatType.PRIVATE,
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: participantId } } },
        ],
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
                about: true,
                isOnline: true,
                lastSeen: true,
              },
            },
          },
        },
      },
    });

    if (existingChat) {
      return existingChat;
    }

    // Check if participant exists
    const participant = await this.prisma.user.findUnique({
      where: { id: participantId },
    });

    if (!participant) {
      throw new NotFoundException('User not found');
    }

    // Check if blocked
    const isBlocked = await this.isBlocked(userId, participantId);
    if (isBlocked) {
      throw new ForbiddenException('Cannot create chat with this user');
    }

    // Create new chat
    const chat = await this.prisma.chat.create({
      data: {
        type: ChatType.PRIVATE,
        members: {
          create: [
            { userId, role: MemberRole.MEMBER },
            { userId: participantId, role: MemberRole.MEMBER },
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
                about: true,
                isOnline: true,
                lastSeen: true,
              },
            },
          },
        },
      },
    });

    return chat;
  }

  async createGroupChat(
    userId: string,
    name: string,
    participantIds: string[],
    description?: string,
    avatar?: string,
  ) {
    // Ensure creator is included
    const allMembers = [...new Set([userId, ...participantIds])];

    // Verify all participants exist
    const users = await this.prisma.user.findMany({
      where: { id: { in: allMembers } },
    });

    if (users.length !== allMembers.length) {
      throw new BadRequestException('One or more users not found');
    }

    // Create group chat
    const chat = await this.prisma.chat.create({
      data: {
        type: ChatType.GROUP,
        name,
        description,
        avatar,
        creatorId: userId,
        members: {
          create: allMembers.map((memberId) => ({
            userId: memberId,
            role: memberId === userId ? MemberRole.ADMIN : MemberRole.MEMBER,
          })),
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
                about: true,
                isOnline: true,
                lastSeen: true,
              },
            },
          },
        },
      },
    });

    return chat;
  }

  async getUserChats(userId: string) {
    const chats = await this.prisma.chat.findMany({
      where: {
        members: {
          some: {
            userId,
            leftAt: null,
          },
        },
      },
      include: {
        members: {
          where: { leftAt: null },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
                isOnline: true,
                lastSeen: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Format response with last message and unread count
    return Promise.all(
      chats.map(async (chat) => {
        const currentMember = chat.members.find((m) => m.userId === userId);
        const otherMembers = chat.members.filter((m) => m.userId !== userId);

        // For private chats, use the other user's info as chat info
        const chatInfo =
          chat.type === ChatType.PRIVATE && otherMembers.length > 0
            ? {
                name: otherMembers[0].user.name,
                avatar: otherMembers[0].user.avatar,
                isOnline: otherMembers[0].user.isOnline,
                lastSeen: otherMembers[0].user.lastSeen,
              }
            : {
                name: chat.name,
                avatar: chat.avatar,
              };

        return {
          id: chat.id,
          type: chat.type,
          ...chatInfo,
          description: chat.description,
          lastMessage: chat.messages[0] || null,
          unreadCount: currentMember?.unreadCount || 0,
          isPinned: currentMember?.isPinned || false,
          isMuted: currentMember?.isMuted || false,
          members: chat.members,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        };
      }),
    );
  }

  async getChatById(chatId: string, userId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
          where: { leftAt: null },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
                about: true,
                isOnline: true,
                lastSeen: true,
              },
            },
          },
        },
      },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // Verify user is a member
    const isMember = chat.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this chat');
    }

    return chat;
  }

  // ==================== MESSAGE OPERATIONS ====================

  async createMessage(senderId: string, dto: SendMessageDto) {
    // Verify user is a member of the chat
    const membership = await this.prisma.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: dto.chatId,
          userId: senderId,
        },
      },
    });

    if (!membership || membership.leftAt) {
      throw new ForbiddenException('You are not a member of this chat');
    }

    // Create message
    const message = await this.prisma.message.create({
      data: {
        chatId: dto.chatId,
        senderId,
        type: dto.type,
        content: dto.content,
        mediaUrl: dto.mediaUrl,
        mediaType: dto.mediaType,
        mediaDuration: dto.mediaDuration,
        thumbnail: dto.thumbnail,
        fileName: dto.fileName,
        fileSize: dto.fileSize,
        latitude: dto.latitude,
        longitude: dto.longitude,
        locationName: dto.locationName,
        replyToId: dto.replyToId,
        isForwarded: dto.isForwarded || false,
        status: MessageStatus.SENT,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            type: true,
            sender: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Update chat's updatedAt
    await this.prisma.chat.update({
      where: { id: dto.chatId },
      data: { updatedAt: new Date() },
    });

    // Increment unread count for other members
    await this.prisma.chatMember.updateMany({
      where: {
        chatId: dto.chatId,
        userId: { not: senderId },
        leftAt: null,
      },
      data: {
        unreadCount: { increment: 1 },
      },
    });

    return message;
  }

  async getChatMessages(
    chatId: string,
    userId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    // Verify user is a member
    const membership = await this.prisma.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
    });

    if (!membership || membership.leftAt) {
      throw new ForbiddenException('You are not a member of this chat');
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: {
          chatId,
          deletedAt: null,
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          replyTo: {
            select: {
              id: true,
              content: true,
              type: true,
              sender: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          readReceipts: {
            select: {
              userId: true,
              readAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.message.count({
        where: {
          chatId,
          deletedAt: null,
        },
      }),
    ]);

    return {
      messages: messages.reverse(), // Return in chronological order
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + messages.length < total,
      },
    };
  }

  async updateMessageStatus(
    messageId: string,
    status: MessageStatus,
    userId?: string,
  ) {
    const message = await this.prisma.message.update({
      where: { id: messageId },
      data: { status },
    });

    // If read, create read receipt
    if (status === MessageStatus.READ && userId) {
      await this.prisma.messageReadReceipt.upsert({
        where: {
          messageId_userId: {
            messageId,
            userId,
          },
        },
        create: {
          messageId,
          userId,
        },
        update: {
          readAt: new Date(),
        },
      });
    }

    return message;
  }

  async markMessagesAsRead(chatId: string, userId: string) {
    // Get all unread messages in this chat not sent by user
    const unreadMessages = await this.prisma.message.findMany({
      where: {
        chatId,
        senderId: { not: userId },
        status: { not: MessageStatus.READ },
      },
      select: { id: true, senderId: true },
    });

    if (unreadMessages.length === 0) return [];

    // Update message statuses
    await this.prisma.message.updateMany({
      where: {
        id: { in: unreadMessages.map((m) => m.id) },
      },
      data: { status: MessageStatus.READ },
    });

    // Create read receipts
    await this.prisma.messageReadReceipt.createMany({
      data: unreadMessages.map((m) => ({
        messageId: m.id,
        userId,
      })),
      skipDuplicates: true,
    });

    // Reset unread count
    await this.prisma.chatMember.update({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
      data: { unreadCount: 0, lastReadAt: new Date() },
    });

    return unreadMessages;
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    // Soft delete
    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  // ==================== HELPER METHODS ====================

  async getChatMembers(chatId: string) {
    return this.prisma.chatMember.findMany({
      where: {
        chatId,
        leftAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            fcmToken: true,
          },
        },
      },
    });
  }

  async setUserOnline(userId: string, isOnline: boolean) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isOnline,
        lastSeen: isOnline ? undefined : new Date(),
      },
    });
  }

  async getUserContacts(userId: string) {
    return this.prisma.contact.findMany({
      where: { userId },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            avatar: true,
            isOnline: true,
            lastSeen: true,
          },
        },
      },
    });
  }

  async isBlocked(userId: string, targetId: string): Promise<boolean> {
    const blocked = await this.prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: targetId },
          { blockerId: targetId, blockedId: userId },
        ],
      },
    });
    return !!blocked;
  }

  async getMessage(messageId: string) {
    return this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async pinChat(chatId: string, userId: string, isPinned: boolean) {
    await this.prisma.chatMember.update({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
      data: { isPinned },
    });
    return { success: true };
  }

  async muteChat(
    chatId: string,
    userId: string,
    isMuted: boolean,
    muteUntil?: Date,
  ) {
    await this.prisma.chatMember.update({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
      data: { isMuted, muteUntil },
    });
    return { success: true };
  }
}

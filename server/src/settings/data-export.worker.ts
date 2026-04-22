import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../auth/mail.service';

const MAX_MESSAGES_PER_EXPORT = 500;

@Injectable()
export class DataExportWorker implements OnModuleInit {
  private readonly logger = new Logger(DataExportWorker.name);
  private running = false;

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  onModuleInit() {
    // Kick off once on startup in case any requests were left RUNNING by a
    // previous crash or left PENDING while the server was down.
    setImmediate(() => this.reset());
    setImmediate(() => this.tick());
  }

  private async reset() {
    try {
      await this.prisma.dataExportRequest.updateMany({
        where: { status: 'RUNNING' },
        data: { status: 'PENDING', startedAt: null },
      });
    } catch (err: any) {
      this.logger.warn(`[DataExport] reset failed: ${err.message}`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      // Claim oldest PENDING request, process one per tick to avoid flooding SMTP.
      const next = await this.prisma.dataExportRequest.findFirst({
        where: { status: 'PENDING' },
        orderBy: { requestedAt: 'asc' },
      });
      if (!next) return;

      await this.prisma.dataExportRequest.update({
        where: { id: next.id },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      try {
        const result = await this.buildAndSend(next.userId);
        await this.prisma.dataExportRequest.update({
          where: { id: next.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            bytes: result.bytes,
            sentTo: result.sentTo,
          },
        });
      } catch (err: any) {
        this.logger.error(`[DataExport] job ${next.id} failed: ${err.message}`);
        await this.prisma.dataExportRequest.update({
          where: { id: next.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            error: (err?.message || 'Unknown error').slice(0, 500),
          },
        });
      }
    } finally {
      this.running = false;
    }
  }

  private async buildAndSend(userId: string): Promise<{ bytes: number; sentTo: string | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        countryCode: true,
        name: true,
        about: true,
        avatar: true,
        language: true,
        lastSeenPrivacy: true,
        avatarPrivacy: true,
        aboutPrivacy: true,
        readReceiptsEnabled: true,
        twoFactorEnabled: true,
        twoFactorMethod: true,
        securityNotificationsEnabled: true,
        createdAt: true,
        contacts: {
          select: {
            nickname: true,
            createdAt: true,
            contact: { select: { id: true, name: true, phone: true, email: true } },
          },
        },
        chatMembers: {
          select: {
            role: true,
            joinedAt: true,
            isArchived: true,
            isFavorite: true,
            isPinned: true,
            chat: { select: { id: true, type: true, name: true, createdAt: true } },
          },
        },
        messages: {
          take: MAX_MESSAGES_PER_EXPORT,
          orderBy: { createdAt: 'desc' },
          select: { id: true, chatId: true, type: true, content: true, createdAt: true },
        },
      },
    });

    if (!user) throw new Error('User not found');

    const payload = { exportedAt: new Date().toISOString(), user };
    const json = JSON.stringify(payload, null, 2);
    const bytes = Buffer.byteLength(json, 'utf8');

    if (user.email) {
      await this.mailService.sendDataExportEmail(user.email, json);
      return { bytes, sentTo: user.email };
    }
    return { bytes, sentTo: null };
  }
}

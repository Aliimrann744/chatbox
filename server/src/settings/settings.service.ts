import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../auth/mail.service';
import { PrivacySetting } from '@prisma/client';

const EMAIL_CHANGE_OTP_MIN = 10;
const DELETION_GRACE_DAYS = 30;

function randomOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async getPrivacySettings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        lastSeenPrivacy: true,
        avatarPrivacy: true,
        aboutPrivacy: true,
        readReceiptsEnabled: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updatePrivacySettings(
    userId: string,
    settings: {
      lastSeenPrivacy?: PrivacySetting;
      avatarPrivacy?: PrivacySetting;
      aboutPrivacy?: PrivacySetting;
      readReceiptsEnabled?: boolean;
    },
  ) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: settings,
      select: {
        lastSeenPrivacy: true,
        avatarPrivacy: true,
        aboutPrivacy: true,
        readReceiptsEnabled: true,
      },
    });

    return user;
  }

  async updateFcmToken(userId: string, fcmToken: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
    });

    return { success: true };
  }

  async removeFcmToken(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken: null },
    });

    return { success: true };
  }

  async updateProfile(
    userId: string,
    data: {
      name?: string;
      about?: string;
      avatar?: string;
    },
  ) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        about: true,
      },
    });

    return user;
  }

  async deleteAccount(userId: string) {
    // Immediate hard delete — cascades via Prisma relations
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { success: true };
  }

  // ===== Preferences =====
  async setLanguage(userId: string, language: string) {
    const normalized = (language || 'en').trim().toLowerCase();
    await this.prisma.user.update({
      where: { id: userId },
      data: { language: normalized },
    });
    return { success: true, language: normalized };
  }

  // ===== Security notifications =====
  async setSecurityNotifications(userId: string, enabled: boolean) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { securityNotificationsEnabled: enabled },
    });
    return { success: true, enabled };
  }

  async getLoginEvents(userId: string, limit = 20) {
    const events = await this.prisma.loginEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return { events };
  }

  // ===== Email change =====
  async requestEmailChange(userId: string, newEmail: string) {
    const email = (newEmail || '').trim().toLowerCase();
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      throw new BadRequestException('Enter a valid email address');
    }
    const conflict = await this.prisma.user.findUnique({ where: { email } });
    if (conflict && conflict.id !== userId) {
      throw new BadRequestException('This email is already in use');
    }

    const otp = randomOtp();
    const expiry = new Date(Date.now() + EMAIL_CHANGE_OTP_MIN * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        pendingEmail: email,
        pendingEmailOtp: otp,
        pendingEmailOtpExpiry: expiry,
      },
    });

    await this.mailService.sendEmailChangeOtp(email, otp);

    return {
      message: `A verification code was sent to ${email}.`,
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
    };
  }

  async verifyEmailChange(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.pendingEmail || !user.pendingEmailOtp) {
      throw new BadRequestException('No email change in progress');
    }
    if (!user.pendingEmailOtpExpiry || new Date() > user.pendingEmailOtpExpiry) {
      throw new BadRequestException('Verification code expired');
    }
    if (user.pendingEmailOtp !== code) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: user.pendingEmail,
        pendingEmail: null,
        pendingEmailOtp: null,
        pendingEmailOtpExpiry: null,
      },
    });

    return { success: true, email: user.pendingEmail };
  }

  // ===== Deactivation =====
  async deactivateAccount(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deactivatedAt: new Date(),
        isOnline: false,
        refreshToken: null,
      },
    });
    return { success: true };
  }

  async reactivateAccount(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { deactivatedAt: null },
    });
    return { success: true };
  }

  // ===== Scheduled deletion =====
  async scheduleDeletion(userId: string) {
    const when = new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        scheduledDeletionAt: when,
        deactivatedAt: new Date(),
      },
    });
    if (user.email) {
      try {
        await this.mailService.sendAccountDeletionScheduledEmail(user.email, when);
      } catch {}
    }
    return { success: true, scheduledDeletionAt: when };
  }

  async cancelScheduledDeletion(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { scheduledDeletionAt: null, deactivatedAt: null },
    });
    return { success: true };
  }

  // ===== Data export (async queue) =====
  async enqueueDataExport(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.email) {
      throw new BadRequestException('Add an email to your account before requesting a data export.');
    }

    const pending = await this.prisma.dataExportRequest.findFirst({
      where: { userId, status: { in: ['PENDING', 'RUNNING'] } },
    });
    if (pending) {
      return {
        success: true,
        alreadyQueued: true,
        requestId: pending.id,
        status: pending.status,
      };
    }

    const request = await this.prisma.dataExportRequest.create({
      data: { userId, status: 'PENDING' },
    });

    return {
      success: true,
      alreadyQueued: false,
      requestId: request.id,
      status: request.status,
    };
  }

  async listDataExports(userId: string, limit = 10) {
    const requests = await this.prisma.dataExportRequest.findMany({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
      select: {
        id: true,
        status: true,
        bytes: true,
        error: true,
        requestedAt: true,
        startedAt: true,
        completedAt: true,
        sentTo: true,
      },
    });
    return { requests };
  }
}

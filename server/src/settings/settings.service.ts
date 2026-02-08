import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrivacySetting } from '@prisma/client';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

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
    // Delete user and all related data (cascade)
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { success: true };
  }
}

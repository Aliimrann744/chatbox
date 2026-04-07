import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Post,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { NotificationService } from '../notification/notification.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrivacySetting } from '@prisma/client';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly notificationService: NotificationService,
  ) {}

  @Get('privacy')
  async getPrivacySettings(@CurrentUser() user: any) {
    return this.settingsService.getPrivacySettings(user.id);
  }

  @Put('privacy')
  async updatePrivacySettings(
    @CurrentUser() user: any,
    @Body()
    body: {
      lastSeenPrivacy?: PrivacySetting;
      avatarPrivacy?: PrivacySetting;
      aboutPrivacy?: PrivacySetting;
      readReceiptsEnabled?: boolean;
    },
  ) {
    return this.settingsService.updatePrivacySettings(user.id, body);
  }

  @Put('fcm-token')
  async updateFcmToken(
    @CurrentUser() user: any,
    @Body() body: { fcmToken: string },
  ) {
    return this.settingsService.updateFcmToken(user.id, body.fcmToken);
  }

  @Delete('fcm-token')
  async removeFcmToken(@CurrentUser() user: any) {
    return this.settingsService.removeFcmToken(user.id);
  }

  @Put('profile')
  async updateProfile(
    @CurrentUser() user: any,
    @Body() body: { name?: string; about?: string; avatar?: string },
  ) {
    return this.settingsService.updateProfile(user.id, body);
  }

  @Delete('account')
  async deleteAccount(@CurrentUser() user: any) {
    return this.settingsService.deleteAccount(user.id);
  }

  // Test endpoint: sends a test push notification to the current user's device
  @Post('test-notification')
  async testNotification(@CurrentUser() user: any) {
    try {
      await this.notificationService.sendSystemNotification(
        user.id,
        'Test Notification',
        'If you see this, FCM push notifications are working!',
        { type: 'system' },
      );
      return { success: true, message: 'Test notification sent. Check your device.' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Test endpoint: sends a test call notification to the current user's device
  @Post('test-call-notification')
  async testCallNotification(@CurrentUser() user: any) {
    try {
      await this.notificationService.sendCallNotification(
        user.id,
        'Test Caller',
        null,
        'test-call-id',
        'test-caller-id',
        'VOICE',
      );
      return { success: true, message: 'Test call notification sent. Check your device.' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

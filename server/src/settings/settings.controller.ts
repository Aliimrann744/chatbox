import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Post,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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

  // ===== Language =====
  @Put('language')
  async setLanguage(
    @CurrentUser() user: any,
    @Body() body: { language: string },
  ) {
    return this.settingsService.setLanguage(user.id, body.language);
  }

  // ===== Security notifications =====
  @Put('security-notifications')
  async setSecurityNotifications(
    @CurrentUser() user: any,
    @Body() body: { enabled: boolean },
  ) {
    return this.settingsService.setSecurityNotifications(user.id, !!body.enabled);
  }

  @Get('login-events')
  async getLoginEvents(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? parseInt(limit, 10) : 20;
    return this.settingsService.getLoginEvents(user.id, Number.isFinite(n) ? n : 20);
  }

  // ===== Email change =====
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('change-email/request')
  @HttpCode(HttpStatus.OK)
  async requestEmailChange(
    @CurrentUser() user: any,
    @Body() body: { email: string },
  ) {
    return this.settingsService.requestEmailChange(user.id, body.email);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('change-email/verify')
  @HttpCode(HttpStatus.OK)
  async verifyEmailChange(
    @CurrentUser() user: any,
    @Body() body: { code: string },
  ) {
    return this.settingsService.verifyEmailChange(user.id, body.code);
  }

  // ===== Deactivate / Reactivate =====
  @Post('account/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(@CurrentUser() user: any) {
    return this.settingsService.deactivateAccount(user.id);
  }

  @Post('account/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivate(@CurrentUser() user: any) {
    return this.settingsService.reactivateAccount(user.id);
  }

  // ===== Scheduled deletion (30-day grace) =====
  @Post('account/schedule-deletion')
  @HttpCode(HttpStatus.OK)
  async scheduleDeletion(@CurrentUser() user: any) {
    return this.settingsService.scheduleDeletion(user.id);
  }

  @Post('account/cancel-deletion')
  @HttpCode(HttpStatus.OK)
  async cancelDeletion(@CurrentUser() user: any) {
    return this.settingsService.cancelScheduledDeletion(user.id);
  }

  @Delete('account')
  async deleteAccount(@CurrentUser() user: any) {
    return this.settingsService.deleteAccount(user.id);
  }

  // ===== Data export (queued) =====
  @Throttle({ default: { ttl: 60 * 60 * 1000, limit: 3 } })
  @Post('request-data')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestData(@CurrentUser() user: any) {
    return this.settingsService.enqueueDataExport(user.id);
  }

  @Get('data-exports')
  async listDataExports(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? parseInt(limit, 10) : 10;
    return this.settingsService.listDataExports(user.id, Number.isFinite(n) ? n : 10);
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

import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Post,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrivacySetting } from '@prisma/client';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

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
}

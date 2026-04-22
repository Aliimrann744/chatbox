import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TwoFactorService } from './two-factor.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('2fa')
export class TwoFactorController {
  constructor(private readonly twoFactor: TwoFactorService) {}

  @Get('status')
  async getStatus(@CurrentUser() user: any) {
    return this.twoFactor.getStatus(user.id);
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('setup/totp')
  @HttpCode(HttpStatus.OK)
  async setupTotp(@CurrentUser() user: any) {
    return this.twoFactor.setupTotp(user.id);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('setup/totp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyTotpSetup(@CurrentUser() user: any, @Body() body: { code: string }) {
    return this.twoFactor.verifyTotpSetup(user.id, body.code);
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('setup/email')
  @HttpCode(HttpStatus.OK)
  async enableEmailOtp(@CurrentUser() user: any) {
    return this.twoFactor.enableEmailOtp(user.id);
  }

  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('disable/request')
  @HttpCode(HttpStatus.OK)
  async requestDisable(@CurrentUser() user: any) {
    return this.twoFactor.requestDisable(user.id);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('disable/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmDisable(@CurrentUser() user: any, @Body() body: { code: string }) {
    return this.twoFactor.confirmDisable(user.id, body.code);
  }

  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('backup-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  async regenerateBackupCodes(@CurrentUser() user: any) {
    return this.twoFactor.regenerateBackupCodes(user.id);
  }
}

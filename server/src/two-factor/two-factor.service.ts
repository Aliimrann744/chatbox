import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../auth/mail.service';
import { encryptSecret, decryptSecret } from '../common/crypto.util';

const BACKUP_CODE_COUNT = 10;
const DISABLE_OTP_EXPIRY_MIN = 10;

type BackupCodeRecord = { hash: string; used: boolean };

@Injectable()
export class TwoFactorService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private configService: ConfigService,
  ) {
    authenticator.options = { window: 1, step: 30 };
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
      codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
    }
    return codes;
  }

  private async hashBackupCodes(codes: string[]): Promise<BackupCodeRecord[]> {
    return Promise.all(
      codes.map(async (c) => ({ hash: await bcrypt.hash(c, 10), used: false })),
    );
  }

  private parseBackupCodes(raw?: string | null): BackupCodeRecord[] {
    if (!raw) return [];
    try {
      return JSON.parse(raw) as BackupCodeRecord[];
    } catch {
      return [];
    }
  }

  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, twoFactorMethod: true, twoFactorBackupCodes: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const codes = this.parseBackupCodes(user.twoFactorBackupCodes);
    const remaining = codes.filter((c) => !c.used).length;
    return {
      enabled: user.twoFactorEnabled,
      method: user.twoFactorMethod,
      backupCodesRemaining: remaining,
    };
  }

  async setupTotp(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.twoFactorEnabled && user.twoFactorMethod === 'TOTP') {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }

    const secret = authenticator.generateSecret();
    const accountLabel = user.email || user.phone || user.id;
    const issuer = this.configService.get<string>('APP_NAME') || 'Whatchat';
    const otpauth = authenticator.keyuri(accountLabel, issuer, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauth);

    // Store the encrypted secret temporarily (unverified). It will only be
    // activated once the user verifies a code from their authenticator.
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: encryptSecret(secret),
        twoFactorEnabled: false,
        twoFactorMethod: 'NONE',
      },
    });

    return { secret, otpauth, qrDataUrl };
  }

  async verifyTotpSetup(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('Start 2FA setup first');
    }

    const secret = decryptSecret(user.twoFactorSecret);
    const ok = authenticator.check(code, secret);
    if (!ok) throw new BadRequestException('Invalid verification code');

    const plainCodes = this.generateBackupCodes();
    const hashedCodes = await this.hashBackupCodes(plainCodes);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorMethod: 'TOTP',
        twoFactorBackupCodes: JSON.stringify(hashedCodes),
      },
    });

    return {
      enabled: true,
      method: 'TOTP',
      backupCodes: plainCodes,
    };
  }

  async enableEmailOtp(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.email) {
      throw new BadRequestException('Add an email to your account before enabling email 2FA');
    }

    const plainCodes = this.generateBackupCodes();
    const hashedCodes = await this.hashBackupCodes(plainCodes);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorMethod: 'EMAIL',
        twoFactorSecret: null,
        twoFactorBackupCodes: JSON.stringify(hashedCodes),
      },
    });

    return { enabled: true, method: 'EMAIL', backupCodes: plainCodes };
  }

  async requestDisable(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }
    if (!user.email) {
      throw new BadRequestException('Cannot send disable OTP: no email on file');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + DISABLE_OTP_EXPIRY_MIN * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: { otp, otpExpiry: expiry },
    });

    await this.mailService.send2faDisableEmail(user.email, otp);

    return {
      message: 'A verification code was sent to your registered email address.',
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
    };
  }

  async confirmDisable(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.otp || !user.otpExpiry) {
      throw new BadRequestException('No disable request in progress');
    }
    if (new Date() > user.otpExpiry) {
      throw new BadRequestException('Verification code expired');
    }
    if (user.otp !== code) throw new BadRequestException('Invalid verification code');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorMethod: 'NONE',
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
        otp: null,
        otpExpiry: null,
      },
    });

    return { disabled: true };
  }

  async regenerateBackupCodes(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }
    const plainCodes = this.generateBackupCodes();
    const hashedCodes = await this.hashBackupCodes(plainCodes);
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorBackupCodes: JSON.stringify(hashedCodes) },
    });
    return { backupCodes: plainCodes };
  }

  async verifyTotpCode(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorEnabled || user.twoFactorMethod !== 'TOTP') return false;
    if (!user.twoFactorSecret) return false;
    const secret = decryptSecret(user.twoFactorSecret);
    return authenticator.check(code, secret);
  }

  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorEnabled) return false;

    const records = this.parseBackupCodes(user.twoFactorBackupCodes);
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (record.used) continue;
      const match = await bcrypt.compare(code, record.hash);
      if (match) {
        records[i] = { ...record, used: true };
        await this.prisma.user.update({
          where: { id: userId },
          data: { twoFactorBackupCodes: JSON.stringify(records) },
        });
        return true;
      }
    }
    return false;
  }

  async sendEmailLoginOtp(userId: string): Promise<{ expiresAt: Date }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.email) {
      throw new BadRequestException('Cannot send 2FA code: no email on file');
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + DISABLE_OTP_EXPIRY_MIN * 60 * 1000);
    await this.prisma.user.update({
      where: { id: userId },
      data: { otp, otpExpiry: expiresAt },
    });
    await this.mailService.send2faLoginEmail(user.email, otp);
    return { expiresAt };
  }

  async verifyEmailLoginOtp(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorEnabled || user.twoFactorMethod !== 'EMAIL') return false;
    if (!user.otp || !user.otpExpiry) return false;
    if (new Date() > user.otpExpiry) return false;
    if (user.otp !== code) return false;
    await this.prisma.user.update({
      where: { id: userId },
      data: { otp: null, otpExpiry: null },
    });
    return true;
  }
}

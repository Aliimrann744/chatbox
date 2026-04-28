import { Injectable, BadRequestException, UnauthorizedException, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as admin from 'firebase-admin';
import * as UA from 'ua-parser-js';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { MailService } from './mail.service';
import { TwoFactorService } from '../two-factor/two-factor.service';

function describeUserAgent(userAgent: string | undefined): string | null {
  if (!userAgent) return null;
  try {
    const parser = new UA.UAParser(userAgent);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();

    const browserName = browser.name?.trim();
    const osName = os.name?.trim();
    const osVersion = os.version?.trim();
    const deviceModel = device.model?.trim();
    const deviceVendor = device.vendor?.trim();

    const deviceLabel = [deviceVendor, deviceModel].filter(Boolean).join(' ').trim();
    const osLabel = [osName, osVersion].filter(Boolean).join(' ').trim();
    const parts = [deviceLabel || null, browserName || null, osLabel ? `(${osLabel})` : null].filter(Boolean);
    if (parts.length === 0) return userAgent.split(' ')[0] || null;
    return parts.join(' · ');
  } catch {
    return userAgent.split(' ')[0] || null;
  }
}
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { FacebookLoginDto } from './dto/facebook-login.dto';

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Test login bypass: this phone number always receives a fixed OTP and skips
  // FCM delivery, so QA / store-review accounts can log in without a real device.
  private static readonly TEST_PHONE_CANONICAL = '+923084034370';
  private static readonly TEST_PHONE_FORMATS: ReadonlySet<string> = new Set([
    '+923084034370',
    '923084034370',
    '03084034370',
    '3084034370',
  ]);
  private static readonly TEST_PHONE_OTP = '123456';

  private normalizePhone(phone?: string | null): string | undefined {
    if (!phone) return undefined;
    const trimmed = phone.replace(/\s+/g, '');
    if (AuthService.TEST_PHONE_FORMATS.has(trimmed)) {
      return AuthService.TEST_PHONE_CANONICAL;
    }
    return trimmed;
  }

  private isTestPhone(phone?: string | null): boolean {
    if (!phone) return false;
    return AuthService.TEST_PHONE_FORMATS.has(phone.replace(/\s+/g, ''));
  }

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private uploadService: UploadService,
    private mailService: MailService,
    private twoFactor: TwoFactorService,
  ) {}

  /**
   * Detects which auth provider the user originally signed up with.
   * Returns null if user has no linked provider (pure OTP user).
   */
  private getLinkedProvider(user: { googleId?: string | null; facebookId?: string | null; phone?: string | null; email?: string | null }): 'google' | 'facebook' | 'email' | 'phone' | null {
    if (user.googleId) return 'google';
    if (user.facebookId) return 'facebook';
    return null;
  }

  private getProviderLabel(provider: string): string {
    const labels: Record<string, string> = {
      google: 'Google',
      facebook: 'Facebook',
      email: 'email verification',
      phone: 'phone verification',
    };
    return labels[provider] || provider;
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Delivers the OTP to the user's device via Firebase Cloud Messaging.
   * The device's FCM token is captured by the client at login-screen mount
   * and sent with the sendOtp request, so we don't need a paid SMS gateway.
   */
  private async sendFcmOtp(fcmToken: string, otp: string) {
    this.logger.log(
      `[OTP] Attempting FCM delivery (token prefix=${(fcmToken || '').slice(0, 12) || '<empty>'}…)`,
    );

    if (!fcmToken) {
      this.logger.warn('[OTP] No FCM token provided by client — rejecting');
      throw new BadRequestException(
        'Device is not registered for push notifications. Please allow notifications and try again.',
      );
    }

    if (!admin.apps.length) {
      this.logger.error('[OTP] Firebase admin not initialised — OTP push not sent');
      throw new BadRequestException('Notification service is not available');
    }

    try {
      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: 'Your Whatchat verification code',
          body: `${otp} is your code. It expires in 10 minutes. Don't share it with anyone.`,
        },
        data: {
          type: 'otp',
          otp, // allows the client to auto-fill the input on tap
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'system',
            color: '#25D366',
            defaultSound: true,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      });
      this.logger.log('[OTP] FCM push sent successfully');
    } catch (error: any) {
      const code = error?.code || error?.errorInfo?.code || 'unknown';
      this.logger.error(
        `[OTP] FCM send failed (code=${code}): ${error?.message || error}`,
      );
      throw new BadRequestException(
        `Failed to deliver OTP via push (${code}). Please reinstall the app or try again.`,
      );
    }
  }

  private async generateTokens(userId: string, identifier: string) {
    const payload = { sub: userId, phone: identifier };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn:
        this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
    });

    // Hash and store refresh token
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedRefreshToken },
    });

    return { accessToken, refreshToken };
  }

  private signChallengeToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId, twoFactor: true },
      {
        secret: (this.configService.get<string>('JWT_SECRET') || '') + ':2fa',
        expiresIn: '5m',
      },
    );
  }

  private verifyChallengeToken(token: string): string {
    try {
      const payload = this.jwtService.verify<{ sub: string; twoFactor: boolean }>(token, {
        secret: (this.configService.get<string>('JWT_SECRET') || '') + ':2fa',
      });
      if (!payload.twoFactor || !payload.sub) throw new Error('invalid');
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired two-factor challenge');
    }
  }

  /**
   * Records a successful login. If security notifications are enabled and
   * the user-agent has not been seen before, flags it as a new device and
   * emails a security alert.
   */
  private async recordLogin(
    userId: string,
    method: string,
    ctx: RequestContext,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, securityNotificationsEnabled: true },
    });
    if (!user) return;

    let isNewDevice = false;
    if (ctx.userAgent) {
      const prior = await this.prisma.loginEvent.findFirst({
        where: { userId, userAgent: ctx.userAgent },
      });
      isNewDevice = !prior;
    }

    const deviceLabel = describeUserAgent(ctx.userAgent);

    await this.prisma.loginEvent.create({
      data: {
        userId,
        method,
        ipAddress: ctx.ipAddress || null,
        userAgent: ctx.userAgent || null,
        device: deviceLabel,
        isNewDevice,
      },
    });

    if (isNewDevice && user.securityNotificationsEnabled && user.email) {
      try {
        await this.mailService.sendSecurityAlertEmail(user.email, {
          device: deviceLabel || ctx.userAgent,
          ipAddress: ctx.ipAddress,
          time: new Date(),
        });
      } catch (err: any) {
        this.logger.warn(`[Security] Failed to send new-device email: ${err.message}`);
      }
    }
  }

  async sendOtp(sendOtpDto: SendOtpDto) {
    const { phone: rawPhone, countryCode, email, fcmToken } = sendOtpDto;

    const isTestPhoneLogin = !email && this.isTestPhone(rawPhone);
    const phone = email ? rawPhone : this.normalizePhone(rawPhone);

    const otp = isTestPhoneLogin ? AuthService.TEST_PHONE_OTP : this.generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    if (email) {
      // Email-based OTP
      let user = await this.prisma.user.findUnique({ where: { email } });

      if (user) {
        // Check if this email is linked to a social provider
        const linkedProvider = this.getLinkedProvider(user);
        if (linkedProvider) {
          throw new ConflictException({
            message: `This email is associated with a ${this.getProviderLabel(linkedProvider)} account. Please sign in with ${this.getProviderLabel(linkedProvider)} instead.`,
            authProvider: linkedProvider,
          });
        }

        await this.prisma.user.update({ where: { id: user.id }, data: { otp, otpExpiry } });
      } else {
        user = await this.prisma.user.create({ data: { email, otp, otpExpiry, isVerified: false } });
      }

      try {
        await this.mailService.sendOtpEmail(email, otp);
      } catch (error) {
        console.error('Error sending email OTP:', error);
        throw new BadRequestException('Failed to send OTP via email');
      }

      return {
        message: 'OTP sent successfully via email',
        otp: process.env.NODE_ENV === 'development' ? otp : undefined,
      };
    }

    // Phone-based OTP — auto-register on first attempt and deliver via FCM.
    this.logger.log(
      `[OTP] Phone branch: phone=${phone}, cc=${countryCode}, hasFcmToken=${!!fcmToken}`,
    );
    let user = await this.prisma.user.findUnique({ where: { phone: phone! } });

    if (user) {
      // Check if this phone is linked to a social provider
      const linkedProvider = this.getLinkedProvider(user);
      if (linkedProvider) {
        throw new ConflictException({
          message: `This phone number is associated with a ${this.getProviderLabel(linkedProvider)} account. Please sign in with ${this.getProviderLabel(linkedProvider)} instead.`,
          authProvider: linkedProvider,
        });
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          otp,
          otpExpiry,
          ...(fcmToken ? { fcmToken } : {}),
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          phone: phone!,
          countryCode: countryCode || '+92',
          otp,
          otpExpiry,
          isVerified: false,
          ...(fcmToken ? { fcmToken } : {}),
        },
      });
    }

    if (isTestPhoneLogin) {
      this.logger.log('[OTP] Test phone bypass — skipping FCM and using fixed OTP');
      return {
        message: 'OTP sent successfully',
        otp: process.env.NODE_ENV === 'development' ? otp : undefined,
      };
    }

    // Resolve the token to push to: prefer what the client just sent, fall
    // back to whatever was previously stored on the user.
    const targetToken = fcmToken || user.fcmToken || '';
    await this.sendFcmOtp(targetToken, otp);

    return {
      message: 'OTP sent via push notification',
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
    };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto, ctx: RequestContext = {}) {
    const { phone: rawPhone, email, otp: otpCode } = verifyOtpDto;
    const phone = email ? rawPhone : this.normalizePhone(rawPhone);

    let user;
    if (email) {
      user = await this.prisma.user.findUnique({ where: { email } });
    } else {
      user = await this.prisma.user.findUnique({ where: { phone: phone! } });
    }

    if (!user) throw new NotFoundException('User not found');
    if (!user.otp || !user.otpExpiry) throw new BadRequestException('No OTP found. Please request a new one.');
    if (new Date() > user.otpExpiry) throw new BadRequestException('OTP has expired. Please request a new one.');
    if (user.otp !== otpCode) throw new BadRequestException('Invalid OTP');

    const isNewUser = user.name === '';

    // 2FA: if enabled, issue a 5-minute challenge token instead of real tokens
    if (user.twoFactorEnabled) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { otp: null, otpExpiry: null, isVerified: true },
      });

      if (user.twoFactorMethod === 'EMAIL') {
        try {
          await this.twoFactor.sendEmailLoginOtp(user.id);
        } catch (err: any) {
          this.logger.warn(`[2FA] Failed to send email OTP: ${err.message}`);
        }
      }

      return {
        message: 'Second factor required',
        twoFactorRequired: true,
        method: user.twoFactorMethod,
        challengeToken: this.signChallengeToken(user.id),
      };
    }

    // On successful primary auth, reactivate any deactivated/scheduled-for-deletion account.
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        otp: null,
        otpExpiry: null,
        isOnline: true,
        deactivatedAt: null,
        scheduledDeletionAt: null,
      },
    });

    const tokens = await this.generateTokens(user.id, user.phone || user.email!);
    await this.recordLogin(user.id, email ? 'otp-email' : 'otp-phone', ctx);

    return {
      message: 'OTP verified successfully',
      ...tokens,
      isNewUser,
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email, avatar: user.avatar, about: user.about },
    };
  }

  async completeTwoFactor(
    challengeToken: string,
    code: string,
    method: 'totp' | 'email' | 'backup',
    ctx: RequestContext = {},
  ) {
    const userId = this.verifyChallengeToken(challengeToken);

    let ok = false;
    let loginMethod = 'otp-phone';
    if (method === 'totp') {
      ok = await this.twoFactor.verifyTotpCode(userId, code);
      loginMethod = 'totp';
    } else if (method === 'email') {
      ok = await this.twoFactor.verifyEmailLoginOtp(userId, code);
      loginMethod = 'otp-email';
    } else if (method === 'backup') {
      ok = await this.twoFactor.verifyBackupCode(userId, code);
      loginMethod = 'backup-code';
    }
    if (!ok) throw new UnauthorizedException('Invalid two-factor code');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isOnline: true,
        deactivatedAt: null,
        scheduledDeletionAt: null,
      },
    });

    const tokens = await this.generateTokens(user.id, user.phone || user.email!);
    await this.recordLogin(user.id, loginMethod, ctx);
    const isNewUser = user.name === '';

    return {
      message: 'Two-factor verification successful',
      ...tokens,
      isNewUser,
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email, avatar: user.avatar, about: user.about },
    };
  }

  async resendTwoFactorEmail(challengeToken: string) {
    const userId = this.verifyChallengeToken(challengeToken);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.twoFactorMethod !== 'EMAIL') {
      throw new BadRequestException('Email 2FA is not enabled');
    }
    await this.twoFactor.sendEmailLoginOtp(userId);
    return { message: 'Verification code resent.' };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }});
      if (!user || !user.refreshToken) throw new UnauthorizedException('Invalid refresh token');
      const isRefreshTokenValid = await bcrypt.compare(refreshToken, user.refreshToken);

      if (!isRefreshTokenValid) throw new UnauthorizedException('Invalid refresh token');
      const tokens = await this.generateTokens(user.id, user.phone || user.email!);

      return {
        message: 'Token refreshed successfully',
        ...tokens,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    await this.prisma.user.update({ where: { id: userId },
      data: { refreshToken: null, isOnline: false, lastSeen: new Date() },
    });

    return { message: 'Logged out successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        avatar: true,
        about: true,
        isOnline: true,
        lastSeen: true,
        createdAt: true,
        language: true,
        twoFactorEnabled: true,
        twoFactorMethod: true,
        securityNotificationsEnabled: true,
        pendingEmail: true,
        deactivatedAt: true,
        scheduledDeletionAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, data: { name?: string; about?: string; phone?: string; countryCode?: string }, file?: Express.Multer.File) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const updateData: { name?: string; about?: string; avatar?: string; phone?: string; countryCode?: string } = {};

    if (data.name !== undefined) {
      if (data.name.trim().length < 2) throw new BadRequestException('Name must be at least 2 characters');
      updateData.name = data.name.trim();
    }

    if (data.about !== undefined) {
      updateData.about = data.about.trim();
    }

    // Handle phone number update (for email-signup users adding phone)
    if (data.phone !== undefined && data.phone.trim()) {
      const cleanedPhone = data.phone.trim();
      const existingUser = await this.prisma.user.findUnique({ where: { phone: cleanedPhone } });
      if (existingUser && existingUser.id !== userId) {
        throw new BadRequestException('This phone number is already in use');
      }
      updateData.phone = cleanedPhone;
      if (data.countryCode) {
        updateData.countryCode = data.countryCode;
      }
    }

    if (file) {
      const uploaded = await this.uploadService.uploadFile(file, 'avatars');
      updateData.avatar = uploaded.url;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, name: true, phone: true, email: true, avatar: true, about: true, isOnline: true, lastSeen: true, createdAt: true },
    });

    return updated;
  }

  async removeAvatar(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: null },
      select: { id: true, name: true, phone: true, email: true, avatar: true, about: true, isOnline: true, lastSeen: true, createdAt: true },
    });

    return updated;
  }

  private async findOrCreateSocialUser(opts: {
    providerField: 'googleId' | 'facebookId';
    providerId: string;
    email?: string;
    name?: string;
    avatar?: string;
    ctx?: RequestContext;
    loginMethod: string;
  }) {
    const { providerField, providerId, email, name, avatar, ctx = {}, loginMethod } = opts;

    // 1. Find by provider ID
    let user = await this.prisma.user.findUnique({ where: { [providerField]: providerId } as any });

    // 2. Find by email — check for provider conflict instead of auto-linking
    if (!user && email) {
      const existingUser = await this.prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        const linkedProvider = this.getLinkedProvider(existingUser);

        if (linkedProvider && linkedProvider !== providerField.replace('Id', '')) {
          // User signed up with a DIFFERENT social provider
          throw new ConflictException({
            message: `This email is already associated with a ${this.getProviderLabel(linkedProvider)} account. Please sign in with ${this.getProviderLabel(linkedProvider)} instead.`,
            authProvider: linkedProvider,
          });
        }

        if (!linkedProvider) {
          // User signed up with OTP (email or phone) — no social provider linked
          const method = existingUser.phone ? 'phone' : 'email';
          throw new ConflictException({
            message: `This email is already registered with ${this.getProviderLabel(method)}. Please sign in using ${this.getProviderLabel(method)} instead.`,
            authProvider: method,
          });
        }

        // Same provider but different providerId — shouldn't normally happen
        // but handle gracefully by treating as the existing user
        user = existingUser;
      }
    }

    // 3. Create new user
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          [providerField]: providerId,
          email: email || undefined,
          name: name || '',
          avatar: avatar || undefined,
          isVerified: true,
        },
      });
    } else {
      // Reactivate on successful social login
      await this.prisma.user.update({
        where: { id: user.id },
        data: { deactivatedAt: null, scheduledDeletionAt: null, isOnline: true },
      });
    }

    // 2FA for social logins
    if (user.twoFactorEnabled) {
      if (user.twoFactorMethod === 'EMAIL') {
        try {
          await this.twoFactor.sendEmailLoginOtp(user.id);
        } catch (err: any) {
          this.logger.warn(`[2FA] Failed to send email OTP: ${err.message}`);
        }
      }
      return {
        message: 'Second factor required',
        twoFactorRequired: true,
        method: user.twoFactorMethod,
        challengeToken: this.signChallengeToken(user.id),
      };
    }

    const isNewUser = user.name === '';
    const tokens = await this.generateTokens(user.id, user.email || user.phone || providerId);
    await this.recordLogin(user.id, loginMethod, ctx);

    return {
      message: 'Login successful',
      ...tokens,
      isNewUser,
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email, avatar: user.avatar, about: user.about },
    };
  }

  async googleLogin(dto: GoogleLoginDto, ctx: RequestContext = {}) {
    const { idToken } = dto;

    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    if (!response.ok) {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    const payload = await response.json();
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (googleClientId && payload.aud !== googleClientId) {
      throw new UnauthorizedException('Google token audience mismatch');
    }

    return this.findOrCreateSocialUser({
      providerField: 'googleId',
      providerId: payload.sub,
      email: payload.email,
      name: payload.name,
      avatar: payload.picture,
      ctx,
      loginMethod: 'google',
    });
  }

  async facebookLogin(dto: FacebookLoginDto, ctx: RequestContext = {}) {
    const { accessToken } = dto;

    const response = await fetch(
      `https://graph.facebook.com/me?access_token=${accessToken}&fields=id,name,email,picture.type(large)`,
    );
    if (!response.ok) {
      throw new UnauthorizedException('Invalid Facebook access token');
    }

    const fbUser = await response.json();
    if (!fbUser.id) {
      throw new UnauthorizedException('Invalid Facebook access token');
    }

    return this.findOrCreateSocialUser({
      providerField: 'facebookId',
      providerId: fbUser.id,
      email: fbUser.email,
      name: fbUser.name,
      avatar: fbUser.picture?.data?.url,
      ctx,
      loginMethod: 'facebook',
    });
  }
}

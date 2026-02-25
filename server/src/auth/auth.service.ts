import { Injectable, BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { MailService } from './mail.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private uploadService: UploadService,
    private mailService: MailService,
  ) {}

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async sendWhatsAppOtp(phone: string, otp: string) {
    const appKey = this.configService.get<string>('WHATSAPP_APP_KEY');
    const authKey = this.configService.get<string>('WHATSAPP_AUTH_KEY');

    const data = {
      phone: phone,
      message: `Your Chatbox verification code is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
      appkey: appKey,
      authkey: authKey,
    };

    try {
      const response = await fetch(`http://35.225.168.22:8081/khaliq/sendmessage.php?phone=${data?.phone}&message=${encodeURIComponent(data?.message)}&appkey=${data?.appkey}&authkey=${data?.authkey}`, { method: 'GET' });
      if (!response.ok) {
        console.error('WhatsApp API error:', await response.text());
        throw new BadRequestException('Failed to send OTP via WhatsApp');
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      console.error('Error sending WhatsApp OTP:', error);
      throw new BadRequestException('Failed to send OTP via WhatsApp');
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

  async sendOtp(sendOtpDto: SendOtpDto) {
    const { phone, countryCode, email } = sendOtpDto;

    const otp = this.generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    if (email) {
      // Email-based OTP
      let user = await this.prisma.user.findUnique({ where: { email } });

      if (user) {
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

    // Phone-based OTP (existing flow)
    let user = await this.prisma.user.findUnique({ where: { phone: phone! } });

    if (user) {
      await this.prisma.user.update({ where: { id: user.id }, data: { otp, otpExpiry }});
    } else {
      user = await this.prisma.user.create({ data: { phone: phone!, countryCode: countryCode || '+92', otp, otpExpiry, isVerified: false }});
    }

    const fullPhone = `${countryCode || user?.countryCode}${phone}`;
    await this.sendWhatsAppOtp(fullPhone, otp);

    return {
      message: 'OTP sent successfully via WhatsApp',
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
    };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { phone, email, otp: otpCode } = verifyOtpDto;

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
    await this.prisma.user.update({
      where: { id: user.id }, data: { isVerified: true, otp: null, otpExpiry: null, isOnline: true },
    });

    const tokens = await this.generateTokens(user.id, user.phone || user.email!);

    return {
      message: 'OTP verified successfully',
      ...tokens,
      isNewUser,
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email, avatar: user.avatar, about: user.about },
    };
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
      select: { id: true, name: true, phone: true, email: true, avatar: true, about: true, isOnline: true, lastSeen: true, createdAt: true },
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
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendOtpEmail(email: string, otp: string) {
    const from = this.configService.get<string>('SMTP_FROM');

    await this.transporter.sendMail({
      from: `"Chatbox" <${from}>`,
      to: email,
      subject: 'Your Chatbox Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1a1a1a; margin-bottom: 16px;">Verify Your Email</h2>
          <p style="color: #555; font-size: 14px;">Your Chatbox verification code is:</p>
          <div style="background: #f4f4f4; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a;">${otp}</span>
          </div>
          <p style="color: #888; font-size: 12px;">This code expires in 10 minutes. Do not share it with anyone.</p>
        </div>
      `,
    });
  }
}

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

  private from() {
    return this.configService.get<string>('SMTP_FROM');
  }

  private codeHtml(title: string, lead: string, code: string, tail: string) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1a1a1a; margin-bottom: 16px;">${title}</h2>
        <p style="color: #555; font-size: 14px;">${lead}</p>
        <div style="background: #f4f4f4; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a;">${code}</span>
        </div>
        <p style="color: #888; font-size: 12px;">${tail}</p>
      </div>
    `;
  }

  async sendOtpEmail(email: string, otp: string) {
    await this.transporter.sendMail({
      from: `"Chatbox" <${this.from()}>`,
      to: email,
      subject: 'Your Chatbox Verification Code',
      html: this.codeHtml(
        'Verify Your Email',
        'Your Chatbox verification code is:',
        otp,
        'This code expires in 10 minutes. Do not share it with anyone.',
      ),
    });
  }

  async sendEmailChangeOtp(email: string, otp: string) {
    await this.transporter.sendMail({
      from: `"Chatbox" <${this.from()}>`,
      to: email,
      subject: 'Confirm your new email address',
      html: this.codeHtml(
        'Confirm your new email',
        'Use the code below to confirm this email as your new Chatbox address:',
        otp,
        'This code expires in 10 minutes. If you did not request this change, ignore this email.',
      ),
    });
  }

  async send2faDisableEmail(email: string, otp: string) {
    await this.transporter.sendMail({
      from: `"Chatbox Security" <${this.from()}>`,
      to: email,
      subject: 'Disable two-step verification',
      html: this.codeHtml(
        'Disable two-step verification',
        'Use the code below to confirm you want to turn off two-step verification:',
        otp,
        'If you did not request this, someone may be trying to access your account. Do not share this code.',
      ),
    });
  }

  async send2faLoginEmail(email: string, otp: string) {
    await this.transporter.sendMail({
      from: `"Chatbox Security" <${this.from()}>`,
      to: email,
      subject: 'Your sign-in verification code',
      html: this.codeHtml(
        'Verify it\'s you',
        'Enter this code to complete sign-in:',
        otp,
        'This code expires in 10 minutes. Do not share it with anyone.',
      ),
    });
  }

  async sendSecurityAlertEmail(email: string, details: { device?: string; ipAddress?: string; time: Date }) {
    const timeStr = details.time.toUTCString();
    await this.transporter.sendMail({
      from: `"Chatbox Security" <${this.from()}>`,
      to: email,
      subject: 'New sign-in to your Chatbox account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1a1a1a; margin-bottom: 16px;">New sign-in detected</h2>
          <p style="color: #555; font-size: 14px;">Your Chatbox account was just accessed from a new device.</p>
          <ul style="color: #555; font-size: 14px;">
            <li><strong>Time:</strong> ${timeStr}</li>
            <li><strong>Device:</strong> ${details.device || 'Unknown'}</li>
            <li><strong>IP address:</strong> ${details.ipAddress || 'Unknown'}</li>
          </ul>
          <p style="color: #555; font-size: 14px;">If this was you, no action is needed. If you don't recognise this sign-in, open Settings → Account and turn on two-step verification immediately.</p>
        </div>
      `,
    });
  }

  async sendDataExportEmail(email: string, json: string) {
    await this.transporter.sendMail({
      from: `"Chatbox" <${this.from()}>`,
      to: email,
      subject: 'Your requested account data',
      text: 'Your requested account data is attached as a JSON file.',
      attachments: [
        {
          filename: 'chatbox-account-data.json',
          content: json,
          contentType: 'application/json',
        },
      ],
    });
  }

  async sendAccountDeletionScheduledEmail(email: string, deletionDate: Date) {
    const ds = deletionDate.toUTCString();
    await this.transporter.sendMail({
      from: `"Chatbox" <${this.from()}>`,
      to: email,
      subject: 'Your Chatbox account is scheduled for deletion',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1a1a1a; margin-bottom: 16px;">Account deletion scheduled</h2>
          <p style="color: #555; font-size: 14px;">Your Chatbox account will be permanently deleted on <strong>${ds}</strong>.</p>
          <p style="color: #555; font-size: 14px;">If you change your mind, sign in before that date and cancel the deletion from Settings → Account.</p>
        </div>
      `,
    });
  }
}

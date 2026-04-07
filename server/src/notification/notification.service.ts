import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private isInitialized = false;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    try {
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
      const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
      const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

      this.logger.log(`Firebase config: projectId=${projectId}, clientEmail=${clientEmail}, privateKey=${privateKey ? 'SET (' + privateKey.length + ' chars)' : 'NOT SET'}`);

      if (!projectId || !clientEmail || !privateKey) {
        this.logger.warn(
          'Firebase credentials not configured. Push notifications will be disabled.',
        );
        return;
      }

      // Validate credentials format
      if (!clientEmail.includes('@') || !clientEmail.includes('.iam.gserviceaccount.com')) {
        this.logger.error(`Invalid FIREBASE_CLIENT_EMAIL format: "${clientEmail}". Expected format: firebase-adminsdk-xxxxx@project-id.iam.gserviceaccount.com`);
      }

      if (!privateKey.includes('BEGIN PRIVATE KEY')) {
        this.logger.error('FIREBASE_PRIVATE_KEY does not contain "BEGIN PRIVATE KEY". Make sure the key is properly quoted in .env');
      }

      // Prevent re-initialization
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            // Handle escaped newlines from env
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });
      }

      this.isInitialized = true;
      this.logger.log('Firebase Admin initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin:', error.message);
    }
  }

  // ==================== GET USER FCM TOKEN ====================

  async getUserFcmToken(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });
    return user?.fcmToken || null;
  }

  async getUserWithDetails(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        avatar: true,
        fcmToken: true,
      },
    });
  }

  // ==================== MESSAGE NOTIFICATIONS ====================

  async sendMessageNotification(
    recipientUserId: string,
    senderName: string,
    messagePreview: string,
    chatId: string,
    senderId: string,
    chatType: 'PRIVATE' | 'GROUP' = 'PRIVATE',
    groupName?: string,
  ): Promise<void> {
    if (!this.isInitialized) return;

    const fcmToken = await this.getUserFcmToken(recipientUserId);
    if (!fcmToken) return;

    // Check if user has muted this chat
    const membership = await this.prisma.chatMember.findFirst({
      where: { chatId, userId: recipientUserId },
      select: { isMuted: true, muteUntil: true },
    });

    if (membership?.isMuted) {
      if (!membership.muteUntil || membership.muteUntil > new Date()) {
        return; // Chat is muted
      }
    }

    const title =
      chatType === 'GROUP' && groupName
        ? `${groupName}`
        : senderName;

    const body =
      chatType === 'GROUP' && groupName
        ? `${senderName}: ${messagePreview}`
        : messagePreview;

    try {
      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title,
          body,
        },
        data: {
          type: chatType === 'GROUP' ? 'group' : 'message',
          chatId,
          senderId,
          senderName,
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'messages',

            color: '#25D366',
            sound: 'default',
            defaultSound: true,
            defaultVibrateTimings: true,
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

      this.logger.log(`Push sent to ${recipientUserId} for ${chatType} message`);
    } catch (error) {
      this.handleFcmError(error, recipientUserId);
    }
  }

  // ==================== CALL NOTIFICATIONS ====================

  async sendCallNotification(
    recipientUserId: string,
    callerName: string,
    callerAvatar: string | null,
    callId: string,
    callerId: string,
    callType: 'VOICE' | 'VIDEO',
  ): Promise<void> {
    if (!this.isInitialized) return;

    const fcmToken = await this.getUserFcmToken(recipientUserId);
    if (!fcmToken) return;

    try {
      // Data-only message with high priority — wakes device from doze
      await admin.messaging().send({
        token: fcmToken,
        // No `notification` key — data-only so headless JS can handle it
        data: {
          type: 'call',
          callId,
          callerId,
          callerName,
          callerAvatar: callerAvatar || '',
          callType,
          timestamp: Date.now().toString(),
        },
        android: {
          priority: 'high',
          ttl: 30000, // 30 seconds — matches call timeout
        },
        apns: {
          headers: {
            'apns-priority': '10', // Immediate delivery
            'apns-expiration': Math.floor(Date.now() / 1000 + 30).toString(),
          },
          payload: {
            aps: {
              'content-available': 1,
              sound: 'ringtone.caf',
            },
          },
        },
      });

      this.logger.log(`Call push sent to ${recipientUserId} (${callType})`);
    } catch (error) {
      this.handleFcmError(error, recipientUserId);
    }
  }

  // ==================== MISSED CALL NOTIFICATION ====================

  async sendMissedCallNotification(
    recipientUserId: string,
    callerName: string,
    callType: 'VOICE' | 'VIDEO',
  ): Promise<void> {
    if (!this.isInitialized) return;

    const fcmToken = await this.getUserFcmToken(recipientUserId);
    if (!fcmToken) return;

    const callLabel = callType === 'VIDEO' ? 'video call' : 'voice call';

    try {
      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: 'Missed Call',
          body: `Missed ${callLabel} from ${callerName}`,
        },
        data: {
          type: 'missed_call',
          callerName,
          callType,
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'calls',

            color: '#FF0000',
            sound: 'default',
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

      this.logger.log(`Missed call push sent to ${recipientUserId}`);
    } catch (error) {
      this.handleFcmError(error, recipientUserId);
    }
  }

  // ==================== SYSTEM NOTIFICATIONS ====================

  async sendSystemNotification(
    recipientUserId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.isInitialized) return;

    const fcmToken = await this.getUserFcmToken(recipientUserId);
    if (!fcmToken) return;

    try {
      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title,
          body,
        },
        data: {
          type: 'system',
          ...data,
        },
        android: {
          priority: 'normal',
          notification: {
            channelId: 'system',

            color: '#25D366',
          },
        },
      });
    } catch (error) {
      this.handleFcmError(error, recipientUserId);
    }
  }

  // ==================== ERROR HANDLING ====================

  private handleFcmError(error: any, userId: string) {
    const errorCode = error?.code || error?.errorInfo?.code;

    // Token is invalid or expired — remove it from DB
    if (
      errorCode === 'messaging/registration-token-not-registered' ||
      errorCode === 'messaging/invalid-registration-token'
    ) {
      this.logger.warn(`Removing invalid FCM token for user ${userId}`);
      this.prisma.user
        .update({
          where: { id: userId },
          data: { fcmToken: null },
        })
        .catch(() => {});
    } else {
      this.logger.error(`FCM send error for user ${userId}:`, error.message);
    }
  }

  // ==================== HELPERS ====================

  getMessagePreview(type: string, content?: string): string {
    switch (type) {
      case 'TEXT':
        return content?.substring(0, 100) || 'New message';
      case 'IMAGE':
        return '📷 Photo';
      case 'VIDEO':
        return '🎥 Video';
      case 'AUDIO':
        return '🎵 Voice message';
      case 'DOCUMENT':
        return '📄 Document';
      case 'LOCATION':
        return '📍 Location';
      case 'CONTACT':
        return '👤 Contact';
      case 'STICKER':
        return '🏷️ Sticker';
      default:
        return 'New message';
    }
  }
}

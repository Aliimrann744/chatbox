import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { settingsApi } from '@/services/api';

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  type: 'message' | 'call' | 'group' | 'missed_call' | 'system';
  chatId?: string;
  callId?: string;
  callerId?: string;
  callerName?: string;
  callerAvatar?: string;
  callType?: 'VOICE' | 'VIDEO';
  senderId?: string;
  senderName?: string;
}

// Track current active chat to suppress notifications
let currentActiveChatId: string | null = null;

export function setActiveChatId(chatId: string | null) {
  console.log('[Notifications] Active chat set to:', chatId);
  currentActiveChatId = chatId;
}

export function getActiveChatId(): string | null {
  return currentActiveChatId;
}

class NotificationService {
  private fcmToken: string | null = null;
  private responseListener: Notifications.EventSubscription | null = null;
  private onMessageUnsubscribe: (() => void) | null = null;
  private onTokenRefreshUnsubscribe: (() => void) | null = null;
  private preLoginReady = false;

  /**
   * Runs on app boot — BEFORE login. Sets up Android notification channels
   * and the foreground FCM handler so pre-auth pushes like OTP actually
   * display. Does NOT touch the user-token endpoint (which requires auth).
   * Idempotent.
   */
  async initializeBeforeLogin(): Promise<void> {
    if (this.preLoginReady) return;
    this.preLoginReady = true;
    console.log('[Notifications] Pre-login init...');
    try {
      // Request OS-level permission early — the OTP flow needs it.
      await this.requestPermissions();
      await this.setupNotificationChannels();
      this.setupFirebaseListeners();
      console.log('[Notifications] Pre-login init done');
    } catch (e) {
      console.warn('[Notifications] Pre-login init failed:', e);
    }
  }

  // Initialize notifications (post-login)
  async initialize(): Promise<void> {
    console.log('[Notifications] Initializing...');

    try {
      // Make sure channels + foreground handler exist (no-op if already done pre-login).
      await this.initializeBeforeLogin();

      const token = await this.getFcmToken();
      console.log('[Notifications] Got FCM token:', token ? 'YES' : 'NO');

      if (token) {
        this.fcmToken = token;
        await this.registerTokenWithServer(token);
      }
    } catch (error) {
      console.error('[Notifications] Initialization error:', error);
    }

    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      this.handleNotificationResponse
    );

    console.log('[Notifications] Initialization complete');
  }

  // Request notification permissions
  private async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
      console.log('[Notifications] Not a physical device, skipping');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('[Notifications] Existing permission status:', existingStatus);

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('[Notifications] Requested permission, got:', finalStatus);
    }

    return finalStatus === 'granted';
  }

  // Get FCM device token using modular API
  private async getFcmToken(): Promise<string | null> {
    try {
      const { getToken, getMessaging } = require('@react-native-firebase/messaging');
      const token = await getToken(getMessaging());
      console.log('[Notifications] FCM Token:', token);
      return token;
    } catch (e) {
      console.warn('[Notifications] FCM token error, trying Expo fallback:', e);
    }

    try {
      if (Device.isDevice) {
        const tokenResponse = await Notifications.getDevicePushTokenAsync();
        console.log('[Notifications] Device Push Token:', tokenResponse.data);
        return tokenResponse.data as string;
      }
    } catch (e) {
      console.warn('[Notifications] Device push token error:', e);
    }

    return null;
  }

  // Register token with server
  private async registerTokenWithServer(token: string): Promise<void> {
    try {
      await settingsApi.updateFcmToken(token);
      console.log('[Notifications] Token registered with server');
    } catch (error) {
      console.error('[Notifications] Token registration error:', error);
    }
  }

  // Setup Android notification channels
  private async setupNotificationChannels(): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      const notifee = require('@notifee/react-native').default;
      const { AndroidImportance } = require('@notifee/react-native');

      await notifee.createChannel({
        id: 'messages',
        name: 'Messages',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
        vibrationPattern: [300, 300, 300, 300],
      });

      await notifee.createChannel({
        id: 'calls',
        name: 'Incoming Calls',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
        vibrationPattern: [500, 500, 300, 500],
      });

      await notifee.createChannel({
        id: 'system',
        name: 'System Notifications',
        importance: AndroidImportance.DEFAULT,
        sound: 'default',
      });

      console.log('[Notifications] Channels created via Notifee');
    } catch (e) {
      console.warn('[Notifications] Notifee channels failed:', e);

      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#04003a',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('calls', {
        name: 'Incoming Calls',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500],
        lightColor: '#04003a',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('system', {
        name: 'System Notifications',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });

      console.log('[Notifications] Channels created via Expo');
    }
  }

  // Setup Firebase messaging listeners
  private setupFirebaseListeners(): void {
    try {
      const { onMessage, onTokenRefresh, getMessaging } = require('@react-native-firebase/messaging');
      const messaging = getMessaging();

      // FCM foreground messages (only fires when server sends FCM — i.e. user was offline)
      this.onMessageUnsubscribe = onMessage(messaging, async (remoteMessage: any) => {
        console.log('[Notifications] FCM foreground message received:', JSON.stringify(remoteMessage));
        await this.displayNotification(
          remoteMessage.notification?.title || remoteMessage.data?.senderName || 'New Message',
          remoteMessage.notification?.body || 'You have a new message',
          remoteMessage.data || {},
        );
      });

      this.onTokenRefreshUnsubscribe = onTokenRefresh(messaging, async (newToken: string) => {
        console.log('[Notifications] FCM token refreshed');
        this.fcmToken = newToken;
        await this.registerTokenWithServer(newToken);
      });

      console.log('[Notifications] Firebase listeners registered');
    } catch (e) {
      console.warn('[Notifications] Firebase listeners setup failed:', e);
    }
  }

  /**
   * Display a local notification via Notifee (or Expo fallback).
   * Called from:
   *  1. FCM onMessage (when user comes online and gets push)
   *  2. Socket new_message handler (when user is online but not in that chat)
   */
  async displayNotification(
    title: string,
    body: string,
    data: Record<string, any>,
  ): Promise<void> {
    console.log('[Notifications] displayNotification called:', { title, body, data });
    console.log('[Notifications] currentActiveChatId:', currentActiveChatId);

    // Suppress if user is currently viewing this chat
    if (data.chatId && data.chatId === currentActiveChatId) {
      console.log('[Notifications] Suppressed — user is in this chat');
      return;
    }

    // Suppress call notifications in foreground (handled by CallContext)
    if (data.type === 'call') {
      console.log('[Notifications] Suppressed — call handled by CallContext');
      return;
    }

    try {
      const notifee = require('@notifee/react-native').default;
      console.log('[Notifications] Displaying via Notifee...');

      const channelId = data.type === 'missed_call' ? 'calls' : 'messages';

      await notifee.displayNotification({
        title,
        body,
        data,
        android: {
          channelId,
          color: '#25D366',
          sound: 'default',
          pressAction: { id: 'default' },
        },
      });

      console.log('[Notifications] Notifee notification displayed successfully');
    } catch (e) {
      console.warn('[Notifications] Notifee display failed:', e);
      console.log('[Notifications] Falling back to Expo notification...');

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data,
            sound: true,
          },
          trigger: null,
        });
        console.log('[Notifications] Expo notification displayed successfully');
      } catch (expoErr) {
        console.error('[Notifications] Expo notification also failed:', expoErr);
      }
    }
  }

  // Clean up listeners
  cleanup(): void {
    if (this.responseListener) {
      this.responseListener.remove();
    }
    if (this.onMessageUnsubscribe) {
      this.onMessageUnsubscribe();
    }
    if (this.onTokenRefreshUnsubscribe) {
      this.onTokenRefreshUnsubscribe();
    }
  }

  // Handle notification tap
  private handleNotificationResponse = (response: Notifications.NotificationResponse): void => {
    const data = response.notification.request.content.data as unknown as NotificationData;
    console.log('[Notifications] Notification tapped:', data);
    this.navigateToNotification(data);
  };

  // Navigate based on notification data
  navigateToNotification(data: NotificationData): void {
    switch (data.type) {
      case 'message':
        if (data.chatId) {
          router.push({ pathname: '/chat/[id]', params: { id: data.chatId } });
        }
        break;
      case 'call':
        router.push('/call/incoming');
        break;
      case 'group':
        if (data.chatId) {
          router.push({ pathname: '/chat/[id]', params: { id: data.chatId } });
        }
        break;
      case 'missed_call':
        router.push('/(tabs)/calls');
        break;
      default:
        router.push('/');
        break;
    }
  }

  getToken(): string | null {
    return this.fcmToken;
  }

  async scheduleLocalNotification(title: string, body: string, data?: NotificationData): Promise<string> {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data as unknown as Record<string, unknown>, sound: true },
      trigger: null,
    });
    return id;
  }

  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    try {
      const notifee = require('@notifee/react-native').default;
      await notifee.cancelAllNotifications();
    } catch (e) {}
  }

  async getBadgeCount(): Promise<number> {
    return Notifications.getBadgeCountAsync();
  }

  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  async clearBadge(): Promise<void> {
    await Notifications.setBadgeCountAsync(0);
  }
}

export const notificationService = new NotificationService();
export default notificationService;

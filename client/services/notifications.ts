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
  currentActiveChatId = chatId;
}

export function getActiveChatId(): string | null {
  return currentActiveChatId;
}

class NotificationService {
  private fcmToken: string | null = null;
  private notificationListener: Notifications.EventSubscription | null = null;
  private responseListener: Notifications.EventSubscription | null = null;
  private firebaseMessaging: any = null;
  private notifee: any = null;

  // Initialize notifications
  async initialize(): Promise<void> {
    try {
      // Register for push notifications via system permissions
      await this.requestPermissions();

      // Try to get FCM token via @react-native-firebase/messaging
      const token = await this.getFcmToken();

      if (token) {
        this.fcmToken = token;
        await this.registerTokenWithServer(token);
      }

      // Setup notification channels on Android
      await this.setupNotificationChannels();

      // Setup Firebase messaging listeners
      await this.setupFirebaseListeners();
    } catch (error) {
      console.warn('Notification initialization error:', error);
    }

    // Handle expo notification taps (for when notification is shown via system)
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      this.handleNotificationResponse
    );
  }

  // Request notification permissions
  private async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permission not granted');
      return false;
    }

    // Also request Firebase messaging permission
    try {
      const messaging = await this.getFirebaseMessaging();
      if (messaging) {
        const authStatus = await messaging.requestPermission();
        console.log('Firebase messaging permission:', authStatus);
      }
    } catch (e) {
      console.warn('Firebase permission request failed:', e);
    }

    return true;
  }

  // Get Firebase Messaging instance (lazy load)
  private async getFirebaseMessaging() {
    if (this.firebaseMessaging) return this.firebaseMessaging;

    try {
      const messagingModule = require('@react-native-firebase/messaging');
      this.firebaseMessaging = messagingModule.default;
      return this.firebaseMessaging;
    } catch (e) {
      console.warn('Firebase messaging not available:', e);
      return null;
    }
  }

  // Get Notifee instance (lazy load)
  private async getNotifee() {
    if (this.notifee) return this.notifee;

    try {
      const notifeeModule = require('@notifee/react-native');
      this.notifee = notifeeModule.default;
      return this.notifee;
    } catch (e) {
      console.warn('Notifee not available:', e);
      return null;
    }
  }

  // Get FCM device token
  private async getFcmToken(): Promise<string | null> {
    try {
      const messaging = await this.getFirebaseMessaging();
      if (messaging) {
        const token = await messaging().getToken();
        console.log('FCM Token:', token);
        return token;
      }
    } catch (e) {
      console.warn('Could not get FCM token, falling back to Expo token:', e);
    }

    // Fallback: try Expo device push token (raw FCM/APNs token)
    try {
      if (Device.isDevice) {
        const tokenResponse = await Notifications.getDevicePushTokenAsync();
        console.log('Device Push Token:', tokenResponse.data);
        return tokenResponse.data as string;
      }
    } catch (e) {
      console.warn('Could not get device push token:', e);
    }

    return null;
  }

  // Register token with server
  private async registerTokenWithServer(token: string): Promise<void> {
    try {
      await settingsApi.updateFcmToken(token);
      console.log('FCM token registered with server');
    } catch (error) {
      console.error('Error registering FCM token with server:', error);
    }
  }

  // Setup Android notification channels via Notifee (or fallback to expo)
  private async setupNotificationChannels(): Promise<void> {
    if (Platform.OS !== 'android') return;

    const notifee = await this.getNotifee();

    if (notifee) {
      // Use Notifee for better channel control
      const { AndroidImportance } = require('@notifee/react-native');

      await notifee.createChannel({
        id: 'messages',
        name: 'Messages',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
        vibrationPattern: [0, 250, 250, 250],
      });

      await notifee.createChannel({
        id: 'calls',
        name: 'Incoming Calls',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
        vibrationPattern: [0, 500, 200, 500, 200, 500],
      });

      await notifee.createChannel({
        id: 'system',
        name: 'System Notifications',
        importance: AndroidImportance.DEFAULT,
        sound: 'default',
      });
    } else {
      // Fallback to expo-notifications channels
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
        vibrationPattern: [0, 500, 200, 500, 200, 500],
        lightColor: '#04003a',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('system', {
        name: 'System Notifications',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }
  }

  // Setup Firebase messaging listeners for foreground messages
  private async setupFirebaseListeners(): Promise<void> {
    const messaging = await this.getFirebaseMessaging();
    if (!messaging) return;

    // Foreground messages from FCM
    messaging().onMessage(async (remoteMessage: any) => {
      console.log('FCM foreground message:', remoteMessage);

      const data = remoteMessage.data;
      if (!data) return;

      // Handle call notifications in foreground — these are handled by CallContext
      if (data.type === 'call') {
        // Call is handled by socket in foreground, skip notification
        return;
      }

      // Suppress message notifications if user is in that chat
      if (
        (data.type === 'message' || data.type === 'group') &&
        data.chatId === currentActiveChatId
      ) {
        return;
      }

      // Show notification via Notifee for better control
      const notifee = await this.getNotifee();
      if (notifee && !remoteMessage.notification) {
        // Data-only message — display manually
        await notifee.displayNotification({
          title: remoteMessage.notification?.title || data.senderName || 'New Message',
          body: remoteMessage.notification?.body || 'You have a new message',
          data: data,
          android: {
            channelId: data.type === 'missed_call' ? 'calls' : 'messages',
            smallIcon: 'ic_notification',
            pressAction: { id: 'default' },
          },
        });
      }
      // If remoteMessage has notification key, Android shows it automatically
    });

    // Token refresh handler
    messaging().onTokenRefresh(async (newToken: string) => {
      console.log('FCM token refreshed');
      this.fcmToken = newToken;
      await this.registerTokenWithServer(newToken);
    });
  }

  // Clean up listeners
  cleanup(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
    }
    if (this.responseListener) {
      this.responseListener.remove();
    }
  }

  // Handle notification tap (navigates to relevant screen)
  private handleNotificationResponse = (response: Notifications.NotificationResponse): void => {
    const data = response.notification.request.content.data as unknown as NotificationData;
    console.log('Notification tapped:', data);
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

  // Get current FCM token
  getToken(): string | null {
    return this.fcmToken;
  }

  // Schedule a local notification
  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: NotificationData,
  ): Promise<string> {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data as unknown as Record<string, unknown>,
        sound: true,
      },
      trigger: null,
    });
    return id;
  }

  // Cancel all notifications
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Also cancel Notifee notifications
    const notifee = await this.getNotifee();
    if (notifee) {
      await notifee.cancelAllNotifications();
    }
  }

  // Badge management
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

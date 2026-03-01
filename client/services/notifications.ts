import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { settingsApi } from '@/services/api';

// Configure notification behavior
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
  type: 'message' | 'call' | 'group' | 'system';
  chatId?: string;
  callId?: string;
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
}

class NotificationService {
  private expoPushToken: string | null = null;
  private notificationListener: Notifications.EventSubscription | null = null;
  private responseListener: Notifications.EventSubscription | null = null;

  // Initialize notifications
  async initialize(): Promise<void> {
    try {
      // Register for push notifications
      const token = await this.registerForPushNotifications();

      if (token) {
        this.expoPushToken = token;
        // Register token with server
        await this.registerTokenWithServer(token);
      }
    } catch (error) {
      console.warn('Push notifications not available:', error);
    }

    // Handle notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(
      this.handleNotificationReceived
    );

    // Handle notification taps
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      this.handleNotificationResponse
    );
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

  // Register for push notifications
  private async registerForPushNotifications(): Promise<string | null> {
    let token: string | null = null;

    // Check if running on physical device
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    // Check/request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push notification permissions');
      return null;
    }

    try {
      // Get Expo push token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.warn('No EAS projectId found. Push notifications require a development build with EAS configured.');
        return null;
      }
      const tokenResponse = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      token = tokenResponse.data;
      console.log('Expo Push Token:', token);
    } catch (error) {
      console.warn('Push notifications not available (this is expected in Expo Go):', error);
    }

    // Configure Android channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#04003a',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('calls', {
        name: 'Calls',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#04003a',
        sound: 'default',
      });
    }

    return token;
  }

  // Register token with server
  private async registerTokenWithServer(token: string): Promise<void> {
    try {
      await settingsApi.updateFcmToken(token);
      console.log('Push token registered with server');
    } catch (error) {
      console.error('Error registering push token with server:', error);
    }
  }

  // Handle notification received in foreground
  private handleNotificationReceived = (notification: Notifications.Notification): void => {
    const data = notification.request.content.data as NotificationData;
    console.log('Notification received:', data);

    // You can customize behavior based on notification type
    // For example, don't show message notification if user is in that chat
  };

  // Handle notification tap
  private handleNotificationResponse = (response: Notifications.NotificationResponse): void => {
    const data = response.notification.request.content.data as NotificationData;
    console.log('Notification tapped:', data);

    this.navigateToNotification(data);
  };

  // Navigate based on notification data
  private navigateToNotification(data: NotificationData): void {
    switch (data.type) {
      case 'message':
        if (data.chatId) {
          router.push({ pathname: '/chat/[id]', params: { id: data.chatId } });
        }
        break;
      case 'call':
        if (data.callId) {
          router.push('/call/incoming');
        }
        break;
      case 'group':
        if (data.chatId) {
          router.push({ pathname: '/chat/[id]', params: { id: data.chatId } });
        }
        break;
      default:
        // Navigate to home
        router.push('/');
        break;
    }
  }

  // Get current push token
  getToken(): string | null {
    return this.expoPushToken;
  }

  // Schedule a local notification (for testing)
  async scheduleLocalNotification(title: string, body: string, data?: NotificationData): Promise<string> {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: true },
      trigger: null,
    });
    return id;
  }

  // Cancel all notifications
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  // Get badge count
  async getBadgeCount(): Promise<number> {
    return Notifications.getBadgeCountAsync();
  }

  // Set badge count
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  // Clear badge
  async clearBadge(): Promise<void> {
    await Notifications.setBadgeCountAsync(0);
  }
}

export const notificationService = new NotificationService();
export default notificationService;

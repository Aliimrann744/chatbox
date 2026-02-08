import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import notificationService from '@/services/notifications';

export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] =
    useState<Notifications.Notification | null>(null);

  useEffect(() => {
    // Initialize notifications
    notificationService.initialize().then(() => {
      setExpoPushToken(notificationService.getToken());
    });

    // Listen for incoming notifications
    const notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        setNotification(notification);
      }
    );

    return () => {
      notificationService.cleanup();
      Notifications.removeNotificationSubscription(notificationListener);
    };
  }, []);

  return {
    expoPushToken,
    notification,
    scheduleNotification: notificationService.scheduleLocalNotification.bind(
      notificationService
    ),
    clearBadge: notificationService.clearBadge.bind(notificationService),
    setBadgeCount: notificationService.setBadgeCount.bind(notificationService),
  };
}

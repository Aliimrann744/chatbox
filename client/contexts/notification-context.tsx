import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import notificationService, { NotificationData } from '@/services/notifications';
import { useAuth } from '@/contexts/auth-context';

interface NotificationContextType {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  badgeCount: number;
  clearBadge: () => Promise<void>;
  setBadgeCount: (count: number) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] =
    useState<Notifications.Notification | null>(null);
  const [badgeCount, setBadgeCountState] = useState(0);

  // Initialize notifications when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      notificationService.initialize().then(() => {
        setExpoPushToken(notificationService.getToken());
      });

      // Get initial badge count
      notificationService.getBadgeCount().then(setBadgeCountState);
    }

    return () => {
      notificationService.cleanup();
    };
  }, [isAuthenticated]);

  // Listen for notifications
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(
      (receivedNotification) => {
        setNotification(receivedNotification);

        // Update badge count
        notificationService.getBadgeCount().then(setBadgeCountState);
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  const clearBadge = async () => {
    await notificationService.clearBadge();
    setBadgeCountState(0);
  };

  const setBadgeCount = async (count: number) => {
    await notificationService.setBadgeCount(count);
    setBadgeCountState(count);
  };

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notification,
        badgeCount,
        clearBadge,
        setBadgeCount,
      }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      'useNotificationContext must be used within a NotificationProvider'
    );
  }
  return context;
}

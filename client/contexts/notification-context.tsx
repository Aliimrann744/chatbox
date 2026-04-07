import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import notificationService, { setActiveChatId } from '@/services/notifications';
import { useAuth } from '@/contexts/auth-context';
import { router } from 'expo-router';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

interface NotificationContextType {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  badgeCount: number;
  clearBadge: () => Promise<void>;
  setBadgeCount: (count: number) => Promise<void>;
  setCurrentChatId: (chatId: string | null) => void;
  pendingCallAccept: PendingCall | null;
  clearPendingCall: () => void;
}

interface PendingCall {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callType: 'VOICE' | 'VIDEO';
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
  const [pendingCallAccept, setPendingCallAccept] = useState<PendingCall | null>(null);

  // Initialize notifications when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      notificationService.initialize().then(() => {
        setExpoPushToken(notificationService.getToken());
      });

      notificationService.getBadgeCount().then(setBadgeCountState);
    }

    return () => {
      notificationService.cleanup();
    };
  }, [isAuthenticated]);

  // Check for pending call acceptance from background notification action
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkPendingCall = () => {
      try {
        const pendingCallData = storage.getString('pending_call_accept');
        if (pendingCallData) {
          const data = JSON.parse(pendingCallData) as PendingCall;
          setPendingCallAccept(data);
          storage.delete('pending_call_accept');
        }
      } catch (e) {
        console.warn('Error checking pending call:', e);
      }
    };

    // Check immediately and also after a short delay (app may still be booting)
    checkPendingCall();
    const timer = setTimeout(checkPendingCall, 1000);

    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  // Listen for foreground notifications
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(
      (receivedNotification) => {
        setNotification(receivedNotification);
        notificationService.getBadgeCount().then(setBadgeCountState);
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  // Handle Notifee foreground events (accept/decline call from notification)
  useEffect(() => {
    try {
      const notifee = require('@notifee/react-native').default;
      const { EventType } = require('@notifee/react-native');

      const unsubscribe = notifee.onForegroundEvent(({ type, detail }: any) => {
        const { notification: notif, pressAction } = detail;
        const data = notif?.data;

        if (type === EventType.ACTION_PRESS) {
          if (pressAction?.id === 'accept_call' && data?.callId) {
            setPendingCallAccept({
              callId: data.callId,
              callerId: data.callerId,
              callerName: data.callerName,
              callerAvatar: data.callerAvatar,
              callType: data.callType,
            });
            notifee.cancelNotification(notif?.id);
          }

          if (pressAction?.id === 'decline_call' && data?.callId) {
            notifee.cancelNotification(notif?.id);
            // Decline is handled by call-context timeout
          }
        }

        if (type === EventType.PRESS && data?.type) {
          // Notification body pressed — navigate
          notificationService.navigateToNotification(data);
          notifee.cancelNotification(notif?.id);
        }
      });

      return () => unsubscribe();
    } catch (e) {
      // Notifee not available
    }
  }, []);

  const setCurrentChatId = useCallback((chatId: string | null) => {
    setActiveChatId(chatId);
  }, []);

  const clearBadge = async () => {
    await notificationService.clearBadge();
    setBadgeCountState(0);
  };

  const setBadgeCount = async (count: number) => {
    await notificationService.setBadgeCount(count);
    setBadgeCountState(count);
  };

  const clearPendingCall = useCallback(() => {
    setPendingCallAccept(null);
    storage.delete('pending_call_accept');
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notification,
        badgeCount,
        clearBadge,
        setBadgeCount,
        setCurrentChatId,
        pendingCallAccept,
        clearPendingCall,
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

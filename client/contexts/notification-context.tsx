import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import notificationService, { setActiveChatId, getActiveChatId } from '@/services/notifications';
import { useAuth } from '@/contexts/auth-context';
import socketService from '@/services/socket';
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

// Helper to get a preview text from message type
function getMessagePreview(message: any): string {
  switch (message.type) {
    case 'TEXT':
      return message.content?.substring(0, 100) || 'New message';
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
    case 'CALL':
      return '📞 Call';
    default:
      return message.content || 'New message';
  }
}

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, user } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] =
    useState<Notifications.Notification | null>(null);
  const [badgeCount, setBadgeCountState] = useState(0);
  const [pendingCallAccept, setPendingCallAccept] = useState<PendingCall | null>(null);

  // ==================== Check MMKV for pending call accept ====================
  const checkPendingCall = useCallback(() => {
    try {
      const pendingCallData = storage.getString('pending_call_accept');
      if (pendingCallData) {
        console.log('[NotificationContext] Found pending call accept in MMKV:', pendingCallData);
        const data = JSON.parse(pendingCallData) as PendingCall;
        setPendingCallAccept(data);
        storage.delete('pending_call_accept');
      }
    } catch (e) {
      console.warn('[NotificationContext] Error checking pending call:', e);
    }
  }, []);

  // ==================== Check Notifee getInitialNotification (cold start) ====================
  const checkInitialNotification = useCallback(async () => {
    try {
      const notifee = require('@notifee/react-native').default;
      const initialNotification = await notifee.getInitialNotification();

      if (initialNotification) {
        const { notification: notif, pressAction } = initialNotification;
        const data = notif?.data;

        console.log('[NotificationContext] Initial notification:', {
          pressActionId: pressAction?.id,
          dataType: data?.type,
          callId: data?.callId,
        });

        // App was launched by tapping call notification or Accept button
        if (data?.type === 'call' && data?.callId) {
          if (pressAction?.id === 'accept_call' || pressAction?.id === 'default') {
            console.log('[NotificationContext] Cold start: accepting call from initial notification');
            setPendingCallAccept({
              callId: data.callId,
              callerId: data.callerId,
              callerName: data.callerName,
              callerAvatar: data.callerAvatar,
              callType: data.callType,
            });
          }
        }

        // Non-call notification tap on cold start — navigate
        if (data?.type && data.type !== 'call') {
          notificationService.navigateToNotification(data);
        }
      }
    } catch (e) {
      console.warn('[NotificationContext] getInitialNotification error:', e);
    }
  }, []);

  // ==================== Initialize on auth ====================
  useEffect(() => {
    if (isAuthenticated) {
      notificationService.initialize().then(() => {
        setExpoPushToken(notificationService.getToken());
      });

      notificationService.getBadgeCount().then(setBadgeCountState);

      // Check for pending call from background handler (MMKV)
      checkPendingCall();
      // Also check after a short delay (app may still be booting)
      const timer1 = setTimeout(checkPendingCall, 1000);
      const timer2 = setTimeout(checkPendingCall, 2500);

      // Check for cold start notification (app launched from notification tap)
      checkInitialNotification();
    }

    return () => {
      notificationService.cleanup();
    };
  }, [isAuthenticated]);

  // ==================== Re-check pending call when app returns to foreground ====================
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!isAuthenticated) return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const wasBackground = appStateRef.current.match(/inactive|background/);

      if (wasBackground && nextAppState === 'active') {
        console.log('[NotificationContext] App returned to foreground, checking pending calls');
        // Re-check MMKV — background handler may have stored a pending call while app was in background
        checkPendingCall();
        // Also check again after a short delay
        setTimeout(checkPendingCall, 500);
      }

      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [isAuthenticated, checkPendingCall]);

  // ==================== Global socket listener for local notifications ====================
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    console.log('[NotificationContext] Setting up global socket message listener');

    const unsubscribe = socketService.on('new_message', (message: any) => {
      console.log('[NotificationContext] Socket new_message received:', {
        messageId: message.id,
        chatId: message.chatId,
        senderId: message.senderId,
        type: message.type,
        senderName: message.sender?.name,
      });

      // Don't notify for own messages
      if (message.senderId === user.id) {
        console.log('[NotificationContext] Skipped — own message');
        return;
      }

      const activeChatId = getActiveChatId();
      console.log('[NotificationContext] Active chat:', activeChatId, '| Message chat:', message.chatId);

      // Don't notify if user is viewing this chat
      if (message.chatId === activeChatId) {
        console.log('[NotificationContext] Skipped — user is viewing this chat');
        return;
      }

      // Build notification content
      const senderName = message.sender?.name || 'Someone';
      const preview = getMessagePreview(message);

      const isGroup = message.chat?.type === 'GROUP';
      const groupName = message.chat?.name;

      const title = isGroup && groupName ? groupName : senderName;
      const body = isGroup && groupName ? `${senderName}: ${preview}` : preview;

      console.log('[NotificationContext] Showing local notification:', { title, body });

      notificationService.displayNotification(title, body, {
        type: isGroup ? 'group' : 'message',
        chatId: message.chatId,
        senderId: message.senderId,
        senderName,
      });
    });

    return () => {
      console.log('[NotificationContext] Cleaning up socket message listener');
      unsubscribe();
    };
  }, [isAuthenticated, user]);

  // ==================== Listen for foreground expo notifications ====================
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(
      (receivedNotification) => {
        console.log('[NotificationContext] Expo notification received');
        setNotification(receivedNotification);
        notificationService.getBadgeCount().then(setBadgeCountState);
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  // ==================== Handle Notifee foreground events ====================
  useEffect(() => {
    try {
      const notifee = require('@notifee/react-native').default;
      const { EventType } = require('@notifee/react-native');

      const unsubscribe = notifee.onForegroundEvent(({ type, detail }: any) => {
        const { notification: notif, pressAction } = detail;
        const data = notif?.data;

        console.log('[NotificationContext] Notifee foreground event:', {
          type,
          pressActionId: pressAction?.id,
          dataType: data?.type,
        });

        // Accept call button pressed while app is in foreground
        if (type === EventType.ACTION_PRESS && pressAction?.id === 'accept_call' && data?.callId) {
          console.log('[NotificationContext] Foreground: Accept call pressed');
          setPendingCallAccept({
            callId: data.callId,
            callerId: data.callerId,
            callerName: data.callerName,
            callerAvatar: data.callerAvatar,
            callType: data.callType,
          });
          notifee.cancelNotification(notif?.id);
          return;
        }

        // Decline call button pressed
        if (type === EventType.ACTION_PRESS && pressAction?.id === 'decline_call' && data?.callId) {
          console.log('[NotificationContext] Foreground: Decline call pressed');
          notifee.cancelNotification(notif?.id);
          return;
        }

        // Notification body tapped — for calls, treat as accept; for messages, navigate
        if (type === EventType.PRESS) {
          if (data?.type === 'call' && data?.callId) {
            console.log('[NotificationContext] Foreground: Call notification tapped — accepting');
            setPendingCallAccept({
              callId: data.callId,
              callerId: data.callerId,
              callerName: data.callerName,
              callerAvatar: data.callerAvatar,
              callType: data.callType,
            });
          } else if (data?.type) {
            notificationService.navigateToNotification(data);
          }
          notifee.cancelNotification(notif?.id);
        }
      });

      return () => unsubscribe();
    } catch (e) {
      console.warn('[NotificationContext] Notifee foreground events not available:', e);
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

/**
 * Background message handler for FCM data-only messages.
 * This runs as a headless JS task even when the app is killed.
 *
 * MUST be registered at app entry point (before React tree mounts).
 */

export function registerBackgroundHandler() {
  try {
    const { getMessaging, setBackgroundMessageHandler } = require('@react-native-firebase/messaging');

    setBackgroundMessageHandler(getMessaging(), async (remoteMessage: any) => {
      console.log('[Background] FCM message:', remoteMessage);

      const data = remoteMessage.data;
      if (!data) return;

      if (data.type === 'call') {
        await handleBackgroundCallNotification(data);
      }

      // Send delivery receipt to server for message notifications
      if (data.type === 'message' || data.type === 'group') {
        await sendDeliveryReceipt(data.chatId);
      }
    });

    console.log('[Background] Message handler registered');
  } catch (e) {
    console.warn('[Background] Could not register handler:', e);
  }
}

/**
 * Send delivery receipt to server via REST API.
 */
async function sendDeliveryReceipt(chatId: string) {
  if (!chatId) return;

  try {
    const SecureStore = require('expo-secure-store');
    const { TOKEN_KEY, API_BASE_URL } = require('@/constants/constant');

    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token || !API_BASE_URL) return;

    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/deliver`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    });

    console.log('[Background] Delivery receipt sent for chat:', chatId, 'status:', response.status);
  } catch (e) {
    console.warn('[Background] Delivery receipt failed:', e);
  }
}

async function handleBackgroundCallNotification(data: any) {
  try {
    const notifee = require('@notifee/react-native').default;
    const { AndroidImportance, AndroidCategory } = require('@notifee/react-native');

    const callLabel = data.callType === 'VIDEO' ? 'Video Call' : 'Voice Call';

    // Show full-screen incoming call notification
    await notifee.displayNotification({
      id: `call_${data.callId}`,
      title: `Incoming ${callLabel}`,
      body: data.callerName || 'Someone is calling...',
      data: data,
      android: {
        channelId: 'calls',
        category: AndroidCategory.CALL,
        importance: AndroidImportance.HIGH,
        fullScreenAction: {
          id: 'accept_call',
          launchActivity: 'default',
        },
        ongoing: true,
        autoCancel: false,
        color: '#25D366',
        sound: 'default',
        pressAction: {
          id: 'accept_call',
          launchActivity: 'default',
        },
        actions: [
          {
            title: 'Decline',
            pressAction: { id: 'decline_call' },
          },
          {
            title: 'Accept',
            pressAction: {
              id: 'accept_call',
              launchActivity: 'default',
            },
          },
        ],
      },
    });

    // Auto-cancel after 30 seconds (call timeout)
    setTimeout(async () => {
      try {
        await notifee.cancelNotification(`call_${data.callId}`);
      } catch (e) {}
    }, 30000);
  } catch (e) {
    console.error('[Background] Call notification error:', e);
  }
}

/**
 * Store pending call accept data so the foreground app can pick it up.
 */
function storePendingCallAccept(data: any) {
  try {
    const { MMKV } = require('react-native-mmkv');
    const storage = new MMKV();
    const payload = JSON.stringify({
      callId: data.callId,
      callerId: data.callerId,
      callerName: data.callerName,
      callerAvatar: data.callerAvatar,
      callType: data.callType,
    });
    storage.set('pending_call_accept', payload);
    console.log('[Background] Stored pending call accept:', payload);
  } catch (e) {
    console.warn('[Background] Could not store pending call:', e);
  }
}

/**
 * Handle Notifee background events (notification actions like Accept/Decline)
 */
export function registerNotifeeBackgroundHandler() {
  try {
    const notifee = require('@notifee/react-native').default;
    const { EventType } = require('@notifee/react-native');

    notifee.onBackgroundEvent(async ({ type, detail }: any) => {
      const { notification, pressAction } = detail;
      const data = notification?.data;

      console.log('[Background] Notifee event:', { type, pressActionId: pressAction?.id, dataType: data?.type });

      // Handle Accept button press
      if (type === EventType.ACTION_PRESS && pressAction?.id === 'accept_call' && data?.callId) {
        console.log('[Background] Accept call button pressed');
        storePendingCallAccept(data);
        await notifee.cancelNotification(notification?.id);
        return;
      }

      // Handle Decline button press
      if (type === EventType.ACTION_PRESS && pressAction?.id === 'decline_call' && data?.callId) {
        console.log('[Background] Decline call button pressed');
        await notifee.cancelNotification(notification?.id);
        return;
      }

      // Handle notification body tap or fullScreenAction — treat as accept for calls
      if (type === EventType.PRESS && data?.type === 'call' && data?.callId) {
        console.log('[Background] Call notification body tapped — treating as accept');
        storePendingCallAccept(data);
        await notifee.cancelNotification(notification?.id);
        return;
      }

      // Handle notification dismissed
      if (type === EventType.DISMISSED && data?.type === 'call') {
        await notifee.cancelNotification(notification?.id);
      }
    });

    console.log('[Background] Notifee handler registered');
  } catch (e) {
    console.warn('[Background] Could not register Notifee handler:', e);
  }
}

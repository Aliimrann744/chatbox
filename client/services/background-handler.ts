/**
 * Background message handler for FCM data-only messages.
 * This runs as a headless JS task even when the app is killed.
 *
 * MUST be registered at app entry point (before React tree mounts).
 */

export function registerBackgroundHandler() {
  try {
    const messaging = require('@react-native-firebase/messaging').default;

    messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
      console.log('Background FCM message:', remoteMessage);

      const data = remoteMessage.data;
      if (!data) return;

      if (data.type === 'call') {
        await handleBackgroundCallNotification(data);
      }
      // Regular message notifications with `notification` key are shown automatically by Android
      // Data-only messages for messages don't need special handling in background
    });

    console.log('Background message handler registered');
  } catch (e) {
    console.warn('Could not register background message handler:', e);
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
        // Full-screen intent — shows call UI over lockscreen
        fullScreenAction: {
          id: 'default',
          launchActivity: 'default',
        },
        ongoing: true,
        autoCancel: false,
        smallIcon: 'ic_notification',
        color: '#25D366',
        pressAction: {
          id: 'default',
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

    // Also display via CallKeep for native phone UI integration
    try {
      const RNCallKeep = require('react-native-callkeep').default;
      RNCallKeep.displayIncomingCall(
        data.callId,
        data.callerName || 'Unknown',
        data.callerName || 'Unknown',
        'generic',
        data.callType === 'VIDEO',
      );
    } catch (e) {
      console.warn('CallKeep not available in background:', e);
    }

    // Auto-cancel notification after 30 seconds (call timeout)
    setTimeout(async () => {
      try {
        await notifee.cancelNotification(`call_${data.callId}`);
      } catch (e) {}
    }, 30000);
  } catch (e) {
    console.error('Background call notification error:', e);
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

      if (type === EventType.ACTION_PRESS) {
        const data = notification?.data;

        if (pressAction?.id === 'accept_call' && data?.callId) {
          // User pressed Accept — app will launch and CallContext will handle
          // Store the pending call acceptance for the app to pick up
          try {
            const { MMKV } = require('react-native-mmkv');
            const storage = new MMKV();
            storage.set('pending_call_accept', JSON.stringify({
              callId: data.callId,
              callerId: data.callerId,
              callerName: data.callerName,
              callerAvatar: data.callerAvatar,
              callType: data.callType,
            }));
          } catch (e) {
            console.warn('Could not store pending call:', e);
          }

          // Cancel the notification
          await notifee.cancelNotification(notification?.id);
        }

        if (pressAction?.id === 'decline_call' && data?.callId) {
          // Cancel the notification
          await notifee.cancelNotification(notification?.id);

          // End CallKeep display
          try {
            const RNCallKeep = require('react-native-callkeep').default;
            RNCallKeep.endCall(data.callId);
          } catch (e) {}
        }
      }

      if (type === EventType.DISMISSED && detail.notification?.data?.type === 'call') {
        // Notification dismissed — treat as decline
        await notifee.cancelNotification(notification?.id);
      }
    });

    console.log('Notifee background handler registered');
  } catch (e) {
    console.warn('Could not register Notifee background handler:', e);
  }
}

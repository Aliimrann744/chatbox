import { useEffect } from 'react';
import { router } from 'expo-router';
import { useCall } from '@/contexts/call-context';
import { useNotificationContext } from '@/contexts/notification-context';

/**
 * This component listens for incoming calls and navigates to the incoming call screen.
 * Also handles pending call accepts from background notification actions.
 * It should be placed in the root layout to work globally.
 */
export function IncomingCallListener() {
  const { callState, acceptCall, acceptCallFromNotification } = useCall();
  const { pendingCallAccept, clearPendingCall } = useNotificationContext();

  // Navigate to incoming call screen when there's an incoming call via socket
  useEffect(() => {
    if (callState.status === 'ringing' && callState.direction === 'incoming') {
      router.push('/call/incoming');
    }
  }, [callState.status, callState.direction]);

  // Handle pending call accept from background notification
  useEffect(() => {
    if (!pendingCallAccept) return;

    console.log('[IncomingCallListener] Pending call accept:', pendingCallAccept, 'callState:', callState.status);

    if (callState.status === 'ringing' && callState.callId === pendingCallAccept.callId) {
      // Socket incoming_call already arrived — accept normally
      console.log('[IncomingCallListener] Call already ringing, accepting...');
      acceptCall();
      clearPendingCall();
      router.push('/call/active');
    } else if (callState.status === 'idle' || callState.status === 'ended') {
      // Socket incoming_call was missed (app was in background) —
      // accept directly from notification data without waiting for socket event
      console.log('[IncomingCallListener] Accepting call directly from notification data...');
      clearPendingCall();
      acceptCallFromNotification({
        callId: pendingCallAccept.callId,
        callerId: pendingCallAccept.callerId,
        callerName: pendingCallAccept.callerName,
        callerAvatar: pendingCallAccept.callerAvatar,
        callType: pendingCallAccept.callType as 'VOICE' | 'VIDEO',
      });
      router.push('/call/active');
    }
  }, [pendingCallAccept, callState.status, callState.callId]);

  return null;
}

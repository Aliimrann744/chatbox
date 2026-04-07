import { useEffect } from 'react';
import { router } from 'expo-router';
import { useCall } from '@/contexts/call-context';
import { useNotificationContext } from '@/contexts/notification-context';
import socketService from '@/services/socket';

/**
 * This component listens for incoming calls and navigates to the incoming call screen.
 * Also handles pending call accepts from background notification actions.
 * It should be placed in the root layout to work globally.
 */
export function IncomingCallListener() {
  const { callState, acceptCall } = useCall();
  const { pendingCallAccept, clearPendingCall } = useNotificationContext();

  // Navigate to incoming call screen when there's an incoming call
  useEffect(() => {
    if (callState.status === 'ringing' && callState.direction === 'incoming') {
      router.push('/call/incoming');
    }
  }, [callState.status, callState.direction]);

  // Handle pending call accept from background notification
  useEffect(() => {
    if (pendingCallAccept && callState.status === 'ringing' && callState.callId === pendingCallAccept.callId) {
      // User accepted call from notification — auto-accept
      acceptCall();
      clearPendingCall();
      router.push('/call/active');
    } else if (pendingCallAccept && callState.status === 'idle') {
      // App launched from killed state with a pending call accept
      // The incoming_call socket event hasn't arrived yet — wait briefly
      const timer = setTimeout(() => {
        if (callState.status === 'idle') {
          // Socket event never came — call may have ended
          clearPendingCall();
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [pendingCallAccept, callState.status, callState.callId]);

  return null;
}

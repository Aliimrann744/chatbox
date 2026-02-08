import { useEffect } from 'react';
import { router } from 'expo-router';
import { useCall } from '@/contexts/call-context';

/**
 * This component listens for incoming calls and navigates to the incoming call screen.
 * It should be placed in the root layout to work globally.
 */
export function IncomingCallListener() {
  const { callState } = useCall();

  useEffect(() => {
    // Navigate to incoming call screen when there's an incoming call
    if (callState.status === 'ringing' && callState.direction === 'incoming') {
      router.push('/call/incoming');
    }
  }, [callState.status, callState.direction]);

  return null;
}

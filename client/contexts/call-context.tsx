import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import socketService from '@/services/socket';
import { useAuth } from '@/contexts/auth-context';

export type CallType = 'VOICE' | 'VIDEO';
export type CallStatus = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended';
export type CallDirection = 'incoming' | 'outgoing';

interface CallParticipant {
  id: string;
  name: string;
  avatar?: string;
}

interface CallState {
  callId: string | null;
  type: CallType;
  status: CallStatus;
  direction: CallDirection;
  participant: CallParticipant | null;
  startTime: Date | null;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isVideoEnabled: boolean;
}

interface CallContextType {
  callState: CallState;
  initiateCall: (receiverId: string, receiverName: string, receiverAvatar: string | undefined, type: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleVideo: () => void;
  localStream: any | null;
  remoteStream: any | null;
}

const initialCallState: CallState = {
  callId: null,
  type: 'VOICE',
  status: 'idle',
  direction: 'outgoing',
  participant: null,
  startTime: null,
  isMuted: false,
  isSpeakerOn: false,
  isVideoEnabled: true,
};

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>(initialCallState);
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset call state
  const resetCallState = useCallback(() => {
    setCallState(initialCallState);
    setLocalStream(null);
    setRemoteStream(null);

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
  }, []);

  // Handle incoming call events
  useEffect(() => {
    const unsubscribeIncomingCall = socketService.on('incoming_call', (data: any) => {
      if (callState.status !== 'idle') {
        // Already in a call, decline
        socketService.declineCall(data.callId);
        return;
      }

      setCallState({
        callId: data.callId,
        type: data.type,
        status: 'ringing',
        direction: 'incoming',
        participant: {
          id: data.caller.id,
          name: data.caller.name,
          avatar: data.caller.avatar,
        },
        startTime: null,
        isMuted: false,
        isSpeakerOn: false,
        isVideoEnabled: data.type === 'VIDEO',
      });

      // Auto-decline after 30 seconds if not answered
      callTimeoutRef.current = setTimeout(() => {
        if (callState.status === 'ringing') {
          socketService.declineCall(data.callId);
          resetCallState();
        }
      }, 30000);
    });

    const unsubscribeCallAccepted = socketService.on('call_accepted', async (data: any) => {
      if (data.callId === callState.callId) {
        setCallState((prev) => ({
          ...prev,
          status: 'connecting',
        }));
      }
    });

    const unsubscribeCallDeclined = socketService.on('call_declined', (data: any) => {
      if (data.callId === callState.callId) {
        Alert.alert('Call Declined', 'The user declined your call.');
        resetCallState();
      }
    });

    const unsubscribeCallBusy = socketService.on('call_busy', (data: any) => {
      if (data.callId === callState.callId) {
        Alert.alert('User Busy', 'The user is currently on another call.');
        resetCallState();
      }
    });

    const unsubscribeCallEnded = socketService.on('call_ended', (data: any) => {
      if (data.callId === callState.callId) {
        resetCallState();
      }
    });

    const unsubscribeCallMissed = socketService.on('call_missed', (data: any) => {
      if (data.callId === callState.callId) {
        Alert.alert('Missed Call', `You missed a call from ${callState.participant?.name}`);
        resetCallState();
      }
    });

    // WebRTC signaling events
    const unsubscribeCallOffer = socketService.on('call_offer', async (data: any) => {
      if (data.callId === callState.callId && peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(data.offer)
          );
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          socketService.sendCallAnswer(data.callId, answer);
        } catch (error) {
          console.error('Error handling call offer:', error);
        }
      }
    });

    const unsubscribeCallAnswer = socketService.on('call_answer', async (data: any) => {
      if (data.callId === callState.callId && peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
        } catch (error) {
          console.error('Error handling call answer:', error);
        }
      }
    });

    const unsubscribeIceCandidate = socketService.on('call_ice_candidate', async (data: any) => {
      if (data.callId === callState.callId && peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    });

    return () => {
      unsubscribeIncomingCall();
      unsubscribeCallAccepted();
      unsubscribeCallDeclined();
      unsubscribeCallBusy();
      unsubscribeCallEnded();
      unsubscribeCallMissed();
      unsubscribeCallOffer();
      unsubscribeCallAnswer();
      unsubscribeIceCandidate();
    };
  }, [callState.callId, callState.status, callState.participant, resetCallState]);

  // Initiate a call
  const initiateCall = useCallback(
    async (receiverId: string, receiverName: string, receiverAvatar: string | undefined, type: CallType) => {
      try {
        setCallState({
          callId: null,
          type,
          status: 'ringing',
          direction: 'outgoing',
          participant: {
            id: receiverId,
            name: receiverName,
            avatar: receiverAvatar,
          },
          startTime: null,
          isMuted: false,
          isSpeakerOn: false,
          isVideoEnabled: type === 'VIDEO',
        });

        const result = await socketService.initiateCall(receiverId, type);

        if (result.success) {
          setCallState((prev) => ({
            ...prev,
            callId: result.callId,
          }));

          // Auto-end call after 60 seconds if not answered
          callTimeoutRef.current = setTimeout(async () => {
            if (callState.status === 'ringing') {
              await socketService.endCall(result.callId);
              resetCallState();
              Alert.alert('No Answer', 'The user did not answer your call.');
            }
          }, 60000);
        } else {
          throw new Error(result.error || 'Failed to initiate call');
        }
      } catch (error) {
        console.error('Error initiating call:', error);
        Alert.alert('Error', 'Failed to initiate call. Please try again.');
        resetCallState();
      }
    },
    [callState.status, resetCallState]
  );

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!callState.callId) return;

    try {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }

      setCallState((prev) => ({
        ...prev,
        status: 'connecting',
      }));

      const result = await socketService.acceptCall(callState.callId);

      if (result.success) {
        setCallState((prev) => ({
          ...prev,
          status: 'connected',
          startTime: new Date(),
        }));
      } else {
        throw new Error(result.error || 'Failed to accept call');
      }
    } catch (error) {
      console.error('Error accepting call:', error);
      Alert.alert('Error', 'Failed to accept call.');
      resetCallState();
    }
  }, [callState.callId, resetCallState]);

  // Decline incoming call
  const declineCall = useCallback(async () => {
    if (!callState.callId) return;

    try {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }

      await socketService.declineCall(callState.callId);
      resetCallState();
    } catch (error) {
      console.error('Error declining call:', error);
      resetCallState();
    }
  }, [callState.callId, resetCallState]);

  // End call
  const endCall = useCallback(async () => {
    if (!callState.callId) return;

    try {
      await socketService.endCall(callState.callId);
      resetCallState();
    } catch (error) {
      console.error('Error ending call:', error);
      resetCallState();
    }
  }, [callState.callId, resetCallState]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    setCallState((prev) => ({
      ...prev,
      isMuted: !prev.isMuted,
    }));

    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach((track: any) => {
        track.enabled = callState.isMuted; // Toggle (opposite of current state)
      });
    }
  }, [localStream, callState.isMuted]);

  // Toggle speaker
  const toggleSpeaker = useCallback(() => {
    setCallState((prev) => ({
      ...prev,
      isSpeakerOn: !prev.isSpeakerOn,
    }));
    // Note: Speaker toggle requires InCallManager which needs native module
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    setCallState((prev) => ({
      ...prev,
      isVideoEnabled: !prev.isVideoEnabled,
    }));

    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach((track: any) => {
        track.enabled = !callState.isVideoEnabled; // Toggle (opposite of current state)
      });
    }
  }, [localStream, callState.isVideoEnabled]);

  return (
    <CallContext.Provider
      value={{
        callState,
        initiateCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMute,
        toggleSpeaker,
        toggleVideo,
        localStream,
        remoteStream,
      }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import {
  createPeerConnection,
  createOffer,
  handleOffer,
  handleAnswer,
  addIceCandidate,
  closePeerConnection,
  InCallManager,
} from '@/utils/webrtc';
import socketService from '@/services/socket';
import { useAuth } from '@/contexts/auth-context';
import {
  setupCallKeep,
  setCallKeepCallbacks,
  displayIncomingCall,
  endCallKeepCall,
  reportConnectedCall,
} from '@/services/callkeep';

export type CallType = 'VOICE' | 'VIDEO';
export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended';
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
  acceptCallFromNotification: (callData: { callId: string; callerId: string; callerName: string; callerAvatar?: string; callType: CallType }) => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleVideo: () => void;
  switchCamera: () => void;
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

// Request camera permission on demand (right before video call)
const ensureCameraPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    try {
      const alreadyGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA,);
      if (alreadyGranted) return true;
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA,);
      if (result === PermissionsAndroid.RESULTS.GRANTED) return true;
      Alert.alert('Camera Permission Required', 'Camera permission is needed for video calls. Please enable it in your device settings.');
      return false;
    } catch (err) {
      console.warn('Camera permission check error:', err);
      return false;
    }
  }
  // iOS: handled by Info.plist NSCameraUsageDescription — system prompts automatically
  return true;
};

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>(initialCallState);
  const [localStream, setLocalStream] = useState<any | null>(null);
  const [remoteStream, setRemoteStream] = useState<any | null>(null);

  const pcRef = useRef<any>(null);
  const localStreamRef = useRef<any | null>(null);
  const iceServersRef = useRef<any[]>([]);
  const pendingCandidatesRef = useRef<any[]>([]);
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs to avoid stale closures in socket listeners
  const callStateRef = useRef(callState);
  callStateRef.current = callState;

  // Request microphone permission and setup CallKeep on mount
  useEffect(() => {
    if (Platform.OS === 'android') {
      PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ).then((result) => {
        console.log('Audio permission:', result);
      }).catch((err) => {
        console.warn('Audio permission request error:', err);
      });
    }

    // Initialize CallKeep for native call UI
    setupCallKeep();

    // Register CallKeep callbacks
    setCallKeepCallbacks({
      onAnswerCall: (callUUID: string) => {
        // User answered from native call UI — accept the call
        const current = callStateRef.current;
        if (current.callId === callUUID && current.status === 'ringing') {
          acceptCall();
        }
      },
      onEndCall: (callUUID: string) => {
        // User ended from native call UI — decline or end the call
        const current = callStateRef.current;
        if (current.callId === callUUID) {
          if (current.status === 'ringing' && current.direction === 'incoming') {
            declineCall();
          } else {
            endCall();
          }
        }
      },
    });
  }, []);

  // Setup peer connection with media
  const setupPeerConnection = useCallback(async (callType: CallType) => {
    if (callType === 'VIDEO') {
      const hasCameraPermission = await ensureCameraPermission();
      if (!hasCameraPermission) {
        throw new Error('Camera permission is required for video calls');
      }
    }

    const { pc, localStreamPromise } = createPeerConnection(
      iceServersRef.current,
      callType,
      {
        onRemoteStream: (stream) => {
          console.log('WebRTC: Remote stream received');
          setRemoteStream(stream);
        },
        onIceCandidate: (candidate) => {
          const callId = callStateRef.current.callId;
          if (callId) {
            socketService.sendIceCandidate(callId, candidate);
          }
        },
        onConnectionStateChange: (state) => {
          console.log('WebRTC: Connection state:', state);
          if (state === 'connected') {
            setCallState((prev) => {
              // Report call as connected to native call UI
              if (prev.callId) {
                reportConnectedCall(prev.callId);
              }
              return {
                ...prev,
                status: 'connected',
                startTime: new Date(),
              };
            });
          } else if (state === 'failed' || state === 'disconnected') {
            console.warn('WebRTC: Connection', state);
          }
        },
      },
    );

    pcRef.current = pc;

    const stream = await localStreamPromise;

    // Verify video tracks for video calls
    if (callType === 'VIDEO') {
      const videoTracks = stream.getVideoTracks();
      console.log('WebRTC: Local video tracks:', videoTracks.length,
        videoTracks.map((t: any) => ({ id: t.id, enabled: t.enabled, readyState: t.readyState })));
      if (videoTracks.length === 0) {
        console.warn('WebRTC: No video tracks in local stream!');
      }
    }

    localStreamRef.current = stream;
    setLocalStream(stream);

    // Drain any buffered ICE candidates
    drainPendingCandidates();

    return pc;
  }, []);

  const drainPendingCandidates = useCallback(() => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;

    const candidates = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];

    candidates.forEach(async (candidate: any) => {
      try {
        await addIceCandidate(pc, candidate);
      } catch (err) {
        console.warn('WebRTC: Failed to add buffered ICE candidate:', err);
      }
    });
  }, []);

  // Reset call state
  const resetCallState = useCallback(() => {
    // End native call UI
    const prevCallId = callStateRef.current.callId;
    if (prevCallId) {
      endCallKeepCall(prevCallId);
    }

    closePeerConnection(pcRef.current, localStreamRef.current);
    pcRef.current = null;
    localStreamRef.current = null;
    pendingCandidatesRef.current = [];

    InCallManager.stop();

    setCallState(initialCallState);
    setLocalStream(null);
    setRemoteStream(null);

    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
  }, []);

  // Socket event listeners — registered ONCE, use refs for fresh state
  useEffect(() => {
    const unsubscribeIncomingCall = socketService.on('incoming_call', (data: any) => {
      if (callStateRef.current.status !== 'idle') {
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

      // Show native incoming call UI via CallKeep
      displayIncomingCall(
        data.callId,
        data.caller.name,
        data.type === 'VIDEO',
      );

      // Cancel any existing Notifee call notification (from background push)
      try {
        const notifee = require('@notifee/react-native').default;
        notifee.cancelNotification(`call_${data.callId}`).catch(() => {});
      } catch (e) {}

      callTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current.status === 'ringing') {
          socketService.declineCall(data.callId);
          endCallKeepCall(data.callId);
          resetCallState();
        }
      }, 30000);
    });

    // Caller receives this when receiver accepts
    const unsubscribeCallAccepted = socketService.on('call_accepted', async (data: any) => {
      const current = callStateRef.current;
      console.log('call_accepted received:', data.callId, 'current callId:', current.callId);

      if (data.callId !== current.callId) return;

      iceServersRef.current = data.iceServers || [];

      setCallState((prev) => ({
        ...prev,
        status: 'connecting',
      }));

      try {
        // Caller creates PC and sends offer
        const pc = await setupPeerConnection(current.type);
        const offer = await createOffer(pc);
        socketService.sendCallOffer(data.callId, offer);

        InCallManager.start({ media: current.type === 'VIDEO' ? 'video' : 'audio' });
        InCallManager.setForceSpeakerphoneOn(current.type === 'VIDEO');
      } catch (err) {
        console.error('WebRTC: Failed to create offer:', err);
        resetCallState();
      }
    });

    // Receiver gets the caller's offer
    const unsubscribeCallOffer = socketService.on('call_offer', async (data: any) => {
      const current = callStateRef.current;
      if (data.callId !== current.callId) return;

      try {
        const pc = await setupPeerConnection(current.type);
        const answer = await handleOffer(pc, data.offer);
        socketService.sendCallAnswer(data.callId, answer);

        // Drain candidates now that remoteDescription is set
        drainPendingCandidates();
      } catch (err) {
        console.error('WebRTC: Failed to handle offer:', err);
        resetCallState();
      }
    });

    // Caller gets the receiver's answer
    const unsubscribeCallAnswer = socketService.on('call_answer', async (data: any) => {
      const current = callStateRef.current;
      if (data.callId !== current.callId) return;

      try {
        await handleAnswer(pcRef.current, data.answer);
        // Drain candidates now that remoteDescription is set
        drainPendingCandidates();
      } catch (err) {
        console.error('WebRTC: Failed to handle answer:', err);
      }
    });

    // Both sides receive ICE candidates
    const unsubscribeIceCandidate = socketService.on('call_ice_candidate', async (data: any) => {
      const current = callStateRef.current;
      if (data.callId !== current.callId) return;

      const pc = pcRef.current;
      if (pc && pc.remoteDescription) {
        try {
          await addIceCandidate(pc, data.candidate);
        } catch (err) {
          console.warn('WebRTC: Failed to add ICE candidate:', err);
        }
      } else {
        // Buffer for later
        pendingCandidatesRef.current.push(data.candidate);
      }
    });

    const unsubscribeCallDeclined = socketService.on('call_declined', (data: any) => {
      if (data.callId === callStateRef.current.callId) {
        Alert.alert('Call Declined', 'The user declined your call.');
        resetCallState();
      }
    });

    const unsubscribeCallBusy = socketService.on('call_busy', (data: any) => {
      if (data.callId === callStateRef.current.callId) {
        Alert.alert('User Busy', 'The user is currently on another call.');
        resetCallState();
      }
    });

    const unsubscribeCallEnded = socketService.on('call_ended', (data: any) => {
      if (data.callId === callStateRef.current.callId) {
        resetCallState();
      }
    });

    const unsubscribeCallMissed = socketService.on('call_missed', (data: any) => {
      if (data.callId === callStateRef.current.callId) {
        Alert.alert('Missed Call', `You missed a call from ${callStateRef.current.participant?.name}`);
        resetCallState();
      }
    });

    return () => {
      unsubscribeIncomingCall();
      unsubscribeCallAccepted();
      unsubscribeCallOffer();
      unsubscribeCallAnswer();
      unsubscribeIceCandidate();
      unsubscribeCallDeclined();
      unsubscribeCallBusy();
      unsubscribeCallEnded();
      unsubscribeCallMissed();
    };
  }, [resetCallState, setupPeerConnection, drainPendingCandidates]);

  // Initiate a call
  const initiateCall = useCallback(
    async (receiverId: string, receiverName: string, receiverAvatar: string | undefined, type: CallType) => {
      try {
        setCallState({
          callId: null,
          type,
          status: 'calling',
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
          // Always set callId and ringing status — even if receiver appears offline,
          // they may receive the call via FCM push notification (WhatsApp behavior)
          setCallState((prev) => ({
            ...prev,
            callId: result.callId,
            status: 'ringing',
          }));

          // Timeout: if no answer within 60 seconds, end the call
          callTimeoutRef.current = setTimeout(async () => {
            if (callStateRef.current.status === 'calling' || callStateRef.current.status === 'ringing') {
              await socketService.endCall(result.callId);
              resetCallState();
              Alert.alert('No Answer', 'The user did not answer your call.');
            }
          }, 60000);
        } else {
          throw new Error(result.error || 'Failed to initiate call');
        }
      } catch (error: any) {
        console.error('Error initiating call:', error);
        const msg = error?.message || error?.error || 'Failed to initiate call. Please try again.';
        Alert.alert('Error', msg);
        resetCallState();
      }
    },
    [resetCallState]
  );

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    const currentCallId = callStateRef.current.callId;
    if (!currentCallId) return;

    try {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }

      setCallState((prev) => ({
        ...prev,
        status: 'connecting',
      }));

      const result = await socketService.acceptCall(currentCallId);
      console.log('acceptCall result:', result.success, 'has iceServers:', !!result.iceServers);

      if (result.success && result.iceServers) {
        // Store ICE servers — PC will be created when we receive the caller's offer
        iceServersRef.current = result.iceServers;

        InCallManager.start({
          media: callStateRef.current.type === 'VIDEO' ? 'video' : 'audio',
        });
        InCallManager.setForceSpeakerphoneOn(callStateRef.current.type === 'VIDEO');
      } else {
        throw new Error(result.error || 'Failed to accept call');
      }
    } catch (error) {
      console.error('Error accepting call:', error);
      Alert.alert('Error', 'Failed to accept call.');
      resetCallState();
    }
  }, [resetCallState]);

  // Accept call directly from background notification data
  // (bypasses the socket incoming_call event which was missed while app was in background)
  const acceptCallFromNotification = useCallback(async (callData: {
    callId: string;
    callerId: string;
    callerName: string;
    callerAvatar?: string;
    callType: CallType;
  }) => {
    console.log('acceptCallFromNotification:', callData);

    try {
      // Set call state from notification data
      setCallState({
        callId: callData.callId,
        type: callData.callType,
        status: 'connecting',
        direction: 'incoming',
        participant: {
          id: callData.callerId,
          name: callData.callerName,
          avatar: callData.callerAvatar,
        },
        startTime: null,
        isMuted: false,
        isSpeakerOn: false,
        isVideoEnabled: callData.callType === 'VIDEO',
      });

      // Ensure socket is connected — use connect() NOT reconnect()
      // reconnect() calls disconnect() first, which triggers server handleDisconnect
      // which kills the active call before we can accept it
      if (!socketService.isCallConnected) {
        console.log('Call socket not connected, connecting...');
        await socketService.connect();
        // Wait for socket to connect
        await new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            if (socketService.isCallConnected) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 200);
          // Timeout after 5 seconds
          setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
          }, 5000);
        });
      }

      if (!socketService.isCallConnected) {
        throw new Error('Could not connect to call server');
      }

      console.log('Call socket connected, sending call_accept...');

      // Accept the call via socket
      const result = await socketService.acceptCall(callData.callId);
      console.log('acceptCallFromNotification result:', result.success, 'has iceServers:', !!result.iceServers);

      if (result.success && result.iceServers) {
        iceServersRef.current = result.iceServers;

        InCallManager.start({
          media: callData.callType === 'VIDEO' ? 'video' : 'audio',
        });
        InCallManager.setForceSpeakerphoneOn(callData.callType === 'VIDEO');
      } else {
        throw new Error(result.error || 'Call is no longer available');
      }
    } catch (error: any) {
      console.error('Error accepting call from notification:', error);
      Alert.alert('Call Ended', 'The call is no longer available.');
      resetCallState();
    }
  }, [resetCallState, setupPeerConnection]);

  // Decline incoming call
  const declineCall = useCallback(async () => {
    const currentCallId = callStateRef.current.callId;
    if (!currentCallId) {
      // No callId — just reset state (stale call)
      resetCallState();
      return;
    }

    try {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }

      // Ensure socket is connected before declining
      if (!socketService.isCallConnected) {
        console.log('Call socket not connected, reconnecting before decline...');
        await socketService.reconnect();
        // Wait briefly for reconnection
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      await socketService.declineCall(currentCallId);
    } catch (error) {
      console.error('Error declining call:', error);
    }
    // Always reset state regardless of socket success
    resetCallState();
  }, [resetCallState]);

  // End call
  const endCall = useCallback(async () => {
    const currentCallId = callStateRef.current.callId;
    if (!currentCallId) {
      resetCallState();
      return;
    }

    try {
      // Ensure socket is connected before ending
      if (!socketService.isCallConnected) {
        console.log('Call socket not connected, reconnecting before end...');
        await socketService.reconnect();
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      await socketService.endCall(currentCallId);
    } catch (error) {
      console.error('Error ending call:', error);
    }
    // Always reset state regardless of socket success
    resetCallState();
  }, [resetCallState]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const newMuted = !callStateRef.current.isMuted;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !newMuted;
    }
    setCallState((prev) => ({
      ...prev,
      isMuted: newMuted,
    }));
  }, []);

  // Toggle speaker
  const toggleSpeaker = useCallback(() => {
    const newSpeaker = !callStateRef.current.isSpeakerOn;
    InCallManager.setSpeakerphoneOn(newSpeaker);
    setCallState((prev) => ({
      ...prev,
      isSpeakerOn: newSpeaker,
    }));
  }, []);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const newEnabled = !callStateRef.current.isVideoEnabled;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = newEnabled;
    }
    setCallState((prev) => ({
      ...prev,
      isVideoEnabled: newEnabled,
    }));
  }, []);

  // Switch camera
  const switchCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const videoTrack = stream.getVideoTracks()[0] as any;
    if (videoTrack && videoTrack._switchCamera) {
      videoTrack._switchCamera();
    }
  }, []);

  return (
    <CallContext.Provider
      value={{
        callState,
        initiateCall,
        acceptCall,
        acceptCallFromNotification,
        declineCall,
        endCall,
        toggleMute,
        toggleSpeaker,
        toggleVideo,
        switchCamera,
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

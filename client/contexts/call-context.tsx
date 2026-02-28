import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import {
  createAgoraRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  isAgoraAvailable,
} from '@/utils/agora';
import type { IRtcEngine } from '@/utils/agora';
import socketService from '@/services/socket';
import { useAuth } from '@/contexts/auth-context';

const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID || '';

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
  switchCamera: () => void;
  remoteUid: number | null;
  localUid: number | null;
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
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [localUid, setLocalUid] = useState<number | null>(null);

  const engineRef = useRef<IRtcEngine | null>(null);
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs to avoid stale closures in socket listeners
  const callStateRef = useRef(callState);
  callStateRef.current = callState;

  // Initialize Agora engine on mount
  useEffect(() => {
    if (!isAgoraAvailable || !AGORA_APP_ID) {
      if (!isAgoraAvailable) console.warn('Agora SDK not available on this platform. Call signaling only.');
      else console.warn('Agora App ID not configured. Calls will not work.');
      return;
    }

    const initEngine = async () => {
      // Request Android permissions
      if (Platform.OS === 'android') {
        try {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            PermissionsAndroid.PERMISSIONS.CAMERA,
          ]);
        } catch (err) {
          console.warn('Permission request error:', err);
        }
      }

      try {
        const engine = createAgoraRtcEngine();
        engine.initialize({ appId: AGORA_APP_ID });

        engine.registerEventHandler({
          onJoinChannelSuccess: (_connection, elapsed) => {
            console.log('Agora: Joined channel successfully', elapsed);
            setCallState((prev) => ({
              ...prev,
              status: 'connected',
              startTime: new Date(),
            }));
          },
          onUserJoined: (_connection, uid) => {
            console.log('Agora: Remote user joined', uid);
            setRemoteUid(uid);
          },
          onUserOffline: (_connection, uid) => {
            console.log('Agora: Remote user offline', uid);
            setRemoteUid(null);
          },
          onError: (err, msg) => {
            console.error('Agora error:', err, msg);
          },
        });

        engineRef.current = engine;
        console.log('Agora engine initialized successfully');
      } catch (error) {
        console.error('Failed to initialize Agora engine:', error);
      }
    };

    initEngine();

    return () => {
      if (engineRef.current) {
        engineRef.current.release();
        engineRef.current = null;
      }
    };
  }, []);

  // Join Agora channel helper
  const joinAgoraChannel = useCallback(
    (agora: { token: string; channelName: string; uid: number }, callType: CallType) => {
      const engine = engineRef.current;
      if (!engine) {
        console.error('Agora engine not initialized, cannot join channel');
        return;
      }

      console.log('Agora: Joining channel', agora.channelName, 'with uid', agora.uid, 'type', callType);

      engine.enableAudio();
      if (callType === 'VIDEO') {
        engine.enableVideo();
        engine.startPreview();
      }

      engine.joinChannel(agora.token, agora.channelName, agora.uid, {
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: callType === 'VIDEO',
        autoSubscribeAudio: true,
        autoSubscribeVideo: callType === 'VIDEO',
      });

      setLocalUid(agora.uid);
    },
    []
  );

  // Reset call state
  const resetCallState = useCallback(() => {
    const engine = engineRef.current;
    if (engine) {
      try {
        engine.leaveChannel();
        engine.disableAudio();
        engine.disableVideo();
      } catch {
        // Engine may not be in a channel
      }
    }

    setCallState(initialCallState);
    setRemoteUid(null);
    setLocalUid(null);

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

      callTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current.status === 'ringing') {
          socketService.declineCall(data.callId);
          resetCallState();
        }
      }, 30000);
    });

    const unsubscribeCallAccepted = socketService.on('call_accepted', (data: any) => {
      const current = callStateRef.current;
      console.log('call_accepted received:', data.callId, 'current callId:', current.callId, 'has agora:', !!data.agora);

      if (data.callId === current.callId && data.agora) {
        setCallState((prev) => ({
          ...prev,
          status: 'connecting',
        }));
        // Caller side: join Agora channel
        joinAgoraChannel(data.agora, current.type);
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
      unsubscribeCallDeclined();
      unsubscribeCallBusy();
      unsubscribeCallEnded();
      unsubscribeCallMissed();
    };
  }, [resetCallState, joinAgoraChannel]);

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

          callTimeoutRef.current = setTimeout(async () => {
            if (callStateRef.current.status === 'ringing') {
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
    [resetCallState]
  );

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    const currentCallId = callStateRef.current.callId;
    const currentType = callStateRef.current.type;
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
      console.log('acceptCall result:', result.success, 'has agora:', !!result.agora);

      if (result.success && result.agora) {
        // Receiver side: join Agora channel
        joinAgoraChannel(result.agora, currentType);
      } else {
        throw new Error(result.error || 'Failed to accept call');
      }
    } catch (error) {
      console.error('Error accepting call:', error);
      Alert.alert('Error', 'Failed to accept call.');
      resetCallState();
    }
  }, [resetCallState, joinAgoraChannel]);

  // Decline incoming call
  const declineCall = useCallback(async () => {
    const currentCallId = callStateRef.current.callId;
    if (!currentCallId) return;

    try {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }

      await socketService.declineCall(currentCallId);
      resetCallState();
    } catch (error) {
      console.error('Error declining call:', error);
      resetCallState();
    }
  }, [resetCallState]);

  // End call
  const endCall = useCallback(async () => {
    const currentCallId = callStateRef.current.callId;
    if (!currentCallId) return;

    try {
      await socketService.endCall(currentCallId);
      resetCallState();
    } catch (error) {
      console.error('Error ending call:', error);
      resetCallState();
    }
  }, [resetCallState]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const newMuted = !callStateRef.current.isMuted;
    engineRef.current?.muteLocalAudioStream(newMuted);
    setCallState((prev) => ({
      ...prev,
      isMuted: newMuted,
    }));
  }, []);

  // Toggle speaker
  const toggleSpeaker = useCallback(() => {
    const newSpeaker = !callStateRef.current.isSpeakerOn;
    engineRef.current?.setEnableSpeakerphone(newSpeaker);
    setCallState((prev) => ({
      ...prev,
      isSpeakerOn: newSpeaker,
    }));
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    const newEnabled = !callStateRef.current.isVideoEnabled;
    engineRef.current?.muteLocalVideoStream(!newEnabled);
    setCallState((prev) => ({
      ...prev,
      isVideoEnabled: newEnabled,
    }));
  }, []);

  // Switch camera
  const switchCamera = useCallback(() => {
    engineRef.current?.switchCamera();
  }, []);

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
        switchCamera,
        remoteUid,
        localUid,
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

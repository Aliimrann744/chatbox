import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import {
  acquireLocalStream,
  addIceCandidate,
  closePeerConnection,
  createOffer,
  createPeerConnectionWithStream,
  handleAnswer,
  handleOffer,
  InCallManager,
} from '@/utils/webrtc';
import socketService from '@/services/socket';
import { useAuth } from '@/contexts/auth-context';

export type GroupCallType = 'VOICE' | 'VIDEO';
export type GroupCallStatus = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected';
export type GroupCallDirection = 'incoming' | 'outgoing';

export interface GroupParticipant {
  userId: string;
  name?: string;
  avatar?: string;
  stream: any | null; // MediaStream
  pc: any | null;      // RTCPeerConnection
  connectionState: string;
  hasDeclined?: boolean;
}

interface GroupCallState {
  callId: string | null;
  chatId: string | null;
  type: GroupCallType;
  status: GroupCallStatus;
  direction: GroupCallDirection;
  groupName: string;
  caller: { id: string; name?: string; avatar?: string } | null;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isVideoEnabled: boolean;
  startTime: Date | null;
}

interface GroupCallContextType {
  state: GroupCallState;
  participants: Record<string, GroupParticipant>;
  localStream: any | null;
  initiateGroupCall: (chatId: string, groupName: string, type: GroupCallType) => Promise<boolean>;
  acceptGroupCall: () => Promise<boolean>;
  declineGroupCall: () => Promise<void>;
  endGroupCall: () => Promise<void>;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleVideo: () => void;
}

const initialState: GroupCallState = {
  callId: null,
  chatId: null,
  type: 'VOICE',
  status: 'idle',
  direction: 'outgoing',
  groupName: '',
  caller: null,
  isMuted: false,
  isSpeakerOn: false,
  isVideoEnabled: true,
  startTime: null,
};

const GroupCallContext = createContext<GroupCallContextType | undefined>(undefined);

const ensureAudioPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
  try {
    const ok = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    if (ok) return true;
    const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    return res === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
};

const ensureCameraPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
  try {
    const ok = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
    if (ok) return true;
    const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
    return res === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
};

export function GroupCallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<GroupCallState>(initialState);
  const [participants, setParticipants] = useState<Record<string, GroupParticipant>>({});
  const [localStream, setLocalStream] = useState<any | null>(null);

  const localStreamRef = useRef<any | null>(null);
  const participantsRef = useRef<Record<string, GroupParticipant>>({});
  const stateRef = useRef<GroupCallState>(state);
  const iceServersRef = useRef<any[]>([]);
  const pendingIceRef = useRef<Record<string, any[]>>({});

  stateRef.current = state;
  participantsRef.current = participants;

  const setParticipant = useCallback((userId: string, patch: Partial<GroupParticipant>) => {
    setParticipants((prev) => {
      const existing = prev[userId] || {
        userId,
        stream: null,
        pc: null,
        connectionState: 'new',
      };
      return { ...prev, [userId]: { ...existing, ...patch } };
    });
  }, []);

  const removeParticipant = useCallback((userId: string) => {
    setParticipants((prev) => {
      const p = prev[userId];
      if (p?.pc) {
        try { p.pc.close(); } catch {}
      }
      const { [userId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const hardReset = useCallback(() => {
    // Close all PCs and stop media
    Object.values(participantsRef.current).forEach((p) => {
      if (p.pc) try { p.pc.close(); } catch {}
      if (p.stream) try { p.stream.getTracks().forEach((t: any) => t.stop()); } catch {}
    });
    if (localStreamRef.current) {
      closePeerConnection(null, localStreamRef.current);
      localStreamRef.current = null;
    }
    InCallManager.stop();
    iceServersRef.current = [];
    pendingIceRef.current = {};
    setParticipants({});
    setLocalStream(null);
    setState(initialState);
  }, []);

  // ── Build a peer connection toward `peerId` ────────────────────────────
  const buildPeerConnection = useCallback((peerId: string) => {
    const pc = createPeerConnectionWithStream(
      iceServersRef.current,
      localStreamRef.current,
      {
        onRemoteStream: (stream) => setParticipant(peerId, { stream }),
        onIceCandidate: (candidate) => {
          const callId = stateRef.current.callId;
          if (callId) socketService.sendGroupCallIce(callId, peerId, candidate);
        },
        onConnectionStateChange: (connectionState) => {
          setParticipant(peerId, { connectionState });
          if (connectionState === 'connected' && stateRef.current.status !== 'connected') {
            setState((s) => ({ ...s, status: 'connected', startTime: s.startTime || new Date() }));
          }
        },
      },
    );
    setParticipant(peerId, { pc });
    return pc;
  }, [setParticipant]);

  // ── Drain buffered ICE after remoteDescription is set ──────────────────
  const drainPendingIce = useCallback(async (peerId: string) => {
    const pc = participantsRef.current[peerId]?.pc;
    if (!pc || !pc.remoteDescription) return;
    const buffered = pendingIceRef.current[peerId];
    if (!buffered || buffered.length === 0) return;
    pendingIceRef.current[peerId] = [];
    for (const c of buffered) {
      try { await addIceCandidate(pc, c); } catch {}
    }
  }, []);

  // ══════════════════════════════════════════════════════════════════════
  // Actions
  // ══════════════════════════════════════════════════════════════════════

  const initiateGroupCall = useCallback(async (chatId: string, groupName: string, type: GroupCallType) => {
    if (stateRef.current.status !== 'idle') return false;

    const audioOk = await ensureAudioPermission();
    if (!audioOk) {
      Alert.alert('Permission required', 'Microphone permission is needed.');
      return false;
    }
    if (type === 'VIDEO') {
      const camOk = await ensureCameraPermission();
      if (!camOk) {
        Alert.alert('Permission required', 'Camera permission is needed for video calls.');
        return false;
      }
    }

    try {
      const stream = await acquireLocalStream(type);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const result = await socketService.initiateGroupCall(chatId, type);
      if (!result?.success) {
        hardReset();
        Alert.alert('Call failed', result?.error || 'Could not start group call.');
        return false;
      }

      iceServersRef.current = result.iceServers || [];

      setState({
        ...initialState,
        callId: result.callId,
        chatId,
        type,
        direction: 'outgoing',
        status: 'calling',
        groupName,
        caller: user ? { id: user.id, name: user.name, avatar: user.avatar } : null,
        isVideoEnabled: type === 'VIDEO',
      });

      InCallManager.start({ media: type === 'VIDEO' ? 'video' : 'audio' });
      InCallManager.setForceSpeakerphoneOn(type === 'VIDEO');
      return true;
    } catch (err: any) {
      hardReset();
      Alert.alert('Call failed', err?.message || 'Could not start group call.');
      return false;
    }
  }, [user, hardReset]);

  const acceptGroupCall = useCallback(async () => {
    const callId = stateRef.current.callId;
    if (!callId) return false;

    const type = stateRef.current.type;
    const audioOk = await ensureAudioPermission();
    if (!audioOk) {
      Alert.alert('Permission required', 'Microphone permission is needed.');
      return false;
    }
    if (type === 'VIDEO') {
      const camOk = await ensureCameraPermission();
      if (!camOk) {
        Alert.alert('Permission required', 'Camera permission is needed for video calls.');
        return false;
      }
    }

    try {
      const stream = await acquireLocalStream(type);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const result = await socketService.acceptGroupCall(callId);
      if (!result?.success) {
        hardReset();
        Alert.alert('Call ended', result?.error || 'Call is no longer available.');
        return false;
      }

      iceServersRef.current = result.iceServers || [];

      setState((s) => ({ ...s, status: 'connecting' }));

      // For each existing participant, we will RECEIVE an offer (they got a
      // "participant_joined" for us). We don't need to initiate toward them.
      // We just wait. Prepare placeholder participants in the UI.
      for (const pid of result.participants || []) {
        setParticipant(pid, { userId: pid, stream: null, pc: null, connectionState: 'new' });
      }

      InCallManager.start({ media: type === 'VIDEO' ? 'video' : 'audio' });
      InCallManager.setForceSpeakerphoneOn(type === 'VIDEO');
      return true;
    } catch (err: any) {
      hardReset();
      Alert.alert('Call failed', err?.message || 'Failed to join group call.');
      return false;
    }
  }, [hardReset, setParticipant]);

  const declineGroupCall = useCallback(async () => {
    const callId = stateRef.current.callId;
    if (callId) {
      try { await socketService.declineGroupCall(callId); } catch {}
    }
    hardReset();
  }, [hardReset]);

  const endGroupCall = useCallback(async () => {
    const callId = stateRef.current.callId;
    if (callId) {
      try { await socketService.leaveGroupCall(callId); } catch {}
    }
    hardReset();
  }, [hardReset]);

  // ── Local media toggles ────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !stateRef.current.isMuted;
    const track = stream.getAudioTracks?.()[0];
    if (track) track.enabled = !next;
    setState((s) => ({ ...s, isMuted: next }));
  }, []);

  const toggleSpeaker = useCallback(() => {
    const next = !stateRef.current.isSpeakerOn;
    InCallManager.setSpeakerphoneOn(next);
    setState((s) => ({ ...s, isSpeakerOn: next }));
  }, []);

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !stateRef.current.isVideoEnabled;
    const track = stream.getVideoTracks?.()[0];
    if (track) track.enabled = next;
    setState((s) => ({ ...s, isVideoEnabled: next }));
  }, []);

  // ══════════════════════════════════════════════════════════════════════
  // Socket wiring
  // ══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const offIncoming = socketService.on('incoming_group_call', (data: any) => {
      // If already busy with another group call, decline silently
      if (stateRef.current.status !== 'idle') {
        socketService.declineGroupCall(data.callId).catch(() => {});
        return;
      }
      setState({
        ...initialState,
        callId: data.callId,
        chatId: data.chatId,
        type: data.type,
        direction: 'incoming',
        status: 'ringing',
        groupName: data.groupName,
        caller: data.caller,
        isVideoEnabled: data.type === 'VIDEO',
      });
    });

    const offJoined = socketService.on('group_call_participant_joined', async (data: any) => {
      if (data.callId !== stateRef.current.callId) return;
      // A new participant accepted — I must create an offer for them.
      if (!localStreamRef.current) return; // should have stream by now
      const peerId = data.userId;
      setParticipant(peerId, { userId: peerId, stream: null, pc: null, connectionState: 'new' });
      try {
        const pc = buildPeerConnection(peerId);
        const offer = await createOffer(pc);
        socketService.sendGroupCallOffer(stateRef.current.callId!, peerId, offer);
      } catch (err) {
        console.warn('[group-call] Failed to create offer for', peerId, err);
      }
    });

    const offLeft = socketService.on('group_call_participant_left', (data: any) => {
      if (data.callId !== stateRef.current.callId) return;
      removeParticipant(data.userId);
    });

    const offDeclined = socketService.on('group_call_participant_declined', (data: any) => {
      if (data.callId !== stateRef.current.callId) return;
      setParticipant(data.userId, { hasDeclined: true });
    });

    const offEnded = socketService.on('group_call_ended', (data: any) => {
      if (data.callId !== stateRef.current.callId) return;
      hardReset();
    });

    const offOffer = socketService.on('group_call_offer', async (data: any) => {
      if (data.callId !== stateRef.current.callId) return;
      if (!localStreamRef.current) return;
      const peerId = data.fromUserId;
      try {
        const pc = buildPeerConnection(peerId);
        const answer = await handleOffer(pc, data.offer);
        socketService.sendGroupCallAnswer(stateRef.current.callId!, peerId, answer);
        await drainPendingIce(peerId);
      } catch (err) {
        console.warn('[group-call] Failed to handle offer from', peerId, err);
      }
    });

    const offAnswer = socketService.on('group_call_answer', async (data: any) => {
      if (data.callId !== stateRef.current.callId) return;
      const peer = participantsRef.current[data.fromUserId];
      if (!peer?.pc) return;
      try {
        await handleAnswer(peer.pc, data.answer);
        await drainPendingIce(data.fromUserId);
      } catch (err) {
        console.warn('[group-call] Failed to handle answer from', data.fromUserId, err);
      }
    });

    const offIce = socketService.on('group_call_ice_candidate', async (data: any) => {
      if (data.callId !== stateRef.current.callId) return;
      const peer = participantsRef.current[data.fromUserId];
      if (peer?.pc?.remoteDescription) {
        try { await addIceCandidate(peer.pc, data.candidate); } catch {}
      } else {
        const buf = pendingIceRef.current[data.fromUserId] || [];
        buf.push(data.candidate);
        pendingIceRef.current[data.fromUserId] = buf;
      }
    });

    return () => {
      offIncoming();
      offJoined();
      offLeft();
      offDeclined();
      offEnded();
      offOffer();
      offAnswer();
      offIce();
    };
  }, [buildPeerConnection, drainPendingIce, hardReset, removeParticipant, setParticipant]);

  // Keep socketService call-active flag in sync so screen locks don't kill
  // the call socket while a group call is in progress.
  useEffect(() => {
    socketService.setCallActive(state.status !== 'idle');
  }, [state.status]);

  const value = useMemo<GroupCallContextType>(
    () => ({
      state,
      participants,
      localStream,
      initiateGroupCall,
      acceptGroupCall,
      declineGroupCall,
      endGroupCall,
      toggleMute,
      toggleSpeaker,
      toggleVideo,
    }),
    [
      state,
      participants,
      localStream,
      initiateGroupCall,
      acceptGroupCall,
      declineGroupCall,
      endGroupCall,
      toggleMute,
      toggleSpeaker,
      toggleVideo,
    ],
  );

  return <GroupCallContext.Provider value={value}>{children}</GroupCallContext.Provider>;
}

export function useGroupCall() {
  const ctx = useContext(GroupCallContext);
  if (!ctx) throw new Error('useGroupCall must be used within a GroupCallProvider');
  return ctx;
}

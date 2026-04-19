import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Avatar } from '@/components/ui/avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { RTCView } from '@/utils/webrtc';
import { useGroupCall } from '@/contexts/group-call-context';

const SCREEN_W = Dimensions.get('window').width;

function gridDims(count: number) {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count === 2) return { cols: 1, rows: 2 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 2, rows: 3 };
  return { cols: 3, rows: Math.ceil(count / 3) };
}

export default function GroupActiveCallScreen() {
  const { state, participants, localStream, endGroupCall, toggleMute, toggleSpeaker, toggleVideo } = useGroupCall();
  const [duration, setDuration] = useState(0);

  // Navigate away when call ends
  useEffect(() => {
    if (state.status === 'idle') {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    }
  }, [state.status]);

  useEffect(() => {
    let t: ReturnType<typeof setInterval> | undefined;
    if (state.status === 'connected' && state.startTime) {
      t = setInterval(() => {
        setDuration(Math.floor((Date.now() - state.startTime!.getTime()) / 1000));
      }, 1000);
    }
    return () => { if (t) clearInterval(t); };
  }, [state.status, state.startTime]);

  const formatDuration = (s: number) => {
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  // Tiles: all remote participants + local preview
  const tiles = useMemo(() => {
    const arr: { key: string; label: string; stream: any | null; isLocal?: boolean; avatar?: string }[] = [];
    for (const p of Object.values(participants)) {
      arr.push({ key: p.userId, label: p.name || 'Participant', stream: p.stream, avatar: p.avatar });
    }
    arr.push({ key: 'self', label: 'You', stream: localStream, isLocal: true });
    return arr;
  }, [participants, localStream]);

  const { cols, rows } = gridDims(tiles.length);
  const tileW = Math.floor((SCREEN_W - (cols + 1) * 4) / cols);
  const availH = Dimensions.get('window').height - 220;
  const tileH = Math.floor(availH / rows) - 8;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.groupName} numberOfLines={1}>{state.groupName}</Text>
        <Text style={styles.duration}>
          {state.status === 'connected' ? formatDuration(duration) : state.status === 'connecting' ? 'Connecting…' : 'Ringing…'}
        </Text>
      </View>

      <View style={styles.grid}>
        {tiles.map((t) => (
          <View key={t.key} style={[styles.tile, { width: tileW, height: tileH }]}>
            {state.type === 'VIDEO' && t.stream ? (
              <RTCView
                streamURL={t.stream.toURL()}
                objectFit="cover"
                mirror={!!t.isLocal}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <View style={styles.avatarCenter}>
                <Avatar uri={t.avatar || ''} size={Math.min(72, tileW / 2)} showOnlineStatus={false} />
              </View>
            )}
            <View style={styles.tileLabel}>
              <Text style={styles.tileLabelText} numberOfLines={1}>{t.label}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Pressable onPress={toggleMute} style={[styles.ctrl, state.isMuted && styles.ctrlActive]}>
          <IconSymbol name={state.isMuted ? 'mic.slash.fill' : 'mic.fill'} size={22} color="#fff" />
        </Pressable>
        {state.type === 'VOICE' && (
          <Pressable onPress={toggleSpeaker} style={[styles.ctrl, state.isSpeakerOn && styles.ctrlActive]}>
            <IconSymbol name={state.isSpeakerOn ? 'speaker.wave.3.fill' : 'speaker.fill'} size={22} color="#fff" />
          </Pressable>
        )}
        {state.type === 'VIDEO' && (
          <Pressable onPress={toggleVideo} style={[styles.ctrl, !state.isVideoEnabled && styles.ctrlActive]}>
            <IconSymbol name={state.isVideoEnabled ? 'video.fill' : 'video.slash.fill'} size={22} color="#fff" />
          </Pressable>
        )}
        <Pressable onPress={endGroupCall} style={styles.endBtn}>
          <IconSymbol name="phone.down.fill" size={26} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  groupName: { color: '#fff', fontSize: 18, fontWeight: '600' },
  duration: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: 4,
    gap: 4,
  },
  tile: {
    backgroundColor: '#2a2a3e',
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tileLabel: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  tileLabelText: { color: '#fff', fontSize: 11, fontWeight: '500' },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
    paddingVertical: Platform.OS === 'ios' ? 30 : 20,
  },
  ctrl: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctrlActive: { backgroundColor: 'rgba(255,255,255,0.35)' },
  endBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
});

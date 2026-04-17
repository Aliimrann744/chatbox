import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useCall } from '@/contexts/call-context';

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export function ActiveCallBanner() {
  const { callState } = useCall();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const [duration, setDuration] = useState(0);

  const isOngoing =
    callState.status === 'connected' || callState.status === 'connecting';

  // Hide while the user is already looking at a call screen
  // (active / incoming) — those have their own full-screen UI.
  const onCallScreen = segments[0] === 'call';

  const shouldShow = isOngoing && !onCallScreen;

  // Live duration timer — runs only while connected & visible
  useEffect(() => {
    if (!shouldShow) {
      setDuration(0);
      return;
    }
    if (callState.status !== 'connected' || !callState.startTime) return;

    const tick = () => {
      const diff = Math.floor(
        (Date.now() - callState.startTime!.getTime()) / 1000,
      );
      setDuration(diff);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [shouldShow, callState.status, callState.startTime]);

  if (!shouldShow) return null;

  const handlePress = () => {
    router.push('/call/active');
  };

  const statusText =
    callState.status === 'connecting'
      ? 'Connecting…'
      : formatDuration(duration);

  const callTypeLabel =
    callState.type === 'VIDEO' ? 'Video call' : 'Voice call';

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Return to ${callTypeLabel} with ${callState.participant?.name || 'contact'}`}
      style={({ pressed }) => [
        styles.banner,
        {
          paddingTop: insets.top + 4,
          opacity: pressed ? 0.9 : 1,
        },
      ]}>
      <View style={styles.iconWrap}>
        <IconSymbol
          name={callState.type === 'VIDEO' ? 'video.fill' : 'phone.fill'}
          size={14}
          color="#ffffff"
        />
      </View>

      <View style={styles.textWrap}>
        <Text style={styles.name} numberOfLines={1}>
          {callState.participant?.name || 'Ongoing call'}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {callTypeLabel} · {statusText}
        </Text>
      </View>

      <Text style={styles.tapHint}>Tap to return</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00A884',
    paddingHorizontal: 14,
    paddingBottom: 8,
    zIndex: 1000,
    elevation: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 3,
      },
      default: {},
    }),
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  textWrap: {
    flex: 1,
    flexDirection: 'column',
  },
  name: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  sub: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    marginTop: 1,
  },
  tapHint: {
    color: '#ffffff',
    fontSize: 11,
    marginLeft: 10,
    opacity: 0.85,
    fontWeight: '500',
  },
});

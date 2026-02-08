import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { router } from 'expo-router';

import { Avatar } from '@/components/ui/avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useCall } from '@/contexts/call-context';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function IncomingCallScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { callState, acceptCall, declineCall } = useCall();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation for avatar
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Ring animation for incoming indicator
  useEffect(() => {
    const ring = Animated.loop(
      Animated.timing(ringAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );
    ring.start();
    return () => ring.stop();
  }, [ringAnim]);

  // Navigate away if call ends
  useEffect(() => {
    if (callState.status === 'idle') {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    } else if (callState.status === 'connected' || callState.status === 'connecting') {
      router.replace('/call/active');
    }
  }, [callState.status]);

  const handleAccept = async () => {
    await acceptCall();
  };

  const handleDecline = async () => {
    await declineCall();
  };

  const ringOpacity = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });

  const ringScale = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2],
  });

  return (
    <View style={[styles.container, { backgroundColor: '#1a1a2e' }]}>
      {/* Background gradient overlay */}
      <View style={styles.overlay} />

      {/* Caller info */}
      <View style={styles.callerSection}>
        <View style={styles.avatarContainer}>
          {/* Pulsing rings */}
          <Animated.View
            style={[
              styles.ring,
              {
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.avatarWrapper,
              { transform: [{ scale: pulseAnim }] },
            ]}>
            <Avatar
              uri={callState.participant?.avatar}
              size={120}
              showOnlineStatus={false}
            />
          </Animated.View>
        </View>

        <Text style={styles.callerName}>
          {callState.participant?.name || 'Unknown'}
        </Text>
        <Text style={styles.callType}>
          Incoming {callState.type === 'VIDEO' ? 'Video' : 'Voice'} Call
        </Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actionsContainer}>
        {/* Decline button */}
        <Pressable
          onPress={handleDecline}
          style={({ pressed }) => [
            styles.actionButton,
            styles.declineButton,
            pressed && styles.buttonPressed,
          ]}>
          <IconSymbol name="phone.down.fill" size={32} color="#ffffff" />
        </Pressable>

        {/* Accept button */}
        <Pressable
          onPress={handleAccept}
          style={({ pressed }) => [
            styles.actionButton,
            styles.acceptButton,
            pressed && styles.buttonPressed,
          ]}>
          <IconSymbol
            name={callState.type === 'VIDEO' ? 'video.fill' : 'phone.fill'}
            size={32}
            color="#ffffff"
          />
        </Pressable>
      </View>

      {/* Swipe hint */}
      <Text style={styles.swipeHint}>
        Tap to answer or decline
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'ios' ? 80 : 40,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  callerSection: {
    alignItems: 'center',
    marginTop: 60,
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  avatarWrapper: {
    zIndex: 1,
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  callerName: {
    fontSize: 28,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  callType: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 60,
    marginBottom: 40,
  },
  actionButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineButton: {
    backgroundColor: '#FF3B30',
  },
  acceptButton: {
    backgroundColor: '#34C759',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  swipeHint: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
});

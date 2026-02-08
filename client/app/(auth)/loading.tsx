import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const STATUS_MESSAGES = [
  'Initializing...',
  'Verifying your number...',
  'Setting up end-to-end encryption...',
  'Almost ready...',
];

const TOTAL_DURATION = 3500;
const STEP_DURATION = TOTAL_DURATION / STATUS_MESSAGES.length;

export default function LoadingScreen() {
  const { isNewUser } = useLocalSearchParams<{ isNewUser: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [statusIndex, setStatusIndex] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: TOTAL_DURATION,
      useNativeDriver: false,
    }).start();

    // Cycle through status messages
    const intervals: NodeJS.Timeout[] = [];
    STATUS_MESSAGES.forEach((_, i) => {
      if (i > 0) {
        const timeout = setTimeout(() => {
          setStatusIndex(i);
        }, STEP_DURATION * i);
        intervals.push(timeout);
      }
    });

    const navTimeout = setTimeout(() => {
      if (isNewUser === '1') {
        router.replace('/(auth)/setup-profile');
      } else {
        router.replace('/(tabs)');
      }
    }, TOTAL_DURATION + 300);

    return () => {
      intervals.forEach(clearTimeout);
      clearTimeout(navTimeout);
    };
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Lock Icon */}
        <View style={[styles.lockContainer, { backgroundColor: colors.primary }]}>
          <IconSymbol name="lock.fill" size={40} color="#ffffff" />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.text }]}>
          Setting up your account
        </Text>

        {/* Progress Bar */}
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.primary,
                width: progressWidth,
              },
            ]}
          />
        </View>

        {/* Status Text */}
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>
          {STATUS_MESSAGES[statusIndex]}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
    width: '100%',
  },
  lockContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 32,
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  statusText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

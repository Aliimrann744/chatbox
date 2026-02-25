import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const STATUS_MESSAGES = [
  'Initializing...',
  'Verifying your number...',
  'Setting up end-to-end encryption...',
  'Almost ready...',
];

const TOTAL_DURATION = 9500;
const STEP_DURATION = TOTAL_DURATION / STATUS_MESSAGES.length;

function AnimatedLockIcon({ color }: { color: string }) {
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;
  const ripple3 = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const shackleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createRipple = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    const rotate = Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    // Lock shackle "closing" animation
    Animated.timing(shackleAnim, {
      toValue: 1,
      duration: 1500,
      delay: 500,
      easing: Easing.out(Easing.back(1.5)),
      useNativeDriver: true,
    }).start();

    createRipple(ripple1, 0).start();
    createRipple(ripple2, 700).start();
    createRipple(ripple3, 1400).start();
    pulse.start();
    rotate.start();
  }, []);

  const makeRippleStyle = (anim: Animated.Value) => ({
    opacity: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 0],
    }),
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 2.2],
        }),
      },
    ],
  });

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-5deg', '5deg'],
  });

  const shackleTranslate = shackleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 0],
  });

  return (
    <View style={styles.animationWrapper}>
      {/* Ripple rings */}
      {[ripple1, ripple2, ripple3].map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.rippleRing,
            { borderColor: color },
            makeRippleStyle(anim),
          ]}
        />
      ))}

      {/* Pulsing center circle with lock */}
      <Animated.View
        style={[
          styles.centerCircle,
          { backgroundColor: color },
          {
            transform: [
              { scale: pulseAnim },
              { rotate: rotateInterpolate },
            ],
          },
        ]}
      >
        {/* Lock shackle (arc) */}
        <Animated.View
          style={[
            styles.lockShackle,
            { transform: [{ translateY: shackleTranslate }] },
          ]}
        />
        {/* Lock body */}
        <View style={styles.lockBody}>
          <View style={styles.lockKeyhole} />
        </View>
      </Animated.View>
    </View>
  );
}

export default function LoadingScreen() {
  const { isNewUser, loginMode } = useLocalSearchParams<{ isNewUser: string; loginMode?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [statusIndex, setStatusIndex] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: TOTAL_DURATION,
      useNativeDriver: false,
    }).start();

    const intervals: ReturnType<typeof setTimeout>[] = [];
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
        router.replace({
          pathname: '/(auth)/setup-profile',
          params: { loginMode: loginMode || 'phone' },
        });
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
        <AnimatedLockIcon color={colors.primary} />

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
  // Animation styles
  animationWrapper: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  rippleRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
  },
  centerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockShackle: {
    width: 22,
    height: 16,
    borderWidth: 3.5,
    borderColor: '#ffffff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomWidth: 0,
    marginBottom: -1,
  },
  lockBody: {
    width: 28,
    height: 20,
    backgroundColor: '#ffffff',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockKeyhole: {
    width: 5,
    height: 9,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 3,
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

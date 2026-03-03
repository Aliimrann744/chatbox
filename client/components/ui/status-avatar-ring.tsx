import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Avatar } from '@/components/ui/avatar';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface StatusAvatarRingProps {
  uri?: string;
  name?: string;
  size?: number;
  totalSegments: number;
  viewedSegments: number;
}

export function StatusAvatarRing({
  uri,
  name,
  size = 55,
  totalSegments,
  viewedSegments,
}: StatusAvatarRingProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const ringSize = size + 8;
  const strokeWidth = 2.5;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = ringSize / 2;

  const gap = totalSegments > 1 ? 4 : 0;
  const totalGap = gap * totalSegments;
  const segmentLength = (circumference - totalGap) / totalSegments;

  const segments = [];
  let offset = 0;
  for (let i = 0; i < totalSegments; i++) {
    const isViewed = i < viewedSegments;
    segments.push(
      <Circle
        key={i}
        cx={center}
        cy={center}
        r={radius}
        stroke={isViewed ? colors.textSecondary : colors.accent}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
        strokeDashoffset={-offset}
        strokeLinecap="round"
        rotation={-90}
        origin={`${center}, ${center}`}
      />,
    );
    offset += segmentLength + gap;
  }

  const initials = name
    ? name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <View style={[styles.container, { width: ringSize, height: ringSize }]}>
      <Svg width={ringSize} height={ringSize} style={StyleSheet.absoluteFill}>
        {segments}
      </Svg>
      <View style={styles.avatarContainer}>
        {uri ? (
          <Avatar uri={uri} size={size} />
        ) : (
          <View
            style={[
              styles.placeholder,
              { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary },
            ]}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'absolute',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});

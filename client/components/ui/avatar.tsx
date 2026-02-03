import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface AvatarProps {
  uri: string;
  size?: number;
  showOnlineStatus?: boolean;
  isOnline?: boolean;
}

export function Avatar({ uri, size = 50, showOnlineStatus = false, isOnline = false }: AvatarProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        source={{ uri }}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      />
      {showOnlineStatus && isOnline && (
        <View
          style={[
            styles.onlineIndicator,
            {
              backgroundColor: colors.online,
              borderColor: colors.background,
              width: size * 0.28,
              height: size * 0.28,
              borderRadius: size * 0.14,
              right: 0,
              bottom: 0,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    backgroundColor: '#e0e0e0',
  },
  onlineIndicator: {
    position: 'absolute',
    borderWidth: 2,
  },
});

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VerifiedTickProps {
  size?: number;
  color?: string;
  style?: any;
}

export function VerifiedTick({ size = 14, color = '#1D9BF0', style }: VerifiedTickProps) {
  return (
    <View
      style={[
        styles.wrapper,
        {
          width: size + 2,
          height: size + 2,
          borderRadius: (size + 2) / 2,
          backgroundColor: color,
        },
        style,
      ]}
      accessibilityLabel="Verified account"
    >
      <Ionicons name="checkmark" size={Math.max(8, size - 4)} color="#ffffff" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

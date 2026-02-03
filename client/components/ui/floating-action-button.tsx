import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface FloatingActionButtonProps {
  onPress: () => void;
  icon?: IconSymbolName;
  size?: number;
}

export function FloatingActionButton({
  onPress,
  icon = 'plus',
  size = 56,
}: FloatingActionButtonProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.primary,
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      <IconSymbol name={icon} size={28} color="#ffffff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});

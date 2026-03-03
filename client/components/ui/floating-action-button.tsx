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

export function FloatingActionButton({ onPress, icon = 'plus', size = 46 }: FloatingActionButtonProps) {

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: "#139047",
          width: size,
          height: size,
          borderRadius: 12,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      <IconSymbol name={icon} size={22} color="#ffffff" />
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

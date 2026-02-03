import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Call } from '@/constants/mock-data';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface CallListItemProps {
  call: Call;
}

export function CallListItem({ call }: CallListItemProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const getCallIcon = () => {
    if (call.type === 'missed') {
      return {
        name: 'phone.fill.arrow.down.left' as const,
        color: '#e74c3c',
      };
    } else if (call.type === 'incoming') {
      return {
        name: 'phone.fill.arrow.down.left' as const,
        color: colors.online,
      };
    } else {
      return {
        name: 'phone.fill.arrow.up.right' as const,
        color: colors.online,
      };
    }
  };

  const callIcon = getCallIcon();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed ? colors.backgroundSecondary : colors.background,
        },
      ]}>
      <Avatar uri={call.user.avatar} size={50} />

      <View style={styles.content}>
        <Text
          style={[
            styles.name,
            { color: call.type === 'missed' ? '#e74c3c' : colors.text },
          ]}
          numberOfLines={1}>
          {call.user.name}
        </Text>
        <View style={styles.callInfo}>
          <IconSymbol name={callIcon.name} size={14} color={callIcon.color} />
          <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
            {call.timestamp}
            {call.duration && ` (${call.duration})`}
          </Text>
        </View>
      </View>

      <Pressable style={styles.callButton}>
        <IconSymbol
          name={call.callType === 'video' ? 'video.fill' : 'phone.fill'}
          size={22}
          color={colors.primary}
        />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  callInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timestamp: {
    fontSize: 14,
  },
  callButton: {
    padding: 8,
  },
});

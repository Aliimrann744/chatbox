import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Call } from '@/services/api';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface CallListItemProps {
  call: Call;
  onCallPress?: (call: Call) => void;
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const callDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (callDate.getTime() === today.getTime()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (callDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function CallListItem({ call, onCallPress }: CallListItemProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const isMissed = call.status === 'MISSED' || call.status === 'DECLINED';

  const getCallIcon = () => {
    if (isMissed) {
      return {
        name: 'phone.fill.arrow.down.left' as const,
        color: '#e74c3c',
      };
    } else if (call.direction === 'incoming') {
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
  const durationStr = formatDuration(call.duration);
  const dateStr = formatRelativeDate(call.startedAt);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed ? colors.backgroundSecondary : colors.background,
        },
      ]}>
      <Avatar uri={call.otherUser.avatar || ""} size={50} />

      <View style={styles.content}>
        <Text
          style={[
            styles.name,
            { color: isMissed ? '#e74c3c' : colors.text },
          ]}
          numberOfLines={1}>
          {call.otherUser.name}
        </Text>
        <View style={styles.callInfo}>
          <IconSymbol name={callIcon.name} size={14} color={callIcon.color} />
          <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
            {dateStr}
            {durationStr ? ` (${durationStr})` : ''}
          </Text>
        </View>
      </View>

      <Pressable
        style={styles.callButton}
        onPress={() => onCallPress?.(call)}>
        <IconSymbol
          name={call.type === 'VIDEO' ? 'video.fill' : 'phone.fill'}
          size={22}
          color={colors.accent}
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

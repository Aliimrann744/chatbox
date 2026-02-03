import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Chat } from '@/constants/mock-data';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ChatListItemProps {
  chat: Chat;
}

export function ChatListItem({ chat }: ChatListItemProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const handlePress = () => {
    router.push({ pathname: '/chat/[id]', params: { id: chat.id } });
  };

  const renderMessageStatus = () => {
    if (chat.lastMessage.senderId === 'me') {
      const iconName = chat.lastMessage.status === 'read' ? 'checkmark.double' : 'checkmark';
      const iconColor = chat.lastMessage.status === 'read' ? colors.primary : colors.textSecondary;
      return <IconSymbol name={iconName} size={16} color={iconColor} style={styles.statusIcon} />;
    }
    return null;
  };

  const renderMessagePreview = () => {
    const { lastMessage } = chat;
    let prefix = '';

    switch (lastMessage.type) {
      case 'image':
        prefix = '📷 ';
        break;
      case 'audio':
        prefix = '🎤 ';
        break;
      case 'video':
        prefix = '🎥 ';
        break;
      case 'document':
        prefix = '📄 ';
        break;
    }

    return prefix + lastMessage.text;
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed ? colors.backgroundSecondary : colors.background,
        },
      ]}>
      <Avatar
        uri={chat.user.avatar}
        size={55}
        showOnlineStatus
        isOnline={chat.user.isOnline}
      />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text
            style={[styles.name, { color: colors.text }]}
            numberOfLines={1}>
            {chat.user.name}
          </Text>
          <Text
            style={[
              styles.time,
              { color: chat.unreadCount > 0 ? colors.primary : colors.textSecondary },
            ]}>
            {chat.lastMessage.timestamp}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.messagePreview}>
            {renderMessageStatus()}
            <Text
              style={[styles.lastMessage, { color: colors.textSecondary }]}
              numberOfLines={1}>
              {renderMessagePreview()}
            </Text>
          </View>

          {chat.unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.unreadCount}>
                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
              </Text>
            </View>
          )}

          {chat.isMuted && (
            <IconSymbol
              name="xmark"
              size={14}
              color={colors.textSecondary}
              style={styles.mutedIcon}
            />
          )}
        </View>
      </View>
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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  messagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIcon: {
    marginRight: 4,
  },
  lastMessage: {
    fontSize: 14,
    flex: 1,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadCount: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  mutedIcon: {
    marginLeft: 8,
  },
});

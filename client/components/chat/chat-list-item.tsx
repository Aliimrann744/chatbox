import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Chat } from '@/services/api';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ChatListItemProps {
  chat: Chat;
}

// Format timestamp to relative time
function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

export function ChatListItem({ chat }: ChatListItemProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const handlePress = () => {
    router.push({ pathname: '/chat/[id]', params: { id: chat.id } });
  };

  const renderMessageStatus = () => {
    if (!chat.lastMessage) return null;

    // Only show status for sent messages (we need to check if current user is sender)
    // For now, we'll check based on status
    const { status } = chat.lastMessage;

    if (status === 'READ') {
      return <IconSymbol name="checkmark.circle.fill" size={16} color={colors.primary} style={styles.statusIcon} />;
    } else if (status === 'DELIVERED') {
      return <IconSymbol name="checkmark.circle" size={16} color={colors.textSecondary} style={styles.statusIcon} />;
    } else if (status === 'SENT') {
      return <IconSymbol name="checkmark" size={16} color={colors.textSecondary} style={styles.statusIcon} />;
    }

    return null;
  };

  const renderMessagePreview = () => {
    if (!chat.lastMessage) {
      return 'No messages yet';
    }

    const { type, content, sender } = chat.lastMessage;
    let prefix = '';
    let text = content || '';

    // For group chats, show sender name
    if (chat.type === 'GROUP' && sender) {
      prefix = `${sender.name}: `;
    }

    switch (type) {
      case 'IMAGE':
        text = '📷 Photo';
        break;
      case 'AUDIO':
        text = '🎤 Voice message';
        break;
      case 'VIDEO':
        text = '🎥 Video';
        break;
      case 'DOCUMENT':
        text = '📄 Document';
        break;
      case 'LOCATION':
        text = '📍 Location';
        break;
      case 'CONTACT':
        text = '👤 Contact';
        break;
      case 'STICKER':
        text = '🎨 Sticker';
        break;
    }

    return prefix + text;
  };

  function getInitials(name?: string) {
    if (!name) return '?';

    const words = name.trim().split(' ');
    if (words.length === 1) {
      return words[0][0].toUpperCase();
    }

    return (words[0][0] + words[1][0]).toUpperCase();
  }

  const InitialsAvatar = ({ name }: { name?: string }) => {
    const initials = getInitials(name);
    return (
      <View style={styles.initialsAvatar}>
        <Text style={styles.initialsText}>{initials}</Text>
      </View>
    );
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
      {chat?.avatar ? (
        <Avatar uri={chat.avatar} size={55} showOnlineStatus={chat.type === 'PRIVATE'} isOnline={chat.isOnline} />
      ) : (
        <InitialsAvatar name={chat.name} />
      )}

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text
            style={[styles.name, { color: colors.text }]}
            numberOfLines={1}>
            {chat.name || 'Unknown'}
          </Text>
          <Text
            style={[
              styles.time,
              { color: chat.unreadCount > 0 ? colors.primary : colors.textSecondary },
            ]}>
            {chat.lastMessage ? formatTime(chat.lastMessage.createdAt) : ''}
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
              name="speaker.slash.fill"
              size={14}
              color={colors.textSecondary}
              style={styles.mutedIcon}
            />
          )}

          {chat.isPinned && (
            <IconSymbol
              name="pin.fill"
              size={14}
              color={colors.textSecondary}
              style={styles.pinnedIcon}
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
  initialsAvatar: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: '#080053',
    justifyContent: 'center',
    alignItems: 'center',
  },

  initialsText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
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
  pinnedIcon: {
    marginLeft: 4,
  },
});

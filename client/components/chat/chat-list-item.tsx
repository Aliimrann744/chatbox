import { router } from 'expo-router';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '@/components/ui/avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Chat } from '@/services/api';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';

interface ChatListItemProps {
  chat: Chat;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onLongPress?: (chatId: string) => void;
  onSelect?: (chatId: string) => void;
  onAvatarPress?: (user: { id: string; name: string; avatar?: string }) => void;
}

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

const isDeletedAccount = (chat: Chat) =>
  chat.type === 'PRIVATE' && (!chat.name || chat.name === 'Deleted Account');

export function ChatListItem({
  chat,
  isSelected = false,
  isSelectionMode = false,
  onLongPress,
  onSelect,
  onAvatarPress,
}: ChatListItemProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { user } = useAuth();

  const displayName = chat.name || 'Deleted Account';

  const handlePress = useCallback(() => {
    if (isSelectionMode) {
      onSelect?.(chat.id);
    } else {
      router.push({ pathname: '/chat/[id]', params: { id: chat.id } });
    }
  }, [isSelectionMode, chat.id, onSelect]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(chat.id);
  }, [chat.id, onLongPress]);

  const handleAvatarPress = useCallback(() => {
    if (isSelectionMode) {
      onSelect?.(chat.id);
      return;
    }
    if (onAvatarPress && chat.type === 'PRIVATE' && chat.members?.length >= 2) {
      const otherMember = chat.members.find(m => m.user.name === chat.name) || chat.members[1];
      onAvatarPress({
        id: otherMember.user.id,
        name: chat.name || otherMember.user.name || 'User',
        avatar: chat.avatar || otherMember.user.avatar,
      });
    }
  }, [isSelectionMode, chat, onSelect, onAvatarPress]);

  const isLastMessageMine = !!chat.lastMessage && chat.lastMessage.senderId === user?.id;

  const renderMessageStatus = () => {
    if (!chat.lastMessage) return null;
    if (chat.lastMessage.isDeletedForEveryone) return null;
    if (!isLastMessageMine) return null;

    const { status } = chat.lastMessage;

    if (status === 'READ') {
      return <IconSymbol name="checkmark.circle.fill" size={16} color={colors.readReceipt} style={styles.statusIcon} />;
    } else if (status === 'DELIVERED') {
      return <IconSymbol name="checkmark.circle" size={16} color={colors.textSecondary} style={styles.statusIcon} />;
    } else if (status === 'SENT') {
      return <IconSymbol name="checkmark" size={16} color={colors.textSecondary} style={styles.statusIcon} />;
    }

    return null;
  };

  const formatCallPreview = (content?: string): string => {
    let info: { callType?: string; callStatus?: string; duration?: number | null } = {};
    try {
      info = JSON.parse(content || '{}');
    } catch {}

    const isVoice = info.callType === 'VOICE';
    const label = isVoice ? 'Voice call' : 'Video call';

    if (info.callStatus === 'MISSED') return `${label} \u2022 Missed`;
    if (info.callStatus === 'DECLINED') return `${label} \u2022 Declined`;
    if (info.callStatus === 'ENDED' && info.duration) {
      const mins = Math.floor(info.duration / 60);
      const secs = info.duration % 60;
      return `${label} \u2022 ${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return label;
  };

  const renderMessagePreview = () => {
    if (!chat.lastMessage) return 'No messages yet';

    if (chat.lastMessage.isDeletedForEveryone) {
      return isLastMessageMine ? 'You deleted this message' : 'This message was deleted';
    }

    const { type, content, sender } = chat.lastMessage;
    let prefix = '';
    let text = content || '';

    if (type === 'SYSTEM') return content || '';

    if (chat.type === 'GROUP' && sender) {
      prefix = `${sender.name}: `;
    }

    switch (type) {
      case 'IMAGE': text = '\ud83d\udcf7 Photo'; break;
      case 'AUDIO': text = '\ud83c\udfa4 Voice message'; break;
      case 'VIDEO': text = '\ud83c\udfa5 Video'; break;
      case 'DOCUMENT': text = '\ud83d\udcc4 Document'; break;
      case 'LOCATION': text = '\ud83d\udccd Location'; break;
      case 'CONTACT': text = '\ud83d\udc64 Contact'; break;
      case 'STICKER': text = '\ud83c\udfa8 Sticker'; break;
      case 'CALL': text = formatCallPreview(content); break;
      case 'TEXT':
      default:
        if (typeof text !== 'string') {
          text = '';
        } else if (text.startsWith('{') && text.endsWith('}')) {
          try { JSON.parse(text); text = ''; } catch {}
        }
        break;
    }

    return prefix + text;
  };

  function getInitials(name: string | undefined): string {
    if (!name || !name.trim()) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  const hasUnread = (chat.unreadCount > 0) || chat.isMarkedUnread;

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: isSelected
            ? colorScheme === 'dark' ? '#1a3a2a' : '#d9f2e6'
            : pressed
              ? colors.backgroundSecondary
              : colors.background,
        },
      ]}
    >
      {/* Selection checkbox / Avatar */}
      <Pressable onPress={handleAvatarPress}>
        <View>
          {chat?.avatar ? (
            <Avatar uri={chat.avatar} size={52} showOnlineStatus={chat.type === 'PRIVATE' && !isDeletedAccount(chat)} isOnline={chat.isOnline} />
          ) : (
            <View style={[styles.initialsAvatar, isDeletedAccount(chat) && { backgroundColor: '#808080' }]}>
              <Text style={styles.initialsText}>
                {isDeletedAccount(chat) ? '?' : getInitials(chat?.name)}
              </Text>
            </View>
          )}
          {isSelected && (
            <View style={styles.checkBadge}>
              <Ionicons name="checkmark" size={14} color="#fff" />
            </View>
          )}
        </View>
      </Pressable>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text
            style={[
              styles.name,
              { color: isDeletedAccount(chat) ? colors.textSecondary : colors.text },
              isDeletedAccount(chat) && { fontStyle: 'italic' },
            ]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <Text
            style={[
              styles.time,
              { color: hasUnread ? colors.accent : colors.textSecondary },
            ]}
          >
            {chat.lastMessage ? formatTime(chat.lastMessage.createdAt) : ''}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.messagePreview}>
            {renderMessageStatus()}
            <Text
              style={[styles.lastMessage, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {renderMessagePreview()}
            </Text>
          </View>

          <View style={styles.badges}>
            {hasUnread && (
              <View style={[styles.unreadBadge, { backgroundColor: chat.isMuted ? colors.textSecondary : colors.accent }]}>
                <Text style={styles.unreadCount}>
                  {chat.unreadCount > 99 ? '99+' : chat.unreadCount > 0 ? chat.unreadCount : ' '}
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
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '600',
  },
  checkBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  name: {
    fontSize: 17,
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
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
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

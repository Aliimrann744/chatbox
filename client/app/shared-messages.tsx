import { router, Stack } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { chatApi, SharedMessage } from '@/services/api';
import socketService from '@/services/socket';

// Shared screen — shows every message the current user has starred
// across all of their chats. Reads from GET /chats/starred/all.
export default function SharedMessagesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<SharedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchShared = useCallback(async () => {
    try {
      const data = await chatApi.getAllStarredMessages();
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Error loading shared messages:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchShared();
  }, [fetchShared]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchShared();
  }, [fetchShared]);

  // Unstar — removes the message from the shared list and notifies server.
  const handleUnstar = useCallback(async (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    try {
      await socketService.starMessage(messageId, false);
    } catch (err) {
      console.error('Failed to unstar message:', err);
      // On failure, refetch to restore canonical state.
      fetchShared();
    }
  }, [fetchShared]);

  const handleOpenChat = useCallback((chatId: string) => {
    router.push({ pathname: '/chat/[id]', params: { id: chatId } });
  }, []);

  const renderItem = useCallback(({ item }: { item: SharedMessage }) => (
    <SharedMessageRow
      item={item}
      onPressChat={() => handleOpenChat(item.chat.id)}
      onUnstar={() => handleUnstar(item.id)}
    />
  ), [handleOpenChat, handleUnstar]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.headerBackground,
          },
        ]}>
        <Pressable
          hitSlop={10}
          onPress={() => router.back()}
          style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.headerText} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Starred</Text>
        <View style={styles.headerBtn} />
      </View>

      {messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="star-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No starred messages</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Long-press a message in any chat and tap the star to save it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
          )}
        />
      )}
    </View>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface RowProps {
  item: SharedMessage;
  onPressChat: () => void;
  onUnstar: () => void;
}

function SharedMessageRow({ item, onPressChat, onUnstar }: RowProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const chatName = item.chat.name || 'Unknown';
  const chatAvatar = item.chat.avatar;

  return (
    <Pressable
      onPress={onPressChat}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.backgroundSecondary : 'transparent' },
      ]}>
      {/* Chat avatar */}
      {chatAvatar ? (
        <Avatar uri={chatAvatar} size={46} />
      ) : (
        <InitialsAvatar name={chatName} />
      )}

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.chatName, { color: colors.text }]} numberOfLines={1}>
            {chatName}
          </Text>
          <Text style={[styles.time, { color: colors.textSecondary }]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>

        {/* Sender subtitle — useful for group chats. For private chats the
            chat name and sender name often match, but showing it keeps
            the UI consistent. */}
        <Text style={[styles.senderName, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.sender?.name || 'Someone'}
        </Text>

        {/* Message preview — rendered per message type. */}
        <MessagePreview message={item} colors={colors} />
      </View>

      <Pressable hitSlop={10} onPress={onUnstar} style={styles.starBtn}>
        <Ionicons name="star" size={20} color="#FFC107" />
      </Pressable>
    </Pressable>
  );
}

// ─── Message preview by type ─────────────────────────────────────────────────

function MessagePreview({
  message,
  colors,
}: {
  message: SharedMessage;
  colors: typeof Colors.light;
}) {
  if (message.isDeletedForEveryone) {
    return (
      <Text style={[styles.previewText, { color: colors.textSecondary, fontStyle: 'italic' }]}>
        This message was deleted
      </Text>
    );
  }

  switch (message.type) {
    case 'IMAGE':
      return (
        <View style={styles.mediaPreview}>
          {message.mediaUrl ? (
            <Image source={{ uri: message.mediaUrl }} style={styles.mediaImage} />
          ) : null}
          <View style={styles.mediaLabel}>
            <Ionicons name="image-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.previewText, { color: colors.textSecondary }]}>
              {message.content || 'Photo'}
            </Text>
          </View>
        </View>
      );
    case 'VIDEO':
      return (
        <View style={styles.mediaPreview}>
          {message.thumbnail ? (
            <Image source={{ uri: message.thumbnail }} style={styles.mediaImage} />
          ) : null}
          <View style={styles.mediaLabel}>
            <Ionicons name="videocam-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.previewText, { color: colors.textSecondary }]}>
              {message.content || 'Video'}
            </Text>
          </View>
        </View>
      );
    case 'AUDIO':
      return (
        <View style={styles.inlineRow}>
          <Ionicons name="mic-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.previewText, { color: colors.textSecondary }]}>
            Voice message{message.mediaDuration ? ` · ${formatDuration(message.mediaDuration)}` : ''}
          </Text>
        </View>
      );
    case 'DOCUMENT':
      return (
        <View style={styles.inlineRow}>
          <Ionicons name="document-outline" size={16} color={colors.textSecondary} />
          <Text
            style={[styles.previewText, { color: colors.textSecondary }]}
            numberOfLines={1}>
            {message.fileName || 'Document'}
          </Text>
        </View>
      );
    case 'LOCATION':
      return (
        <View style={styles.inlineRow}>
          <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.previewText, { color: colors.textSecondary }]} numberOfLines={1}>
            {message.locationName || 'Location'}
          </Text>
        </View>
      );
    case 'CONTACT':
      return (
        <View style={styles.inlineRow}>
          <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.previewText, { color: colors.textSecondary }]}>Contact</Text>
        </View>
      );
    case 'CALL': {
      let info: { callType?: string; callStatus?: string; duration?: number | null } = {};
      try {
        info = message.content ? JSON.parse(message.content) : {};
      } catch {
        // fall through
      }
      const icon = info.callType === 'VIDEO' ? 'videocam-outline' : 'call-outline';
      const label =
        info.callStatus === 'ANSWERED' && info.duration
          ? `${info.callType === 'VIDEO' ? 'Video' : 'Voice'} call · ${formatDuration(info.duration)}`
          : info.callStatus === 'MISSED'
            ? `Missed ${info.callType === 'VIDEO' ? 'video' : 'voice'} call`
            : `${info.callType === 'VIDEO' ? 'Video' : 'Voice'} call`;
      return (
        <View style={styles.inlineRow}>
          <Ionicons name={icon as any} size={16} color={colors.textSecondary} />
          <Text style={[styles.previewText, { color: colors.textSecondary }]}>{label}</Text>
        </View>
      );
    }
    case 'STICKER':
      return (
        <Text style={[styles.previewText, { color: colors.textSecondary }]}>Sticker</Text>
      );
    case 'TEXT':
    default:
      return (
        <Text style={[styles.previewText, { color: colors.text }]} numberOfLines={3}>
          {message.content || ''}
        </Text>
      );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string | undefined): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function InitialsAvatar({ name }: { name?: string }) {
  const initials = getInitials(name);
  return (
    <View style={styles.initialsAvatar}>
      <Text style={styles.initialsText}>{initials}</Text>
    </View>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  listContent: {
    paddingVertical: 4,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 76,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  rowBody: {
    flex: 1,
    marginLeft: 12,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  senderName: {
    fontSize: 13,
    marginTop: 2,
  },
  time: {
    fontSize: 12,
  },
  previewText: {
    fontSize: 14,
    marginTop: 4,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  mediaPreview: {
    marginTop: 6,
  },
  mediaImage: {
    width: 160,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
  },
  mediaLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  starBtn: {
    padding: 6,
    marginLeft: 8,
  },
  initialsAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#128C7E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

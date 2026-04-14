import { router } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ChatListItem } from '@/components/chat/chat-list-item';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import { chatApi, contactApi, Chat } from '@/services/api';
import { cache, CacheKeys } from '@/services/cache';

export default function ArchivedChatsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const currentUserId = user?.id;

  const [archivedChats, setArchivedChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Selection state
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const isSelectionMode = selectedChatIds.size > 0;

  const selectedChats = archivedChats.filter((c) => selectedChatIds.has(c.id));

  // Back handler for selection mode
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isSelectionMode) {
        setSelectedChatIds(new Set());
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [isSelectionMode]);

  const fetchArchivedChats = useCallback(async () => {
    try {
      const allChats = await chatApi.getChats();
      // The server filters out isHidden but returns isArchived chats.
      // We need ALL chats including archived ones. But getUserChats filters
      // isHidden only. Archived chats are returned — filter client-side.
      const cachedChats = cache.get<Chat[]>(CacheKeys.CHATS);
      const allData = allChats.length > 0 ? allChats : (cachedChats || []);
      setArchivedChats(allData.filter((c) => c.isArchived));
    } catch (error) {
      console.error('Error fetching archived chats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchArchivedChats();
  }, [fetchArchivedChats]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchArchivedChats();
  }, [fetchArchivedChats]);

  // Selection helpers
  const handleLongPress = useCallback((chatId: string) => {
    setSelectedChatIds(new Set([chatId]));
  }, []);

  const handleSelect = useCallback((chatId: string) => {
    setSelectedChatIds((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) {
        next.delete(chatId);
      } else {
        next.add(chatId);
      }
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectedChatIds(new Set());
    setShowMoreMenu(false);
  }, []);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handleUnarchive = useCallback(async () => {
    try {
      await Promise.all(selectedChats.map((c) => chatApi.archiveChat(c.id, false)));
      setArchivedChats((prev) => prev.filter((c) => !selectedChatIds.has(c.id)));
      // Update main chat list cache
      const cachedChats = cache.get<Chat[]>(CacheKeys.CHATS);
      if (cachedChats) {
        cache.set(
          CacheKeys.CHATS,
          cachedChats.map((c) => (selectedChatIds.has(c.id) ? { ...c, isArchived: false } : c)),
        );
      }
      exitSelectionMode();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to unarchive');
    }
  }, [selectedChats, selectedChatIds, exitSelectionMode]);

  const handleDelete = useCallback(() => {
    const count = selectedChats.length;
    Alert.alert(
      `Delete ${count} chat${count > 1 ? 's' : ''}?`,
      'You can still receive new messages.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(selectedChats.map((c) => chatApi.deleteChat(c.id)));
              setArchivedChats((prev) => prev.filter((c) => !selectedChatIds.has(c.id)));
              exitSelectionMode();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete');
            }
          },
        },
      ],
    );
  }, [selectedChats, selectedChatIds, exitSelectionMode]);

  const handleClearChat = useCallback(() => {
    setShowMoreMenu(false);
    Alert.alert(
      'Clear selected chats?',
      'All messages will be removed for you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(selectedChats.map((c) => chatApi.clearChat(c.id)));
              for (const c of selectedChats) {
                cache.delete(CacheKeys.messages(c.id));
              }
              setArchivedChats((prev) =>
                prev.map((c) =>
                  selectedChatIds.has(c.id) ? { ...c, lastMessage: undefined, unreadCount: 0 } : c,
                ),
              );
              exitSelectionMode();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to clear');
            }
          },
        },
      ],
    );
  }, [selectedChats, selectedChatIds, exitSelectionMode]);

  const handleBlock = useCallback(() => {
    setShowMoreMenu(false);
    const privateChats = selectedChats.filter((c) => c.type === 'PRIVATE');
    if (privateChats.length === 0) {
      Alert.alert('Cannot block', 'You can only block users in private chats.');
      return;
    }
    const names = privateChats.map((c) => c.name || 'Deleted Account').join(', ');
    Alert.alert(
      `Block ${names}?`,
      'They will no longer be able to send you messages.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const chat of privateChats) {
                const otherMember = chat.members?.find((m) => m.userId !== currentUserId);
                if (otherMember) await contactApi.blockUser(otherMember.userId);
              }
              exitSelectionMode();
              Alert.alert('Blocked', 'User(s) blocked successfully.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to block');
            }
          },
        },
      ],
    );
  }, [selectedChats, currentUserId, exitSelectionMode]);

  const handleViewContact = useCallback(() => {
    setShowMoreMenu(false);
    if (selectedChats.length !== 1) return;
    const chat = selectedChats[0];
    exitSelectionMode();
    if (chat.type === 'GROUP') {
      router.push({ pathname: '/group/[id]/info' as any, params: { id: chat.id } });
    } else {
      const otherMember = chat.members?.find((m) => m.userId !== currentUserId);
      if (otherMember) {
        router.push({ pathname: '/chat/user-info' as any, params: { chatId: chat.id, userId: otherMember.userId } });
      } else {
        Alert.alert('Deleted Account', 'This user has deleted their account.');
      }
    }
  }, [selectedChats, currentUserId, exitSelectionMode]);

  const handleMediaLinks = useCallback(() => {
    setShowMoreMenu(false);
    if (selectedChats.length !== 1) return;
    const chat = selectedChats[0];
    exitSelectionMode();
    if (chat.type === 'GROUP') {
      router.push({ pathname: '/group/[id]/info' as any, params: { id: chat.id } });
    } else {
      const otherMember = chat.members?.find((m) => m.userId !== currentUserId);
      if (otherMember) {
        router.push({ pathname: '/chat/user-info' as any, params: { chatId: chat.id, userId: otherMember.userId } });
      }
    }
  }, [selectedChats, currentUserId, exitSelectionMode]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      {isSelectionMode ? (
        <View style={[styles.selectionHeader, { paddingTop: insets.top + 8, backgroundColor: colors.primary }]}>
          <View style={styles.selectionHeaderLeft}>
            <Pressable onPress={exitSelectionMode} hitSlop={12} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            <Text style={styles.selectionCount}>{selectedChatIds.size}</Text>
          </View>
          <View style={styles.selectionHeaderRight}>
            <Pressable onPress={handleUnarchive} hitSlop={8} style={styles.iconBtn}>
              <Ionicons name="archive-outline" size={22} color="#fff" />
            </Pressable>
            <Pressable onPress={handleDelete} hitSlop={8} style={styles.iconBtn}>
              <Ionicons name="trash-outline" size={22} color="#fff" />
            </Pressable>
            <Pressable onPress={() => setShowMoreMenu(true)} hitSlop={8} style={styles.iconBtn}>
              <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.primary }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Archived</Text>
        </View>
      )}

      {archivedChats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="archive-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No archived chats</Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            Chats you archive will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={archivedChats}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatListItem
              chat={item}
              isSelected={selectedChatIds.has(item.id)}
              isSelectionMode={isSelectionMode}
              onLongPress={handleLongPress}
              onSelect={handleSelect}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}

      {/* More Options Menu */}
      <Modal visible={showMoreMenu} transparent animationType="fade">
        <Pressable style={styles.menuOverlay} onPress={() => setShowMoreMenu(false)}>
          <View style={[styles.menuDropdown, { backgroundColor: colors.cardBackground, top: insets.top + 8 }]}>
            {selectedChats.length === 1 && (
              <>
                <Pressable style={styles.menuItem} onPress={handleViewContact}>
                  <Ionicons name="person-outline" size={20} color={colors.text} style={styles.menuIcon} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>View contact</Text>
                </Pressable>
                <Pressable style={styles.menuItem} onPress={handleMediaLinks}>
                  <Ionicons name="images-outline" size={20} color={colors.text} style={styles.menuIcon} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>Media & links</Text>
                </Pressable>
              </>
            )}
            <Pressable style={styles.menuItem} onPress={handleClearChat}>
              <Ionicons name="chatbox-outline" size={20} color={colors.text} style={styles.menuIcon} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>Clear chat</Text>
            </Pressable>
            {selectedChats.some((c) => c.type === 'PRIVATE') && (
              <Pressable style={styles.menuItem} onPress={handleBlock}>
                <Ionicons name="ban-outline" size={20} color="#e74c3c" style={styles.menuIcon} />
                <Text style={[styles.menuItemText, { color: '#e74c3c' }]}>Block</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 12,
  },
  backBtn: { padding: 8 },

  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  selectionHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  selectionCount: { fontSize: 20, fontWeight: '600', color: '#fff', marginLeft: 12 },
  selectionHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 10 },

  listContent: { paddingBottom: 40 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { fontSize: 14, textAlign: 'center', marginTop: 6 },

  menuOverlay: { flex: 1 },
  menuDropdown: {
    position: 'absolute',
    right: 12,
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 220,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuIcon: { marginRight: 14 },
  menuItemText: { fontSize: 15 },
});

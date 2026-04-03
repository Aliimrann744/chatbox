import { router } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ChatListItem } from '@/components/chat/chat-list-item';
import { ProfilePopup } from '@/components/chat/profile-popup';
import { FloatingActionButton } from '@/components/ui/floating-action-button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCall } from '@/contexts/call-context';
import { useAuth } from '@/contexts/auth-context';
import { chatApi, Chat } from '@/services/api';
import socketService from '@/services/socket';
import { cache, CacheKeys } from '@/services/cache';

type FilterType = 'All' | 'Unread' | 'Favorites' | 'Groups';
const FILTERS: FilterType[] = ['All', 'Unread', 'Favorites', 'Groups'];
export default function ChatsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [initialCache] = useState(() => cache.get<Chat[]>(CacheKeys.CHATS));
  const [chats, setChats] = useState<Chat[]>(initialCache || []);
  const [loading, setLoading] = useState(!initialCache);
  const [refreshing, setRefreshing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [popupUser, setPopupUser] = useState<{ id: string; name: string; avatar?: string } | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const { initiateCall } = useCall();

  const fetchChats = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const data = await chatApi.getChats();
      setChats(data);
      cache.set(CacheKeys.CHATS, data);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  // Persist chat list updates to cache
  useEffect(() => {
    if (chats.length > 0) {
      cache.set(CacheKeys.CHATS, chats);
    }
  }, [chats]);

  // Initial load + socket listeners
  useEffect(() => {
    fetchChats();

    const unsubscribeNewMessage = socketService.on('new_message', (message: any) => {
      setChats((prevChats) => {
        const chatIndex = prevChats.findIndex((c) => c.id === message.chatId);
        if (chatIndex === -1) {
          fetchChats();
          return prevChats;
        }

        const updatedChats = [...prevChats];
        updatedChats[chatIndex] = {
          ...updatedChats[chatIndex],
          lastMessage: message,
          unreadCount: updatedChats[chatIndex].unreadCount + 1,
          updatedAt: message.createdAt,
        };

        updatedChats.sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });

        return updatedChats;
      });
    });

    const unsubscribeOnlineStatus = socketService.on('online_status', (data: any) => {
      setChats((prevChats) =>
        prevChats.map((chat) => {
          if (chat.type === 'PRIVATE') {
            const otherMember = chat.members?.find(
              (m) => m.user.id !== data.userId,
            );
            if (otherMember?.user.id === data.userId) {
              return { ...chat, isOnline: data.isOnline, lastSeen: data.lastSeen };
            }
          }
          return chat;
        }),
      );
    });

    return () => {
      unsubscribeNewMessage();
      unsubscribeOnlineStatus();
    };
  }, [fetchChats]);

  // Re-fetch on tab focus
  useFocusEffect(
    useCallback(() => {
      fetchChats();
    }, [fetchChats]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchChats();
  }, [fetchChats]);

  // ─── Filtering ────────────────────────────────────────────────────────────

  const filteredChats = (() => {
    let result = chats;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => (c.name || '').toLowerCase().includes(q));
    }

    switch (activeFilter) {
      case 'Unread':
        result = result.filter((c) => c.unreadCount > 0);
        break;
      case 'Favorites':
        result = result.filter((c) => c.isPinned);
        break;
      case 'Groups':
        result = result.filter((c) => c.type === 'GROUP');
        break;
    }

    return result;
  })();

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleNewChat = () => router.push('/new-chat');

  const handleMenuOption = (option: string) => {
    setShowMenu(false);
    switch (option) {
      case 'new-group':
        router.push('/new-chat');
        break;
      case 'settings':
        router.push('/(tabs)/profile');
        break;
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ─── Custom Header ──────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>WhatsApp</Text>
        <View style={styles.headerIcons}>
          <Pressable style={styles.headerIconButton} hitSlop={8}>
            <Ionicons name="camera-outline" size={24} color={colors.icon} />
          </Pressable>
          <Pressable
            style={styles.headerIconButton}
            hitSlop={8}
            onPress={() => setShowMenu(true)}>
            <Ionicons name="ellipsis-vertical" size={20} color={colors.icon} />
          </Pressable>
        </View>
      </View>

      {/* ─── Search Bar ─────────────────────────────────────────────────────── */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.inputBackground }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Ask Meta AI or Search"
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}> */}
      <View style={styles.filtersRow}>
        {FILTERS?.map((filter) => (
          <Pressable key={filter} onPress={() => setActiveFilter(filter)} style={[styles.filterChip, { backgroundColor: activeFilter === filter ? "#139047" : colors.inputBackground }]}>
            <Text style={[styles.filterChipText, { color: activeFilter === filter ? '#ffffff' : colors.text }]}>
              {filter}
            </Text>
          </Pressable>
        ))}
        <Pressable style={[styles.filterAddButton, { backgroundColor: colors.inputBackground }]}>
          <Ionicons name="add" size={18} color={colors.text} />
        </Pressable>
      </View>
      {/* </ScrollView> */}

      {filteredChats?.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {activeFilter !== 'All' ? `No ${activeFilter.toLowerCase()} chats` : 'No chats yet'}
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            Start a conversation by tapping the button below
          </Text>
        </View>
      ) : (
        <FlatList data={filteredChats} keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatListItem chat={item} onAvatarPress={(user) => { setPopupUser(user); setShowPopup(true); }} />
          )}
          showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}

      <ProfilePopup
        visible={showPopup}
        onClose={() => setShowPopup(false)}
        user={popupUser}
        onMessage={() => {
          // Find the chat with this user and navigate
          const chat = chats.find(c => c.type === 'PRIVATE' && c.members?.some(m => m.user.id === popupUser?.id));
          if (chat) router.push({ pathname: '/chat/[id]', params: { id: chat.id } });
        }}
        onAudioCall={async () => {
          if (popupUser) {
            await initiateCall(popupUser.id, popupUser.name, popupUser.avatar, 'VOICE');
            router.push('/call/active');
          }
        }}
        onVideoCall={async () => {
          if (popupUser) {
            await initiateCall(popupUser.id, popupUser.name, popupUser.avatar, 'VIDEO');
            router.push('/call/active');
          }
        }}
        onInfo={() => {
          // Find the chat with this user and navigate to user info
          const chat = chats.find(c => c.type === 'PRIVATE' && c.members?.some(m => m.user.id === popupUser?.id));
          if (chat) router.push({ pathname: '/chat/user-info', params: { chatId: chat.id, userId: popupUser?.id } });
        }}
      />

      <FloatingActionButton onPress={handleNewChat} icon="message.fill" />
      <Modal visible={showMenu} transparent animationType="fade">
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View
            style={[
              styles.menuDropdown,
              { backgroundColor: colors.cardBackground, top: insets.top + 8 },
            ]}>
            <Pressable
              style={styles.menuItem}
              onPress={() => handleMenuOption('new-group')}>
              <Text style={[styles.menuItemText, { color: colors.text }]}>New group</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => handleMenuOption('settings')}>
              <Text style={[styles.menuItemText, { color: colors.text }]}>Settings</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconButton: {
    padding: 8,
  },

  // ─── Search ──────────────────────────────────────────────────────────────
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },

  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  filterAddButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  listContent: {
    paddingBottom: 100,
  },

  // ─── Empty State ─────────────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
  },

  // ─── Menu ────────────────────────────────────────────────────────────────
  menuOverlay: {
    flex: 1,
  },
  menuDropdown: {
    position: 'absolute',
    right: 12,
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 200,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemText: {
    fontSize: 15,
  },
});

import { router } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View, RefreshControl, ActivityIndicator } from 'react-native';

import { ChatListItem } from '@/components/chat/chat-list-item';
import { FloatingActionButton } from '@/components/ui/floating-action-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { chatApi, Chat } from '@/services/api';
import socketService from '@/services/socket';

type ListItem =
  | { type: 'header'; title: string; id: string }
  | { type: 'chat'; data: Chat };

export default function ChatsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [searchQuery, setSearchQuery] = useState('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch chats from API
  const fetchChats = useCallback(async () => {
    try {
      const data = await chatApi.getChats();
      setChats(data);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchChats();

    // Listen for new messages to update chat list
    const unsubscribeNewMessage = socketService.on('new_message', (message: any) => {
      setChats((prevChats) => {
        const chatIndex = prevChats.findIndex((c) => c.id === message.chatId);
        if (chatIndex === -1) {
          // New chat, refresh the list
          fetchChats();
          return prevChats;
        }

        // Update the chat with new message
        const updatedChats = [...prevChats];
        updatedChats[chatIndex] = {
          ...updatedChats[chatIndex],
          lastMessage: message,
          unreadCount: updatedChats[chatIndex].unreadCount + 1,
          updatedAt: message.createdAt,
        };

        // Sort by updatedAt
        updatedChats.sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });

        return updatedChats;
      });
    });

    // Listen for online status changes
    const unsubscribeOnlineStatus = socketService.on('online_status', (data: any) => {
      setChats((prevChats) =>
        prevChats.map((chat) => {
          // For private chats, update the online status
          if (chat.type === 'PRIVATE') {
            const otherMember = chat.members?.find(
              (m) => m.user.id !== data.userId
            );
            if (otherMember?.user.id === data.userId) {
              return {
                ...chat,
                isOnline: data.isOnline,
                lastSeen: data.lastSeen,
              };
            }
          }
          return chat;
        })
      );
    });

    return () => {
      unsubscribeNewMessage();
      unsubscribeOnlineStatus();
    };
  }, [fetchChats]);

  // Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchChats();
  }, [fetchChats]);

  // Filter chats based on search
  const filteredChats = chats.filter((chat) => (chat.name || '').toLowerCase().includes(searchQuery.toLowerCase()));
  const pinnedChats = filteredChats.filter((chat) => chat.isPinned);
  const regularChats = filteredChats.filter((chat) => !chat.isPinned);

  const listData: ListItem[] = [
    ...(pinnedChats.length > 0 ? [{ type: 'header' as const, title: 'Pinned', id: 'header-pinned' }] : []),
    ...pinnedChats.map((chat) => ({ type: 'chat' as const, data: chat })),
    ...(regularChats.length > 0 && pinnedChats.length > 0
      ? [{ type: 'header' as const, title: 'All Chats', id: 'header-all' }]
      : []),
    ...regularChats.map((chat) => ({ type: 'chat' as const, data: chat })),
  ];

  const renderSectionHeader = (title: string) => (
    <View style={[styles.sectionHeader, { backgroundColor: colors.backgroundSecondary }]}>
      <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>
        {title}
      </Text>
    </View>
  );

  const handleNewChat = () => {
    router.push('/new-chat');
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.inputBackground }]}>
          <IconSymbol name="magnifyingglass" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search chats..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Chat List */}
      {chats.length === 0 ? (
        <View style={[styles.emptyContainer]}>
          <IconSymbol name="message" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No chats yet
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            Start a conversation by tapping the button below
          </Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.type === 'header' ? item.id : `chat-${item.data.id}`}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return renderSectionHeader(item.title);
            }
            return <ChatListItem chat={item.data} />;
          }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* Floating Action Button */}
      <FloatingActionButton onPress={handleNewChat} icon="message.fill" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  listContent: {
    paddingBottom: 100,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});

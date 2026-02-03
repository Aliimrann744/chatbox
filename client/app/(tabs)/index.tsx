import { router } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { ChatListItem } from '@/components/chat/chat-list-item';
import { FloatingActionButton } from '@/components/ui/floating-action-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Chat, mockChats } from '@/constants/mock-data';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ListItem =
  | { type: 'header'; title: string; id: string }
  | { type: 'chat'; data: Chat };

export default function ChatsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChats = mockChats.filter((chat) =>
    chat.user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      />

      {/* Floating Action Button */}
      <FloatingActionButton onPress={handleNewChat} icon="message.fill" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
});

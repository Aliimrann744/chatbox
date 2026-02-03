import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import { mockUsers } from '@/constants/mock-data';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ActionItemProps {
  icon: IconSymbolName;
  iconColor: string;
  title: string;
  onPress?: () => void;
}

function ActionItem({ icon, iconColor, title, onPress }: ActionItemProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionItem,
        {
          backgroundColor: pressed ? colors.backgroundSecondary : colors.background,
        },
      ]}>
      <View style={[styles.actionIconContainer, { backgroundColor: iconColor }]}>
        <IconSymbol name={icon} size={22} color="#ffffff" />
      </View>
      <Text style={[styles.actionTitle, { color: colors.text }]}>{title}</Text>
    </Pressable>
  );
}

function ContactItem({
  user,
  onPress,
}: {
  user: typeof mockUsers[0];
  onPress?: () => void;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.contactItem,
        {
          backgroundColor: pressed ? colors.backgroundSecondary : colors.background,
        },
      ]}>
      <Avatar uri={user.avatar} size={45} showOnlineStatus isOnline={user.isOnline} />
      <View style={styles.contactInfo}>
        <Text style={[styles.contactName, { color: colors.text }]}>{user.name}</Text>
        <Text style={[styles.contactStatus, { color: colors.textSecondary }]}>
          {user.status}
        </Text>
      </View>
    </Pressable>
  );
}

export default function NewChatScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [searchQuery, setSearchQuery] = useState('');

  const filteredContacts = mockUsers.filter((user) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectContact = (userId: string) => {
    // Navigate to chat with this user or create new chat
    router.push({ pathname: '/chat/[id]', params: { id: userId } });
  };

  const handleNewGroup = () => {
    // TODO: Navigate to new group screen
  };

  const handleNewContact = () => {
    // TODO: Navigate to add contact screen
  };

  const handleNewCommunity = () => {
    // TODO: Navigate to new community screen
  };

  const renderHeader = () => (
    <>
      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.inputBackground }]}>
          <IconSymbol name="magnifyingglass" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search contacts..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Action Items */}
      <View style={styles.actionsContainer}>
        <ActionItem
          icon="person.2.fill"
          iconColor={colors.primary}
          title="New Group"
          onPress={handleNewGroup}
        />
        <ActionItem
          icon="person.badge.plus"
          iconColor={colors.primary}
          title="New Contact"
          onPress={handleNewContact}
        />
        <ActionItem
          icon="building.2.fill"
          iconColor={colors.primary}
          title="New Community"
          onPress={handleNewCommunity}
        />
      </View>

      {/* Contacts Section Header */}
      <View style={[styles.sectionHeader, { backgroundColor: colors.backgroundSecondary }]}>
        <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>
          Contacts on Chatbox
        </Text>
      </View>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ContactItem user={item} onPress={() => handleSelectContact(item.id)} />
        )}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No contacts found
            </Text>
          </View>
        }
      />
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
  actionsContainer: {
    paddingVertical: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionIconContainer: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '500',
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
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  contactInfo: {
    flex: 1,
    marginLeft: 14,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  contactStatus: {
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
});

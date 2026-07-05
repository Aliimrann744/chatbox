import { router } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { contactApi, chatApi, Contact } from '@/services/api';
import { useContacts } from '@/contexts/contacts-context';
import { resolvePrivateDisplayName } from '@/utils/contact-identity';
import { getInitials } from '@/utils/helpers';

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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionItem, { backgroundColor: pressed ? colors.backgroundSecondary : colors.background }]}>
      <View style={[styles.actionIconContainer, { backgroundColor: iconColor }]}>
        <IconSymbol name={icon} size={22} color="#ffffff" />
      </View>
      <Text style={[styles.actionTitle, { color: colors.text }]}>{title}</Text>
    </Pressable>
  );
}

function ContactItem({
  contact,
  onPress,
}: {
  contact: Contact;
  onPress?: () => void;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const displayName = resolvePrivateDisplayName({
    id: contact.contactId,
    name: contact.name,
    phone: contact.phone,
    countryCode: contact.countryCode,
    isAdmin: contact.isAdmin,
  }, contact);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.contactItem,
        {
          backgroundColor: pressed ? colors.backgroundSecondary : colors.background,
        },
      ]}>
      {contact?.avatar ? (
        <Avatar uri={contact.avatar || ""} size={38} showOnlineStatus isOnline={contact.isOnline} />
      ) : (
        <View style={{ width: 42, height: 42, borderRadius: 25, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#374151" }}>
            {getInitials(displayName) || "User"}
          </Text>
        </View>
      )}
      <View style={styles.contactInfo}>
        <Text style={[styles.contactName, { color: colors.text }]}>{displayName}</Text>
        <Text style={[styles.contactStatus, { color: colors.textSecondary }]}>
          {contact.about || contact.phone}
        </Text>
      </View>
    </Pressable>
  );
}

export default function NewChatScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const { syncDeviceContacts } = useContacts();

  // Auto-sync device contacts then fetch contacts list
  const syncAndFetch = useCallback(async () => {
    try {
      setContacts(await syncDeviceContacts(true));
    } catch (error) {
      console.error('Error syncing contacts:', error);
      try {
        const data = await contactApi.getContacts();
        setContacts(data);
      } catch {
        // Silent fail
      }
    } finally {
      setLoading(false);
    }
  }, [syncDeviceContacts]);

  // Sync on mount
  useEffect(() => {
    syncAndFetch();
  }, [syncAndFetch]);

  const filteredContacts = contacts.filter((contact) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const displayName = resolvePrivateDisplayName({ id: contact.contactId, phone: contact.phone, countryCode: contact.countryCode, name: contact.name, isAdmin: contact.isAdmin }, contact).toLowerCase();
    return displayName.includes(q) || contact.phone.includes(q);
  });

  const handleSelectContact = async (contactId: string) => {
    if (creating) return;

    setCreating(true);
    try {
      const chat = await chatApi.createChat(contactId);
      router.replace({ pathname: '/chat/[id]', params: { id: chat.id } });
    } catch (error: any) {
      console.error('Error creating chat:', error);
      Alert.alert('Error', error.message || 'Failed to start chat. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleNewGroup = () => {
    router.push('/group/new');
  };

  const handleNewContact = () => {
    router.push('/(tabs)/contacts');
  };

  const handleNewCommunity = () => {
    Alert.alert('Coming Soon', 'Community feature is coming soon!');
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
      {creating && (
        <View style={styles.creatingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.creatingText}>Starting chat...</Text>
        </View>
      )}

      {/* Search Bar - outside FlatList to prevent focus loss */}
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
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <IconSymbol name="xmark.circle.fill" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ContactItem contact={item} onPress={() => handleSelectContact(item.contactId)} />
        )}
        ListHeaderComponent={
          <>
            {/* Action Items */}
            {!searchQuery && (
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
            )}

            {/* Contacts Section Header */}
            <View style={[styles.sectionHeader, { backgroundColor: colors.backgroundSecondary }]}>
              <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>
                Contacts on Whatchat
              </Text>
            </View>
          </>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol name="person" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {searchQuery ? 'No contacts found' : contacts.length === 0 ? 'No contacts yet' : 'No contacts found'}
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              {searchQuery ? 'Try a different search' : 'Save contacts on your phone to see them here'}
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  creatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  creatingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 12,
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
    paddingVertical: 60,
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

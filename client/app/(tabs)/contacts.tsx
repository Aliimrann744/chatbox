import { router } from 'expo-router';
import * as Contacts from 'expo-contacts';
import React, { useState, useEffect, useCallback } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, TextInput, View, ActivityIndicator, SectionList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Avatar } from '@/components/ui/avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { contactApi, chatApi, Contact } from '@/services/api';

interface ContactSection {
  title: string;
  data: Contact[];
}

export default function ContactsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Auto-sync device contacts with server
  const autoSync = useCallback(async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        // Permission denied - fall back to fetching existing contacts
        const data = await contactApi.getContacts();
        setContacts(data);
        return;
      }

      // Get device contacts with names
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      // Build {phone, name}[] from device contacts
      const deviceContacts: { phone: string; name: string }[] = [];
      data.forEach((contact) => {
        const contactName = contact.name || '';
        if (contact.phoneNumbers) {
          contact.phoneNumbers.forEach((phone) => {
            if (phone.number) {
              const cleaned = phone.number.replace(/[\s\-\(\)]/g, '');
              deviceContacts.push({ phone: cleaned, name: contactName });
            }
          });
        }
      });

      if (deviceContacts.length === 0) {
        // No phone contacts - fetch existing contacts from server
        const data = await contactApi.getContacts();
        setContacts(data);
        return;
      }

      // Sync with server - returns Contact[] with auto-added contacts
      const syncedContacts = await contactApi.syncContacts(deviceContacts);
      setContacts(syncedContacts);
    } catch (error) {
      console.error('Error syncing contacts:', error);
      // Fall back to fetching existing contacts
      try {
        const data = await contactApi.getContacts();
        setContacts(data);
      } catch {
        // Silent fail
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Auto-sync on mount
  useEffect(() => {
    autoSync();
  }, [autoSync]);

  // Re-sync on tab focus (detects newly saved phone contacts)
  useFocusEffect(
    useCallback(() => {
      if (!loading) {
        autoSync();
      }
    }, [autoSync, loading])
  );

  // Pull-to-refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    autoSync();
  }, [autoSync]);

  // Start chat with contact
  const handleStartChat = async (contactId: string) => {
    try {
      const chat = await chatApi.createChat(contactId);
      router.push({ pathname: '/chat/[id]', params: { id: chat.id } });
    } catch (error) {
      console.error('Error creating chat:', error);
      Alert.alert('Error', 'Failed to start chat. Please try again.');
    }
  };

  // Local search - filter by nickname, name, or phone
  const filteredContacts = contacts.filter((contact) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const displayName = (contact.nickname || contact.name || '').toLowerCase();
    const phone = contact.phone || '';
    return displayName.includes(q) || phone.includes(q);
  });

  // Group contacts alphabetically
  const groupedContacts: ContactSection[] = [];
  const grouped: { [key: string]: Contact[] } = {};

  filteredContacts.forEach((contact) => {
    const displayName = contact.nickname || contact.name || '?';
    const firstLetter = displayName.charAt(0).toUpperCase();
    if (!grouped[firstLetter]) {
      grouped[firstLetter] = [];
    }
    grouped[firstLetter].push(contact);
  });

  Object.keys(grouped).sort().forEach((letter) => {
    groupedContacts.push({ title: letter, data: grouped[letter] });
  });

  function getInitials(name: string): string {
    if (!name || !name.trim()) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  const renderContactItem = ({ item }: { item: Contact }) => {
    const displayName = item.nickname || item.name;
    return (
      <Pressable
        onPress={() => handleStartChat(item.contactId)}
        style={({ pressed }) => [
          styles.contactItem,
          { backgroundColor: pressed ? colors.primary + '12' : colors.background },
          pressed && styles.contactItemPressed,
        ]}
      >
        {item?.avatar ? (
          <Avatar uri={item.avatar || ""} size={50} showOnlineStatus isOnline={item.isOnline} />
        ) : (
          <View style={[styles.initialsContainer, { backgroundColor: colors.primary }]}>
            <Text style={styles.initialsText}>{getInitials(displayName)}</Text>
          </View>
        )}
        <View style={styles.contactInfo}>
          <Text style={[styles.contactName, { color: colors.text }]}>{displayName}</Text>
          <Text style={[styles.contactAbout, { color: colors.textSecondary }]}>
            {item.about || item.phone}
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderSectionHeader = ({ section }: { section: ContactSection }) => (
    <View style={[styles.sectionHeader, { backgroundColor: colors.backgroundSecondary }]}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {section.title}
      </Text>
    </View>
  );

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
      <View style={[styles.headerBar, { backgroundColor: colors.backgroundSecondary }]}>
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

      {/* No results message when search matches nothing */}
      {searchQuery.length > 0 && filteredContacts.length === 0 ? (
        <View style={styles.emptySearch}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No results found
          </Text>
        </View>
      ) : (
        <>
          {/* Invite Link */}
          {!searchQuery && (
            <Pressable
              style={[styles.inviteSection, { backgroundColor: colors.background }]}
              onPress={() => {
                Alert.alert('Invite', 'Share invite link feature coming soon!');
              }}>
              <View style={[styles.inviteIcon, { backgroundColor: colors.primary + '20' }]}>
                <IconSymbol name="person.badge.plus" size={24} color={colors.textSecondary} />
              </View>
              <View style={styles.inviteText}>
                <Text style={[styles.inviteTitle, { color: colors.text }]}>
                  Invite Friends
                </Text>
                <Text style={[styles.inviteSubtitle, { color: colors.textSecondary }]}>
                  Share Chatbox with your friends
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
            </Pressable>
          )}

          {/* Contacts List */}
          {contacts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol name="person.2" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No contacts yet
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Save contacts on your phone to see them here
              </Text>
            </View>
          ) : (
            <SectionList
              sections={groupedContacts}
              keyExtractor={(item) => item.id}
              renderItem={renderContactItem}
              renderSectionHeader={renderSectionHeader}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                />
              }
              ListHeaderComponent={
                <Text style={[styles.contactCount, { color: colors.textSecondary }]}>
                  {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
                </Text>
              }
            />
          )}
        </>
      )}
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
  initialsContainer: {
    width: 50,
    height: 50,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "#fff",
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  searchBar: {
    flex: 1,
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
  inviteSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  inviteIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteText: {
    flex: 1,
    marginLeft: 12,
  },
  inviteTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  inviteSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  contactCount: {
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  contactItemPressed: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
  },
  contactAbout: {
    fontSize: 13,
    marginTop: 2,
  },
  listContent: {
    paddingBottom: 100,
  },
  emptySearch: {
    alignItems: 'center',
    paddingTop: 40,
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

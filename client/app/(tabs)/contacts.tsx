import { router } from 'expo-router';
import * as Contacts from 'expo-contacts';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  SectionList,
} from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { contactApi, chatApi, Contact, User, SyncedContact } from '@/services/api';

interface ContactSection {
  title: string;
  data: (Contact | SyncedContact)[];
}

export default function ContactsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Fetch contacts from server
  const fetchContacts = useCallback(async () => {
    try {
      const data = await contactApi.getContacts();
      setContacts(data);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchContacts();
  }, [fetchContacts]);

  // Sync device contacts
  const syncContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Contacts permission is required to sync your contacts.',
          [{ text: 'OK' }]
        );
        return;
      }

      setSyncing(true);

      // Get all contacts from device
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });

      // Extract phone numbers
      const phoneNumbers: string[] = [];
      data.forEach((contact) => {
        if (contact.phoneNumbers) {
          contact.phoneNumbers.forEach((phone) => {
            if (phone.number) {
              // Clean phone number (remove spaces, dashes, etc.)
              const cleaned = phone.number.replace(/[\s\-\(\)]/g, '');
              phoneNumbers.push(cleaned);
            }
          });
        }
      });

      if (phoneNumbers.length === 0) {
        Alert.alert('No Contacts', 'No phone numbers found in your contacts.');
        return;
      }

      // Sync with server
      const syncedContacts = await contactApi.syncContacts(phoneNumbers);

      // Show results
      const newContacts = syncedContacts.filter((c) => !c.isContact);
      if (newContacts.length > 0) {
        Alert.alert(
          'Contacts Found',
          `Found ${newContacts.length} new contact(s) on Chatbox!`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Up to Date',
          'All your contacts using Chatbox are already in your list.',
          [{ text: 'OK' }]
        );
      }

      // Refresh contacts list
      fetchContacts();
    } catch (error) {
      console.error('Error syncing contacts:', error);
      Alert.alert('Error', 'Failed to sync contacts. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  // Search users
  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const results = await contactApi.searchUsers(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  };

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

  // Add contact
  const handleAddContact = async (userId: string) => {
    try {
      await contactApi.addContact(userId);
      Alert.alert('Success', 'Contact added successfully!');
      fetchContacts();
      setSearchResults((prev) => prev.filter((u) => u.id !== userId));
    } catch (error) {
      console.error('Error adding contact:', error);
      Alert.alert('Error', 'Failed to add contact. Please try again.');
    }
  };

  // Filter contacts based on search
  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone.includes(searchQuery)
  );

  // Group contacts alphabetically
  const groupedContacts: ContactSection[] = [];
  const grouped: { [key: string]: Contact[] } = {};

  filteredContacts.forEach((contact) => {
    const firstLetter = contact.name.charAt(0).toUpperCase();
    if (!grouped[firstLetter]) {
      grouped[firstLetter] = [];
    }
    grouped[firstLetter].push(contact);
  });

  Object.keys(grouped)
    .sort()
    .forEach((letter) => {
      groupedContacts.push({
        title: letter,
        data: grouped[letter],
      });
    });

  const renderContactItem = ({ item }: { item: Contact | SyncedContact }) => (
    <Pressable
      onPress={() => handleStartChat(item.id)}
      style={({ pressed }) => [
        styles.contactItem,
        { backgroundColor: pressed ? colors.backgroundSecondary : colors.background },
      ]}>
      <Avatar uri={item.avatar} size={50} showOnlineStatus isOnline={item.isOnline} />
      <View style={styles.contactInfo}>
        <Text style={[styles.contactName, { color: colors.text }]}>{item.name}</Text>
        <Text style={[styles.contactAbout, { color: colors.textSecondary }]}>
          {item.about || item.phone}
        </Text>
      </View>
      <Pressable
        onPress={() => handleStartChat(item.id)}
        style={styles.chatButton}>
        <IconSymbol name="message.fill" size={20} color={colors.primary} />
      </Pressable>
    </Pressable>
  );

  const renderSearchResult = ({ item }: { item: User }) => {
    const isContact = contacts.some((c) => c.contactId === item.id);

    return (
      <View style={[styles.contactItem, { backgroundColor: colors.background }]}>
        <Avatar uri={item.avatar} size={50} showOnlineStatus isOnline={item.isOnline} />
        <View style={styles.contactInfo}>
          <Text style={[styles.contactName, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.contactAbout, { color: colors.textSecondary }]}>
            {item.about || item.phone}
          </Text>
        </View>
        {isContact ? (
          <Pressable
            onPress={() => handleStartChat(item.id)}
            style={styles.chatButton}>
            <IconSymbol name="message.fill" size={20} color={colors.primary} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => handleAddContact(item.id)}
            style={[styles.addButton, { backgroundColor: colors.primary }]}>
            <IconSymbol name="plus" size={18} color="#ffffff" />
          </Pressable>
        )}
      </View>
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
      {/* Search and Sync Bar */}
      <View style={[styles.headerBar, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.inputBackground }]}>
          <IconSymbol name="magnifyingglass" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search contacts or users..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={handleSearch}
            onFocus={() => setShowSearch(true)}
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => {
                setSearchQuery('');
                setSearchResults([]);
              }}>
              <IconSymbol name="xmark.circle.fill" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        <Pressable
          onPress={syncContacts}
          disabled={syncing}
          style={[
            styles.syncButton,
            { backgroundColor: colors.primary },
            syncing && styles.syncingButton,
          ]}>
          {syncing ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <IconSymbol name="arrow.triangle.2.circlepath" size={20} color="#ffffff" />
          )}
        </Pressable>
      </View>

      {/* Search Results or Contacts List */}
      {searchQuery.length >= 2 ? (
        <View style={styles.searchResultsContainer}>
          <Text style={[styles.searchResultsTitle, { color: colors.textSecondary }]}>
            Search Results
          </Text>
          {searching ? (
            <ActivityIndicator style={styles.searchLoading} color={colors.primary} />
          ) : searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={renderSearchResult}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptySearch}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No users found
              </Text>
            </View>
          )}
        </View>
      ) : (
        <>
          {/* Invite Link */}
          <Pressable
            style={[styles.inviteSection, { backgroundColor: colors.background }]}
            onPress={() => {
              // TODO: Share invite link
              Alert.alert('Invite', 'Share invite link feature coming soon!');
            }}>
            <View style={[styles.inviteIcon, { backgroundColor: colors.primary + '20' }]}>
              <IconSymbol name="person.badge.plus" size={24} color={colors.primary} />
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

          {/* Contacts List */}
          {contacts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol name="person.2" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No contacts yet
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Sync your contacts or search for users
              </Text>
              <Pressable
                onPress={syncContacts}
                style={[styles.syncContactsButton, { backgroundColor: colors.primary }]}>
                <Text style={styles.syncContactsText}>Sync Contacts</Text>
              </Pressable>
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
  syncButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncingButton: {
    opacity: 0.7,
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
  chatButton: {
    padding: 10,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 100,
  },
  searchResultsContainer: {
    flex: 1,
  },
  searchResultsTitle: {
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 16,
    paddingVertical: 8,
    textTransform: 'uppercase',
  },
  searchLoading: {
    marginTop: 20,
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
  syncContactsButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
  },
  syncContactsText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

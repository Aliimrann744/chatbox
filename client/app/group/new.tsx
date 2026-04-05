import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { contactApi, Contact } from '@/services/api';
import { getInitials } from '@/utils/helpers';

export default function NewGroupMembersScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await contactApi.getContacts();
        setContacts(data);
      } catch (e) {
        console.error('Failed to load contacts', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedContacts = useMemo(() => contacts.filter((c) => selectedIds.includes(c.contactId)), [contacts, selectedIds]);

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter((c) => {
      const name = (c.nickname || c.name || '').toLowerCase();
      return name.includes(q) || c.phone.includes(q);
    });
  }, [contacts, searchQuery]);

  const toggleSelect = useCallback((contactId: string) => {
    setSelectedIds((prev) => prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]);

  }, []);

  const handleNext = () => {
    if (selectedIds?.length === 0) return;
    const payload = selectedContacts?.map((c) => ({
      id: c.contactId,
      name: c.nickname || c.name,
      phone: c.phone,
      avatar: c.avatar,
    }));
    router.push({ pathname: '/group/setup', params: { members: JSON.stringify(payload) }});
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Selected chips */}
      {selectedContacts.length > 0 && (
        <View style={[styles.chipsWrapper, { borderBottomColor: colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {selectedContacts?.map((c) => (
              <Pressable key={c.contactId} onPress={() => toggleSelect(c.contactId)} style={styles.chip}>
                {c.avatar ? (<Avatar uri={c.avatar} size={52} />) : (
                  <View style={[styles.chipInitials, { backgroundColor: colors.primary }]}>
                    <Text style={styles.chipInitialsText}>{getInitials(c.nickname || c.name) || '?'}</Text>
                  </View>
                )}
                <View style={styles.removeBadge}>
                  <IconSymbol name="xmark" size={12} color="#ffffff" />
                </View>
                <Text numberOfLines={1} style={[styles.chipName, { color: colors.text }]}>
                  {c.nickname || c.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.inputBackground }]}>
          <IconSymbol name="magnifyingglass" size={18} color={colors.textSecondary} />
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

      {/* Contact list */}
      <FlatList
        data={filteredContacts}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item }) => {
          const isSelected = selectedIds.includes(item.contactId);
          return (
            <Pressable onPress={() => toggleSelect(item.contactId)} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.backgroundSecondary : colors.background }]}>
              <View>
                {item.avatar ? (<Avatar uri={item.avatar} size={44} />) : (
                  <View style={[styles.rowInitials, { backgroundColor: '#E5E7EB' }]}>
                    <Text style={styles.rowInitialsText}>
                      {getInitials(item.nickname || item.name) || '?'}
                    </Text>
                  </View>
                )}
                {isSelected && (
                  <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                    <IconSymbol name="checkmark" size={12} color="#ffffff" />
                  </View>
                )}
              </View>
              <View style={styles.rowInfo}>
                <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
                  {item.nickname || item.name}
                </Text>
                <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.about || item.phone}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <IconSymbol name="person" size={40} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {searchQuery ? 'No contacts found' : 'No contacts yet'}
            </Text>
          </View>
        }
      />

      {selectedIds.length > 0 && (
        <Pressable onPress={handleNext} style={[styles.nextBtn, { backgroundColor: colors.primary, bottom: insets.bottom + 20 }]}>
          <IconSymbol name="arrow.right" size={24} color="#ffffff" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  chipsWrapper: { borderBottomWidth: StyleSheet.hairlineWidth },
  chipsRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 12 },
  chip: { width: 62, alignItems: 'center' },
  chipInitials: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipInitialsText: { color: '#ffffff', fontSize: 18, fontWeight: '600' },
  removeBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  chipName: { fontSize: 12, marginTop: 4, maxWidth: 60 },
  searchContainer: { paddingHorizontal: 16, paddingVertical: 10 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 16, padding: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowInitials: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInitialsText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  checkBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  rowInfo: { flex: 1, marginLeft: 14 },
  rowName: { fontSize: 16, fontWeight: '500' },
  rowSub: { fontSize: 13, marginTop: 2 },
  emptyWrap: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { fontSize: 15, marginTop: 12 },
  nextBtn: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
});

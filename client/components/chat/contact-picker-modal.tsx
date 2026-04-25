import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { contactApi, Contact } from '@/services/api';
import { getInitials } from '@/utils/helpers';

interface ContactPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (contacts: Contact[]) => void;
  /** Maximum contacts the user can select. Defaults to unlimited. */
  maxSelection?: number;
  title?: string;
  /** Text shown on the confirm button. Defaults to "Send". */
  confirmLabel?: string;
}

/**
 * Multi-select contact picker used by the status forward and
 * camera-to-chat share flows. Fetches the user's Whatchat contacts and
 * lets the caller cap the number of recipients.
 */
export function ContactPickerModal({
  visible,
  onClose,
  onConfirm,
  maxSelection,
  title = 'Send to...',
  confirmLabel = 'Send',
}: ContactPickerModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [limitHit, setLimitHit] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSelectedIds(new Set());
      setSearchQuery('');
      setLimitHit(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    contactApi
      .getContacts()
      .then((data) => {
        if (!cancelled) setContacts(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const filtered = useMemo(() => {
    if (!searchQuery) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter((c) => {
      const name = (c.nickname || c.name || '').toLowerCase();
      return name.includes(q) || (c.phone || '').includes(q);
    });
  }, [contacts, searchQuery]);

  const selectedContacts = useMemo(
    () => contacts.filter((c) => selectedIds.has(c.contactId)),
    [contacts, selectedIds]
  );

  const toggleSelect = useCallback(
    (contact: Contact) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(contact.contactId)) {
          next.delete(contact.contactId);
          setLimitHit(false);
          return next;
        }
        if (maxSelection && next.size >= maxSelection) {
          setLimitHit(true);
          return prev;
        }
        next.add(contact.contactId);
        setLimitHit(false);
        return next;
      });
    },
    [maxSelection]
  );

  const handleConfirm = () => {
    if (selectedContacts.length === 0) return;
    onConfirm(selectedContacts);
  };

  const renderContact = ({ item }: { item: Contact }) => {
    const selected = selectedIds.has(item.contactId);
    return (
      <Pressable
        onPress={() => toggleSelect(item)}
        style={({ pressed }) => [
          styles.contactRow,
          { backgroundColor: pressed ? colors.backgroundSecondary : 'transparent' },
        ]}>
        {item.avatar ? (
          <Avatar uri={item.avatar} size={46} showOnlineStatus={false} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.avatarInitial, { color: colors.text }]}>
              {getInitials(item.nickname || item.name) || 'U'}
            </Text>
          </View>
        )}
        <View style={styles.contactInfo}>
          <Text style={[styles.contactName, { color: colors.text }]} numberOfLines={1}>
            {item.nickname || item.name}
          </Text>
          {!!item.about && (
            <Text style={[styles.contactAbout, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.about}
            </Text>
          )}
        </View>
        <View
          style={[
            styles.checkbox,
            {
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected ? colors.primary : 'transparent',
            },
          ]}>
          {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: colors.primary, paddingTop: insets.top + 8 },
          ]}>
          <Pressable onPress={onClose} style={styles.headerButton} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={colors.headerText} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: colors.headerText }]}>{title}</Text>
            {selectedContacts.length > 0 && (
              <Text style={[styles.headerSubtitle, { color: colors.headerText }]}>
                {selectedContacts.length}
                {maxSelection ? `/${maxSelection}` : ''} selected
              </Text>
            )}
          </View>
        </View>

        {/* Search */}
        <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.searchBar, { backgroundColor: colors.inputBackground }]}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search contacts..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {limitHit && maxSelection ? (
          <Text style={styles.limitNotice}>
            You can only select up to {maxSelection} contacts.
          </Text>
        ) : null}

        {/* List */}
        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginTop: 40 }}
          />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderContact}
            contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={{ color: colors.textSecondary }}>No contacts found</Text>
              </View>
            }
          />
        )}

        {/* Footer confirm */}
        {selectedContacts.length > 0 && (
          <View
            style={[
              styles.footer,
              { paddingBottom: insets.bottom + 12, backgroundColor: colors.background },
            ]}>
            <View style={styles.selectedPreview}>
              <Text style={[styles.selectedPreviewText, { color: colors.text }]} numberOfLines={1}>
                {selectedContacts.map((c) => c.nickname || c.name).join(', ')}
              </Text>
            </View>
            <Pressable
              style={[styles.confirmButton, { backgroundColor: colors.primary }]}
              onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
              <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: 6 }} />
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  headerButton: {
    padding: 8,
  },
  headerTitleWrap: {
    marginLeft: 4,
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    opacity: 0.85,
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  limitNotice: {
    color: '#e74c3c',
    textAlign: 'center',
    fontSize: 13,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '600',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '500',
  },
  contactAbout: {
    fontSize: 13,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
    gap: 12,
  },
  selectedPreview: {
    flex: 1,
  },
  selectedPreviewText: {
    fontSize: 13,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});

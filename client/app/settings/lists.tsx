import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '@/components/ui/avatar';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { chatApi, contactApi, Chat, Contact } from '@/services/api';
import { getInitials } from '@/utils/helpers';
import { SettingsScreen } from '@/components/settings/settings-ui';

type Tab = 'contacts' | 'groups';

export default function ListsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [tab, setTab] = useState<Tab>('contacts');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [c, chats] = await Promise.all([
          contactApi.getContacts().catch(() => [] as Contact[]),
          chatApi.getChats().catch(() => [] as Chat[]),
        ]);
        setContacts(c);
        setGroups(chats.filter((ch) => ch.type === 'GROUP'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const data: any[] = tab === 'contacts' ? contacts : groups;

  return (
    <SettingsScreen
      title="Lists"
      scroll={false}
      rightAction={
        tab === 'groups' ? (
          <Pressable
            onPress={() => router.push('/group/new')}
            hitSlop={10}
            style={{ paddingHorizontal: 8 }}>
            <Ionicons name="add" size={26} color="#fff" />
          </Pressable>
        ) : undefined
      }>
      {/* Segmented tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(['contacts', 'groups'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[
              styles.tab,
              tab === t && { borderBottomColor: colors.primary },
            ]}>
            <Text
              style={[
                styles.tabText,
                { color: tab === t ? colors.primary : colors.textSecondary },
              ]}>
              {t === 'contacts' ? `Contacts (${contacts.length})` : `Groups (${groups.length})`}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : data.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons
            name={tab === 'contacts' ? 'people-outline' : 'people-circle-outline'}
            size={48}
            color={colors.textSecondary}
          />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {tab === 'contacts' ? 'No contacts yet' : 'No groups yet'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item: any) => item.id}
          renderItem={({ item }) => {
            if (tab === 'contacts') {
              const c = item as Contact;
              const name = c.nickname || c.name;
              return (
                <View style={styles.row}>
                  <Avatar uri={c.avatar || ''} size={44} showOnlineStatus={false} />
                  <View style={styles.rowBody}>
                    <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                      {name}
                    </Text>
                    {c.about ? (
                      <Text
                        style={[styles.rowSub, { color: colors.textSecondary }]}
                        numberOfLines={1}>
                        {c.about}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            }
            const g = item as Chat;
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: colors.backgroundSecondary },
                ]}
                onPress={() => router.push({ pathname: '/group/[id]/info', params: { id: g.id } })}>
                {g.avatar ? (
                  <Avatar uri={g.avatar} size={44} showOnlineStatus={false} />
                ) : (
                  <View style={[styles.initials, { backgroundColor: colors.backgroundSecondary }]}>
                    <Text style={{ color: colors.text, fontWeight: '600' }}>
                      {getInitials(g.name || 'G')}
                    </Text>
                  </View>
                )}
                <View style={styles.rowBody}>
                  <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                    {g.name || 'Group'}
                  </Text>
                  <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={1}>
                    {g.members?.length || 0} participants
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => (
            <View style={[styles.sep, { backgroundColor: colors.border }]} />
          )}
          contentContainerStyle={{ backgroundColor: colors.background }}
        />
      )}
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: { fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
  },
  initials: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '500' },
  rowSub: { fontSize: 13, marginTop: 2 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 74 },
});

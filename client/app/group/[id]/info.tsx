import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import { contactApi, groupApi, uploadApi, Contact, GroupChat, GroupMember } from '@/services/api';
import { pickImage } from '@/utils/media-picker';
import { getInitials } from '@/utils/helpers';

function resolveMemberDisplayName(member: GroupMember, contactsById: Record<string, Contact>, myId?: string): string {
  if (member.userId === myId) return 'You';
  const contact = contactsById[member.userId];
  if (contact) return contact.nickname || contact.name;
  const u = member.user;
  if (u.phone && u.countryCode) return `${u.countryCode}${u.phone}`;
  return u.name || 'Unknown';
}

export default function GroupInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [group, setGroup] = useState<GroupChat | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [g, c] = await Promise.all([
        groupApi.getGroup(id),
        contactApi.getContacts().catch(() => [] as Contact[]),
      ]);
      setGroup(g);
      setContacts(c);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load group.');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();

  }, [load]);

  const contactsById = useMemo(() => {
    const map: Record<string, Contact> = {};
    for (const c of contacts) map[c.contactId] = c;
    return map;
  }, [contacts]);

  const myMembership = useMemo(
    () => group?.members.find((m) => m.userId === user?.id) ?? null,
    [group, user?.id],
  );
  const amAdmin = myMembership?.role === 'ADMIN';
  const amCreator = group?.creatorId === user?.id;

  const canEditInfo =
    !!myMembership &&
    (group?.editInfoRole === 'ALL_MEMBERS' || amAdmin);

  const canAddMembers =
    !!myMembership &&
    (group?.addMembersRole === 'ALL_MEMBERS' || amAdmin);

  const handleChangeAvatar = async () => {
    if (!group || !canEditInfo) {
      if (!canEditInfo) Alert.alert('Not allowed', 'Only admins can change the group icon.');
      return;
    }
    try {
      const picked = await pickImage();
      if (!picked) return;
      setBusy(true);
      const uploaded = await uploadApi.uploadFile(
        { uri: picked.uri, type: picked.mimeType, name: picked.name },
        'group-avatars',
      );
      const updated = await groupApi.updateGroup(group.id, { avatar: uploaded.url });
      setGroup(updated);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update icon.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveName = async () => {
    if (!group) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === group.name) {
      setEditingName(false);
      return;
    }
    try {
      setBusy(true);
      const updated = await groupApi.updateGroup(group.id, { name: trimmed });
      setGroup(updated);
      setEditingName(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update name.');
    } finally {
      setBusy(false);
    }
  };

  const handleMemberActions = (member: GroupMember) => {
    if (!group || !user || member.userId === user.id) return;

    const actions: { text: string; onPress: () => void; destructive?: boolean }[] = [];

    if (amAdmin) {
      if (member.role === 'MEMBER') {
        actions.push({
          text: 'Make group admin',
          onPress: async () => {
            try {
              await groupApi.makeAdmin(group.id, member.userId);
              await load();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to promote.');
            }
          },
        });
      } else if (member.userId !== group.creatorId) {
        actions.push({
          text: 'Dismiss as admin',
          onPress: async () => {
            try {
              await groupApi.removeAdmin(group.id, member.userId);
              await load();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to dismiss.');
            }
          },
        });
      }

      if (member.userId !== group.creatorId) {
        actions.push({
          text: 'Remove from group',
          destructive: true,
          onPress: async () => {
            try {
              await groupApi.removeMember(group.id, member.userId);
              await load();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to remove.');
            }
          },
        });
      }
    }

    if (actions.length === 0) return;

    Alert.alert(
      resolveMemberDisplayName(member, contactsById, user?.id),
      undefined,
      [
        ...actions.map((a) => ({
          text: a.text,
          style: (a.destructive ? 'destructive' : 'default') as 'default' | 'destructive',
          onPress: a.onPress,
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  const handleLeave = () => {
    if (!group) return;
    Alert.alert(
      'Exit group',
      amCreator
        ? "You're the creator. Exiting will not delete the group."
        : 'Are you sure you want to exit this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Exit',
          style: 'destructive',
          onPress: async () => {
            try {
              await groupApi.leaveGroup(group.id);
              router.dismissAll();
              router.replace('/(tabs)');
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to leave group.');
            }
          },
        },
      ],
    );
  };

  const handleDeleteGroup = () => {
    if (!group || !amCreator) return;
    Alert.alert(
      'Delete group',
      'This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await groupApi.deleteGroup(group.id);
              router.dismissAll();
              router.replace('/(tabs)');
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to delete group.');
            }
          },
        },
      ],
    );
  };

  if (loading || !group) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: colors.primary }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <IconSymbol name="arrow.left" size={24} color={colors.headerText} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Group info</Text>
        <View style={styles.headerBtn} />
      </View>

      <FlatList
        data={group.members}
        keyExtractor={(m) => m.id}
        ListHeaderComponent={
          <View>
            {/* Avatar + name */}
            <View style={[styles.profileSection, { backgroundColor: colors.background }]}>
              <Pressable onPress={handleChangeAvatar} disabled={busy} style={styles.avatarWrap}>
                {group.avatar ? (
                  <Image source={{ uri: group.avatar }} style={styles.avatarImg} contentFit="cover" />
                ) : (
                  <View style={[styles.avatarFallback, { backgroundColor: colors.backgroundSecondary }]}>
                    <Text style={[styles.avatarInitials, { color: colors.text }]}>
                      {getInitials(group.name) || '?'}
                    </Text>
                  </View>
                )}
                {canEditInfo && (
                  <View style={[styles.cameraBadge, { backgroundColor: colors.primary }]}>
                    <IconSymbol name="camera.fill" size={14} color="#ffffff" />
                  </View>
                )}
              </Pressable>

              {editingName ? (
                <View style={styles.nameEditRow}>
                  <TextInput
                    value={nameDraft}
                    onChangeText={setNameDraft}
                    style={[styles.nameInput, { color: colors.text, borderBottomColor: colors.primary }]}
                    autoFocus
                    maxLength={100}
                  />
                  <Pressable onPress={handleSaveName} style={styles.saveBtn}>
                    <IconSymbol name="checkmark" size={20} color={colors.primary} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    if (!canEditInfo) {
                      Alert.alert('Not allowed', 'Only admins can change the group name.');
                      return;
                    }
                    setNameDraft(group.name);
                    setEditingName(true);
                  }}
                  style={styles.nameDisplay}
                >
                  <Text style={[styles.groupName, { color: colors.text }]}>{group.name}</Text>
                  {canEditInfo && (
                    <IconSymbol name="pencil" size={16} color={colors.textSecondary} />
                  )}
                </Pressable>
              )}
              <Text style={[styles.groupMeta, { color: colors.textSecondary }]}>
                Group · {group.members.length} participants
              </Text>
            </View>

            {/* Permissions shortcut (admins only) */}
            {amAdmin && (
              <Pressable
                onPress={() => router.push({ pathname: '/group/[id]/permissions', params: { id: group.id } })}
                style={[styles.settingsRow, { backgroundColor: colors.background, borderTopColor: colors.border, borderBottomColor: colors.border }]}
              >
                <IconSymbol name="gearshape.fill" size={22} color={colors.primary} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[styles.settingsTitle, { color: colors.text }]}>Group permissions</Text>
                  <Text style={[styles.settingsDesc, { color: colors.textSecondary }]}>
                    Control who can send messages, edit info, and add members
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={18} color={colors.textSecondary} />
              </Pressable>
            )}

            {/* Members header */}
            <View style={[styles.membersHeader, { backgroundColor: colors.backgroundSecondary }]}>
              <Text style={[styles.membersHeaderText, { color: colors.textSecondary }]}>
                {group.members.length} PARTICIPANTS
              </Text>
            </View>

            {/* Add members row */}
            {canAddMembers && (
              <Pressable
                onPress={() => router.push({ pathname: '/group/[id]/add-members', params: { id: group.id } })}
                style={[styles.addMembersRow, { backgroundColor: colors.background }]}
              >
                <View style={[styles.addIcon, { backgroundColor: colors.primary }]}>
                  <IconSymbol name="person.badge.plus" size={20} color="#ffffff" />
                </View>
                <Text style={[styles.addMembersText, { color: colors.primary }]}>Add participants</Text>
              </Pressable>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const displayName = resolveMemberDisplayName(item, contactsById, user?.id);
          const isCreator = item.userId === group.creatorId;
          return (
            <Pressable
              onPress={() => handleMemberActions(item)}
              style={({ pressed }) => [
                styles.memberRow,
                { backgroundColor: pressed ? colors.backgroundSecondary : colors.background },
              ]}
            >
              {item.user.avatar ? (
                <Avatar uri={item.user.avatar} size={44} showOnlineStatus isOnline={item.user.isOnline} />
              ) : (
                <View style={[styles.memberInitials, { backgroundColor: '#E5E7EB' }]}>
                  <Text style={styles.memberInitialsText}>
                    {getInitials(displayName) || '?'}
                  </Text>
                </View>
              )}
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                  {displayName}
                </Text>
                {item.user.about ? (
                  <Text style={[styles.memberSub, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.user.about}
                  </Text>
                ) : null}
              </View>
              {item.role === 'ADMIN' && (
                <View style={[styles.adminTag, { borderColor: colors.primary }]}>
                  <Text style={[styles.adminTagText, { color: colors.primary }]}>
                    {isCreator ? 'Creator' : 'Admin'}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        }}
        ListFooterComponent={
          <View style={{ paddingVertical: 20 }}>
            <Pressable onPress={handleLeave} style={styles.dangerRow}>
              <IconSymbol name="rectangle.portrait.and.arrow.right" size={22} color="#E11D48" />
              <Text style={styles.dangerText}>Exit group</Text>
            </Pressable>
            {amCreator && (
              <Pressable onPress={handleDeleteGroup} style={styles.dangerRow}>
                <IconSymbol name="trash.fill" size={22} color="#E11D48" />
                <Text style={styles.dangerText}>Delete group</Text>
              </Pressable>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', marginLeft: 8 },
  profileSection: { alignItems: 'center', paddingVertical: 24 },
  avatarWrap: { width: 120, height: 120, borderRadius: 60, overflow: 'visible' },
  avatarImg: { width: 120, height: 120, borderRadius: 60 },
  avatarFallback: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 44, fontWeight: '600' },
  cameraBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  nameDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
  },
  groupName: { fontSize: 22, fontWeight: '600' },
  groupMeta: { fontSize: 13, marginTop: 4 },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 40,
    alignSelf: 'stretch',
  },
  nameInput: {
    flex: 1,
    fontSize: 20,
    borderBottomWidth: 1.5,
    paddingVertical: 4,
  },
  saveBtn: { padding: 8 },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
  },
  settingsTitle: { fontSize: 15, fontWeight: '500' },
  settingsDesc: { fontSize: 12, marginTop: 2 },
  membersHeader: { paddingHorizontal: 16, paddingVertical: 8 },
  membersHeaderText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  addMembersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  addIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMembersText: { marginLeft: 14, fontSize: 16, fontWeight: '500' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  memberInitials: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitialsText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  memberInfo: { flex: 1, marginLeft: 14 },
  memberName: { fontSize: 16, fontWeight: '500' },
  memberSub: { fontSize: 13, marginTop: 2 },
  adminTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  adminTagText: { fontSize: 11, fontWeight: '600' },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 16,
  },
  dangerText: { color: '#E11D48', fontSize: 16, fontWeight: '500' },
});

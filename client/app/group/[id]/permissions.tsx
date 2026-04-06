import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import { groupApi, GroupChat, GroupPermissionRole } from '@/services/api';

export default function GroupPermissionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [group, setGroup] = useState<GroupChat | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!id) return;
        const g = await groupApi.getGroup(id);
        setGroup(g);
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Failed to load group.');
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const amAdmin = !!group && group.members.some((m) => m.userId === user?.id && m.role === 'ADMIN');

  const updateField = async (field: 'editInfoRole' | 'sendMessagesRole' | 'addMembersRole' | 'approveMembersRole', value: GroupPermissionRole) => {
    if (!group || !amAdmin) return;
    const previous = group[field];
    setGroup({ ...group, [field]: value });
    setSaving(true);
    try {
      const updated = await groupApi.updatePermissions(group.id, { [field]: value });
      setGroup(updated);
    } catch (e: any) {
      console.error('Failed to update permissions', e);
      setGroup({ ...group, [field]: previous });
      Alert.alert('Error', e?.message || 'Failed to update permissions.');
    } finally {
      setSaving(false);
    }
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
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Group permissions</Text>
        <View style={styles.headerBtn}>
          {saving && <ActivityIndicator color={colors.headerText} />}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingVertical: 12 }}>
        <PermissionBlock
          title="Edit group info"
          description="Who can change this group's name, icon, and description"
          value={group.editInfoRole}
          onChange={(v) => updateField('editInfoRole', v)}
          disabled={!amAdmin || saving}
          colors={colors}
        />
        <PermissionBlock
          title="Send messages"
          description="Who can send messages in this group"
          value={group.sendMessagesRole}
          onChange={(v) => updateField('sendMessagesRole', v)}
          disabled={!amAdmin || saving}
          colors={colors}
        />
        <PermissionBlock
          title="Add members"
          description="Who can add new members to this group"
          value={group.addMembersRole}
          onChange={(v) => updateField('addMembersRole', v)}
          disabled={!amAdmin || saving}
          colors={colors}
        />
        <PermissionBlock
          title="Approve new members"
          description="Who approves join requests"
          value={group.approveMembersRole}
          onChange={(v) => updateField('approveMembersRole', v)}
          disabled={!amAdmin || saving}
          colors={colors}
        />
      </ScrollView>
    </View>
  );
}

function PermissionBlock({
  title,
  description,
  value,
  onChange,
  disabled,
  colors,
}: {
  title: string;
  description: string;
  value: GroupPermissionRole;
  onChange: (v: GroupPermissionRole) => void;
  disabled?: boolean;
  colors: any;
}) {
  const Row = ({
    label,
    optionValue,
  }: {
    label: string;
    optionValue: GroupPermissionRole;
  }) => (
    <Pressable
      disabled={disabled}
      onPress={() => onChange(optionValue)}
      style={[styles.optionRow, { opacity: disabled ? 0.6 : 1 }]}
    >
      <Text style={[styles.optionLabel, { color: colors.text }]}>{label}</Text>
      <View style={[styles.radio, { borderColor: colors.primary }]}>
        {value === optionValue && (
          <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
        )}
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.block, { borderBottomColor: colors.border }]}>
      <Text style={[styles.blockTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.blockDesc, { color: colors.textSecondary }]}>{description}</Text>
      <Row label="All participants" optionValue="ALL_MEMBERS" />
      <Row label="Only admins" optionValue="ADMINS" />
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
  block: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  blockTitle: { fontSize: 16, fontWeight: '600' },
  blockDesc: { fontSize: 13, marginTop: 4, marginBottom: 10 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  optionLabel: { fontSize: 15 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
});

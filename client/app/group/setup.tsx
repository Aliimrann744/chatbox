import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { pickImage } from '@/utils/media-picker';
import {
  groupApi,
  uploadApi,
  GroupPermissionRole,
  GroupPermissions,
} from '@/services/api';

interface MemberPreview {
  id: string;
  name: string;
  phone?: string;
  avatar?: string;
}

// Step 2 of group creation: set avatar + name + permissions, then create.
export default function NewGroupSetupScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const params = useLocalSearchParams<{ members?: string }>();

  const members: MemberPreview[] = useMemo(() => {
    try {
      return params.members ? JSON.parse(params.members) : [];
    } catch {
      return [];
    }
  }, [params.members]);

  const [name, setName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarRemoteUrl, setAvatarRemoteUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [creating, setCreating] = useState(false);

  // Permission defaults — least-restrictive (spec requirement).
  const [editInfoRole, setEditInfoRole] = useState<GroupPermissionRole>('ALL_MEMBERS');
  const [sendMessagesRole, setSendMessagesRole] = useState<GroupPermissionRole>('ALL_MEMBERS');
  const [addMembersRole, setAddMembersRole] = useState<GroupPermissionRole>('ALL_MEMBERS');
  const [approveMembersRole, setApproveMembersRole] = useState<GroupPermissionRole>('ADMINS');

  const handlePickAvatar = async () => {
    try {
      const picked = await pickImage();
      if (!picked) return;
      setAvatarUri(picked.uri);
      setUploadingAvatar(true);
      const uploaded = await uploadApi.uploadFile(
        { uri: picked.uri, type: picked.mimeType, name: picked.name },
        'group-avatars',
      );
      setAvatarRemoteUrl(uploaded.url);
    } catch (e) {
      console.error('Avatar upload failed', e);
      Alert.alert('Upload failed', 'Could not upload group icon. Please try again.');
      setAvatarUri(null);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Group name required', 'Please enter a group name.');
      return;
    }
    if (members.length === 0) {
      Alert.alert('No members', 'Please select at least one member.');
      return;
    }

    setCreating(true);
    try {
      const permissions: GroupPermissions = {
        editInfoRole,
        sendMessagesRole,
        addMembersRole,
        approveMembersRole,
      };
      const group = await groupApi.createGroup({
        name: name.trim(),
        memberIds: members.map((m) => m.id),
        avatar: avatarRemoteUrl ?? undefined,
        permissions,
      });
      router.dismissAll();
      router.replace({ pathname: '/chat/[id]', params: { id: group.id } });
    } catch (e: any) {
      console.error('Create group failed', e);
      Alert.alert('Error', e?.message || 'Failed to create group.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar + name row */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
            style={[styles.avatarBtn, { backgroundColor: colors.backgroundSecondary }]}
          >
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatarImg}
                contentFit="cover"
              />
            ) : (
              <IconSymbol name="camera.fill" size={28} color={colors.textSecondary} />
            )}
            {uploadingAvatar && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#ffffff" />
              </View>
            )}
          </Pressable>

          <View style={styles.nameWrap}>
            <TextInput
              style={[styles.nameInput, { color: colors.text, borderBottomColor: colors.primary }]}
              placeholder="Group name (emoji supported)"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
              maxLength={100}
              autoFocus
            />
            <Text style={[styles.charCount, { color: colors.textSecondary }]}>
              {name.length}/100
            </Text>
          </View>
        </View>

        {/* Participants summary */}
        <View style={[styles.section, { borderTopColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Participants: {members.length + 1}
          </Text>
          <Text style={[styles.participantsText, { color: colors.text }]} numberOfLines={3}>
            You{members.length > 0 ? ', ' : ''}
            {members.map((m) => m.name).join(', ')}
          </Text>
        </View>

        {/* Permissions section */}
        <View style={[styles.section, { borderTopColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            GROUP PERMISSIONS
          </Text>

          <PermissionRow
            title="Edit group info"
            description="Who can change the name, icon and description"
            value={editInfoRole}
            onChange={setEditInfoRole}
            colors={colors}
          />
          <PermissionRow
            title="Send messages"
            description="Who can send messages in this group"
            value={sendMessagesRole}
            onChange={setSendMessagesRole}
            colors={colors}
          />
          <PermissionRow
            title="Add new members"
            description="Who can add participants to this group"
            value={addMembersRole}
            onChange={setAddMembersRole}
            colors={colors}
          />
          <PermissionRow
            title="Approve new members"
            description="Who approves join requests"
            value={approveMembersRole}
            onChange={setApproveMembersRole}
            colors={colors}
          />
        </View>
      </ScrollView>

      <Pressable
        onPress={handleCreate}
        disabled={creating || uploadingAvatar || !name.trim()}
        style={[
          styles.createBtn,
          {
            backgroundColor:
              creating || !name.trim() ? colors.textSecondary : colors.primary,
          },
        ]}
      >
        {creating ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <IconSymbol name="checkmark" size={26} color="#ffffff" />
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

function PermissionRow({ title, description, value, onChange, colors }: {
  title: string;
  description: string;
  value: GroupPermissionRole;
  onChange: (v: GroupPermissionRole) => void;
  colors: any;
}) {
  return (
    <View style={styles.permRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.permTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.permDesc, { color: colors.textSecondary }]}>
          {description}
        </Text>
      </View>
      <View style={[styles.permToggle, { borderColor: colors.border }]}>
        <Pressable
          onPress={() => onChange('ALL_MEMBERS')}
          style={[
            styles.permOption,
            value === 'ALL_MEMBERS' && { backgroundColor: colors.primary },
          ]}
        >
          <Text
            style={[
              styles.permOptionText,
              { color: value === 'ALL_MEMBERS' ? '#ffffff' : colors.text },
            ]}
          >
            All
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onChange('ADMINS')}
          style={[
            styles.permOption,
            value === 'ADMINS' && { backgroundColor: colors.primary },
          ]}
        >
          <Text
            style={[
              styles.permOptionText,
              { color: value === 'ADMINS' ? '#ffffff' : colors.text },
            ]}
          >
            Admins
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 120 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 18,
  },
  avatarBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameWrap: { flex: 1 },
  nameInput: {
    fontSize: 20,
    paddingVertical: 6,
    borderBottomWidth: 1.5,
  },
  charCount: { fontSize: 12, marginTop: 4, textAlign: 'right' },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  participantsText: { fontSize: 15, lineHeight: 20 },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  permTitle: { fontSize: 15, fontWeight: '500' },
  permDesc: { fontSize: 12, marginTop: 2 },
  permToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  permOption: { paddingHorizontal: 12, paddingVertical: 8 },
  permOptionText: { fontSize: 13, fontWeight: '600' },
  createBtn: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
});

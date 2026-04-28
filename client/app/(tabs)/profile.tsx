import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/avatar';
import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { authApi } from '@/services/api';
import { setAvatarEditorCallback } from '@/app/avatar-editor';

interface ProfileItemProps {
  icon: IconSymbolName;
  title: string;
  value: string;
  onPress?: () => void;
}

function ProfileItem({ icon, title, value, onPress }: ProfileItemProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [ styles.profileItem, { backgroundColor: pressed && onPress ? colors.backgroundSecondary : colors.background }]}>
      <IconSymbol name={icon} size={22} color="#ffffff" style={styles.itemIcon} />
      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, { color: colors.textSecondary }]}>{title}</Text>
        <Text style={[styles.itemValue, { color: colors.text }]}>{value}</Text>
      </View>
      {onPress && <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />}
    </Pressable>
  );
}

function getInitials(name: string): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ProfileScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { user, logout, refreshUser } = useAuth();

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editField, setEditField] = useState<'name' | 'about'>('name');
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarSheetVisible, setAvatarSheetVisible] = useState(false);

  const displayUser = user || {
    name: 'Guest User',
    phone: '',
    about: 'Hey there! I am using Whatchat',
    avatar: null,
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const uploadAvatarFromUri = async (uri: string) => {
    setIsUploadingAvatar(true);
    try {
      const ext = (uri.split('.').pop() || 'jpg').toLowerCase().split('?')[0];
      const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const safeExt = ['png', 'webp'].includes(ext) ? ext : 'jpg';
      await authApi.updateProfile({
        avatar: { uri, type, name: `avatar.${safeExt}` },
      });
      await refreshUser();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Hand the picked/captured image off to the avatar editor screen. Upload
  // happens only when the user taps "send" in the editor, so opening the
  // camera/gallery no longer auto-uploads on the native crop "Done" action.
  const openAvatarEditor = (uri: string) => {
    setAvatarEditorCallback((finalUri) => {
      uploadAvatarFromUri(finalUri);
    });
    router.push({ pathname: '/avatar-editor', params: { uri } });
  };

  const handleOpenCamera = async () => {
    setAvatarSheetVisible(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera permission is needed to take a photo.');
      return;
    }
    // Don't invoke the OS crop editor — the custom avatar editor screen
    // handles cropping inline via pan+pinch, all on one page.
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    openAvatarEditor(result.assets[0].uri);
  };

  const handleOpenGallery = async () => {
    setAvatarSheetVisible(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    openAvatarEditor(result.assets[0].uri);
  };

  const handleDeleteAvatar = () => {
    Alert.alert(
      'Remove profile photo',
      'Are you sure you want to remove your profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setAvatarSheetVisible(false);
            setIsUploadingAvatar(true);
            try {
              await authApi.removeAvatar();
              await refreshUser();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to remove photo');
            } finally {
              setIsUploadingAvatar(false);
            }
          },
        },
      ],
    );
  };

  const openEditModal = (field: 'name' | 'about') => {
    setEditField(field);
    setEditValue(field === 'name' ? (displayUser.name || '') : (displayUser.about || ''));
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (editField === 'name' && editValue.trim().length < 2) {
      Alert.alert('Error', 'Name must be at least 2 characters');
      return;
    }

    setIsSaving(true);
    try {
      await authApi.updateProfile({ [editField]: editValue.trim() });
      await refreshUser();
      setEditModalVisible(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      {/* Profile Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <View style={styles.avatarContainer}>
          {displayUser.avatar ? (
            <Avatar uri={displayUser.avatar} size={100} />
          ) : (
            <View style={[styles.initialsContainer, { backgroundColor: colors.primary }]}>
              <Text style={styles.initialsText}>{getInitials(displayUser.name)}</Text>
            </View>
          )}
          {isUploadingAvatar && (
            <View style={styles.avatarUploadingOverlay}>
              <ActivityIndicator size="small" color="#ffffff" />
            </View>
          )}
        </View>

        <Pressable
          onPress={() => setAvatarSheetVisible(true)}
          disabled={isUploadingAvatar}
          style={({ pressed }) => [
            styles.editAvatarPill,
            { backgroundColor: pressed ? colors.backgroundSecondary : 'transparent' },
            isUploadingAvatar && { opacity: 0.5 },
          ]}>
          <Ionicons name="pencil-outline" size={14} color={colors.primary} />
          <Text style={[styles.editAvatarText, { color: colors.primary }]}>Edit</Text>
        </Pressable>

        <Text style={[styles.name, { color: colors.text }]}>{displayUser.name}</Text>
        <Text style={[styles.status, { color: colors.textSecondary }]}>
          {displayUser.about}
        </Text>
      </View>

      {/* QR Code */}
      <View style={[styles.section, { backgroundColor: colors.background }]}>
        <Pressable
          style={({ pressed }) => [
            styles.actionItem,
            { backgroundColor: pressed ? colors.backgroundSecondary : colors.background },
          ]}>
          <IconSymbol name="qrcode" size={22} color="#ffffff" style={styles.itemIcon} />
          <Text style={[styles.actionText, { color: colors.text }]}>QR Code</Text>
          <IconSymbol name="chevron.right" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Profile Info */}
      <View style={[styles.section, { backgroundColor: colors.background }]}>
        <ProfileItem
          icon="person.fill"
          title="Name"
          value={displayUser.name || 'Not set'}
          onPress={() => openEditModal('name')}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <ProfileItem
          icon="phone.fill"
          title="Phone"
          value={displayUser.phone || 'Not set'}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <ProfileItem
          icon="doc.fill"
          title="About"
          value={displayUser.about || 'Hey there! I am using Whatchat'}
          onPress={() => openEditModal('about')}
        />
      </View>

      {/* Actions */}
      <View style={[styles.section, { backgroundColor: colors.background }]}>
        <Pressable
          style={({ pressed }) => [
            styles.actionItem,
            { backgroundColor: pressed ? colors.backgroundSecondary : colors.background },
          ]}>
          <IconSymbol name="photo" size={22} color="#ffffff" style={styles.itemIcon} />
          <Text style={[styles.actionText, { color: colors.text }]}>
            Media, Links, and Docs
          </Text>
          <View style={styles.actionRight}>
            <Text style={[styles.actionCount, { color: colors.textSecondary }]}>0</Text>
            <IconSymbol name="chevron.right" size={18} color={colors.textSecondary} />
          </View>
        </Pressable>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Pressable
          style={({ pressed }) => [
            styles.actionItem,
            { backgroundColor: pressed ? colors.backgroundSecondary : colors.background },
          ]}>
          <IconSymbol name="magnifyingglass" size={22} color="#ffffff" style={styles.itemIcon} />
          <Text style={[styles.actionText, { color: colors.text }]}>Starred Messages</Text>
          <IconSymbol name="chevron.right" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Logout Button */}
      <Pressable
        onPress={handleLogout}
        style={({ pressed }) => [
          styles.logoutButton,
          { backgroundColor: pressed ? 'rgba(255, 59, 48, 0.1)' : colors.background },
        ]}>
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>

      {/* App Version */}
      <View style={styles.appInfo}>
        <Text style={[styles.appVersion, { color: colors.textSecondary }]}>
          Whatchat v1.0.0
        </Text>
      </View>

      {/* Profile picture action sheet */}
      <Modal
        visible={avatarSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAvatarSheetVisible(false)}>
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setAvatarSheetVisible(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.background }]}
            onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Pressable
                onPress={() => setAvatarSheetVisible(false)}
                hitSlop={10}
                style={styles.sheetIconBtn}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                Profile picture
              </Text>
              {displayUser.avatar ? (
                <Pressable
                  onPress={handleDeleteAvatar}
                  hitSlop={10}
                  style={styles.sheetIconBtn}>
                  <Ionicons name="trash-outline" size={22} color={colors.text} />
                </Pressable>
              ) : (
                <View style={styles.sheetIconBtn} />
              )}
            </View>

            <View style={styles.sheetOptions}>
              <Pressable
                onPress={handleOpenCamera}
                style={({ pressed }) => [
                  styles.sheetOption,
                  pressed && { opacity: 0.7 },
                ]}>
                <View
                  style={[
                    styles.sheetOptionIcon,
                    { backgroundColor: colors.backgroundSecondary },
                  ]}>
                  <Ionicons name="camera-outline" size={26} color={colors.primary} />
                </View>
                <Text style={[styles.sheetOptionLabel, { color: colors.text }]}>
                  Camera
                </Text>
              </Pressable>

              <Pressable
                onPress={handleOpenGallery}
                style={({ pressed }) => [
                  styles.sheetOption,
                  pressed && { opacity: 0.7 },
                ]}>
                <View
                  style={[
                    styles.sheetOptionIcon,
                    { backgroundColor: colors.backgroundSecondary },
                  ]}>
                  <Ionicons name="image-outline" size={26} color={colors.primary} />
                </View>
                <Text style={[styles.sheetOptionLabel, { color: colors.text }]}>
                  Gallery
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => !isSaving && setEditModalVisible(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Edit {editField === 'name' ? 'Name' : 'About'}
            </Text>
            <View style={[styles.modalInput, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
              <TextInput
                style={[styles.modalInputText, { color: colors.text }]}
                value={editValue}
                onChangeText={setEditValue}
                placeholder={editField === 'name' ? 'Enter your name' : 'Enter your about'}
                placeholderTextColor={colors.textSecondary}
                autoFocus
                maxLength={editField === 'name' ? 50 : 140}
                multiline={editField === 'about'}
              />
            </View>
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setEditModalVisible(false)}
                disabled={isSaving}
                style={[styles.modalButton, { backgroundColor: colors.backgroundSecondary }]}>
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveEdit}
                disabled={isSaving}
                style={[styles.modalButton, { backgroundColor: colors.primary }, isSaving && { opacity: 0.7 }]}>
                {isSaving ? (
                  <ActivityIndicator size={16} color="#ffffff" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>Save</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 30,
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  initialsContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#ffffff',
  },
  avatarUploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  editAvatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sheetIconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  sheetOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  sheetOption: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  sheetOptionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetOptionLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  status: {
    fontSize: 16,
  },
  section: {
    marginBottom: 16,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  itemIcon: {
    marginRight: 16,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    marginBottom: 4,
  },
  itemValue: {
    fontSize: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 54,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
  },
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionCount: {
    fontSize: 14,
  },
  logoutButton: {
    marginHorizontal: 0,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 20,
  },
  appVersion: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  modalInputText: {
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

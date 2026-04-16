import { router, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, FlatList, Modal, Pressable,
  ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import { useCall } from '@/contexts/call-context';
import { chatApi, contactApi, Chat, SharedMedia, User } from '@/services/api';
import { cache, CacheKeys } from '@/services/cache';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MEDIA_THUMB_SIZE = (SCREEN_WIDTH - 48) / 4;

function getInitials(name: string | undefined): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function UserInfoScreen() {
  const { chatId, userId } = useLocalSearchParams<{ chatId: string; userId?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();
  const { initiateCall } = useCall();

  const [chat, setChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharedMedia, setSharedMedia] = useState<SharedMedia[]>([]);
  const [mediaCount, setMediaCount] = useState(0);
  const [mediaVisibility, setMediaVisibility] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [shareSearchQuery, setShareSearchQuery] = useState('');
  const [shareChats, setShareChats] = useState<Chat[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Derive user info from chat
  const otherMember = chat?.members?.find(m => m.user.id !== currentUser?.id);
  const otherUser = otherMember ? (otherMember.user as typeof otherMember.user & { about?: string; phone?: string; email?: string }) : undefined;
  const userName = otherUser?.name || chat?.name || 'User';
  const userAvatar = otherUser?.avatar || chat?.avatar;

  const fetchData = useCallback(async () => {
    if (!chatId) return;
    try {
      const chatData = await chatApi.getChat(chatId);
      setChat(chatData);
      if (typeof chatData?.mediaVisibility === 'boolean') {
        setMediaVisibility(chatData.mediaVisibility);
      }

      // Fetch media separately so it doesn't block the page if it fails
      try {
        const mediaData = await chatApi.getSharedMedia(chatId, undefined, 1, 8);
        setSharedMedia(mediaData.media.filter(m => m.type === 'IMAGE' || m.type === 'VIDEO'));
        setMediaCount(mediaData.pagination.total);
      } catch {}

      // Check if blocked (use checkBlocked — one-directional, matches chat/[id].tsx)
      const targetId = userId || chatData?.members?.find((m: any) => m.user.id !== currentUser?.id)?.user?.id;
      if (targetId) {
        try {
          const result = await contactApi.checkBlocked(targetId);
          setIsBlocked(!!result?.iBlockedThem);
        } catch {}
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
    } finally {
      setLoading(false);
    }
  }, [chatId, userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Re-check blocked state when otherUser becomes available
  useEffect(() => {
    if (otherUser?.id) {
      contactApi.checkBlocked(otherUser.id).then(result => {
        setIsBlocked(!!result?.iBlockedThem);
      }).catch(() => {});
    }
  }, [otherUser?.id]);

  const handleToggleMediaVisibility = async (value: boolean) => {
    if (!chatId) return;
    setMediaVisibility(value);
    try {
      await chatApi.setMediaVisibility(chatId, value);
    } catch (err: any) {
      // Revert on error
      setMediaVisibility(!value);
      Alert.alert('Error', err?.message || 'Failed to update media visibility');
    }
  };

  const handleFavoriteChat = async () => {
    if (!chatId) return;
    const newFav = !chat?.isFavorite;
    try {
      await chatApi.favoriteChat(chatId, newFav);
      setChat(prev => prev ? { ...prev, isFavorite: newFav } : prev);
      // Sync chat list cache
      const cachedChats = cache.get<Chat[]>(CacheKeys.CHATS);
      if (cachedChats) {
        cache.set(CacheKeys.CHATS, cachedChats.map(c => c.id === chatId ? { ...c, isFavorite: newFav } : c));
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update favorites');
    }
  };

  const handleAudioCall = async () => {
    if (otherUser?.id) {
      await initiateCall(otherUser.id, userName, userAvatar, 'VOICE');
      router.push('/call/active');
    }
  };

  const handleVideoCall = async () => {
    if (otherUser?.id) {
      await initiateCall(otherUser.id, userName, userAvatar, 'VIDEO');
      router.push('/call/active');
    }
  };

  const handlePinChat = async () => {
    if (!chatId) return;
    try {
      await chatApi.pinChat(chatId, !chat?.isPinned);
      setChat(prev => prev ? { ...prev, isPinned: !prev.isPinned } : prev);
    } catch (error: any) {
      Alert.alert('Cannot Pin', error?.message || 'You can only pin up to 3 chats. Please unpin one first.');
    }
  };

  const handleBlockUser = () => {
    const targetId = otherUser?.id || userId;
    if (!targetId) return;

    if (isBlocked) {
      Alert.alert('Unblock Contact', `Unblock ${userName}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock', onPress: async () => {
            try {
              await contactApi.unblockUser(targetId);
              setIsBlocked(false);
            } catch { Alert.alert('Error', 'Failed to unblock user'); }
          },
        },
      ]);
    } else {
      Alert.alert(
        'Block Contact',
        `Block ${userName}? Blocked contacts will no longer be able to call you or send you messages.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block', style: 'destructive', onPress: async () => {
              try {
                await contactApi.blockUser(targetId);
                setIsBlocked(true);
              } catch { Alert.alert('Error', 'Failed to block user'); }
            },
          },
        ],
      );
    }
  };

  const handleClearChat = () => {
    if (!chatId) return;
    Alert.alert(
      'Clear Chat',
      'Are you sure you want to clear all messages in this chat? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear', style: 'destructive', onPress: async () => {
            try {
              await chatApi.clearChat(chatId);
              // Clear local media + caches in real time
              setSharedMedia([]);
              setMediaCount(0);
              cache.delete(CacheKeys.messages(chatId));
              const cachedChats = cache.get<Chat[]>(CacheKeys.CHATS);
              if (cachedChats) {
                cache.set(
                  CacheKeys.CHATS,
                  cachedChats.map(c => c.id === chatId ? { ...c, lastMessage: undefined, unreadCount: 0 } : c),
                );
              }
              // Trigger media API refresh to confirm server has cleared
              try {
                const refreshed = await chatApi.getSharedMedia(chatId, undefined, 1, 8);
                setSharedMedia(refreshed.media.filter(m => m.type === 'IMAGE' || m.type === 'VIDEO'));
                setMediaCount(refreshed.pagination.total);
              } catch {}
              Alert.alert('Done', 'Chat cleared successfully');
            } catch { Alert.alert('Error', 'Failed to clear chat'); }
          },
        },
      ],
    );
  };

  const handleShareContact = async (targetChatId: string) => {
    try {
      await chatApi.sendMessage(targetChatId, {
        type: 'CONTACT',
        content: JSON.stringify({ name: userName, phone: otherUser?.phone || '', userId: otherUser?.id }),
      });
      setShowShareModal(false);
      Alert.alert('Sent', `Contact shared successfully`);
    } catch {
      Alert.alert('Error', 'Failed to share contact');
    }
  };

  const handleEdit = () => {
    setEditName(userName);
    setEditEmail(otherUser?.email || '');
    setShowEditModal(true);
    setShowMenu(false);
  };

  const handleShare = async () => {
    setShowMenu(false);
    setShowShareModal(true);
    try {
      const chats = await chatApi.getChats();
      setShareChats(chats);
    } catch {}
  };

  const handleSaveEdit = async () => {
    // This would update the contact nickname
    setShowEditModal(false);
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
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => setShowMenu(true)} hitSlop={8} style={styles.headerMenuBtn}>
          <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile section */}
        <View style={[styles.profileSection, { backgroundColor: colors.cardBackground }]}>
          <Pressable onPress={() => { if (userAvatar) setPreviewUrl(userAvatar); }}>
            {userAvatar ? (
              <Image source={{ uri: userAvatar }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.initialsAvatar]}>
                <Text style={styles.initialsText}>{getInitials(userName)}</Text>
              </View>
            )}
          </Pressable>
          <Text style={[styles.userName, { color: colors.text }]}>{userName}</Text>
          {otherUser?.about && (
            <Text style={[styles.userAbout, { color: colors.textSecondary }]}>{otherUser.about}</Text>
          )}

          {/* Action buttons */}
          <View style={styles.profileActions}>
            <Pressable style={styles.profileActionBtn} onPress={() => router.back()}>
              <View style={[styles.profileActionIcon, { backgroundColor: colors.inputBackground }]}>
                <Ionicons name="chatbubble" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.profileActionLabel, { color: colors.primary }]}>Message</Text>
            </Pressable>
            <Pressable style={styles.profileActionBtn} onPress={handleAudioCall}>
              <View style={[styles.profileActionIcon, { backgroundColor: colors.inputBackground }]}>
                <Ionicons name="call" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.profileActionLabel, { color: colors.primary }]}>Audio</Text>
            </Pressable>
            <Pressable style={styles.profileActionBtn} onPress={handleVideoCall}>
              <View style={[styles.profileActionIcon, { backgroundColor: colors.inputBackground }]}>
                <Ionicons name="videocam" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.profileActionLabel, { color: colors.primary }]}>Video</Text>
            </Pressable>
          </View>
        </View>

        {/* Media, links, and docs */}
        <Pressable
          style={[styles.menuSection, { backgroundColor: colors.cardBackground }]}
          onPress={() => router.push({ pathname: '/chat/media-gallery', params: { chatId, chatName: userName } })}
        >
          <View style={styles.menuRow}>
            <Text style={[styles.menuLabel, { color: colors.text }]}>Media, links, and docs</Text>
            <View style={styles.menuRight}>
              <Text style={[styles.menuCount, { color: colors.textSecondary }]}>{mediaCount}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </View>
          </View>
          {sharedMedia.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaPreviewRow}>
              {sharedMedia.map(item => (
                <Pressable key={item.id} onPress={() => setPreviewUrl(item.mediaUrl)} style={styles.mediaThumb}>
                  <Image source={{ uri: item.thumbnail || item.mediaUrl }} style={styles.mediaThumbImage} contentFit="cover" />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Pressable>

        {/* Settings section */}
        <View style={[styles.menuSection, { backgroundColor: colors.cardBackground }]}>
          {/* Media visibility */}
          <View style={styles.menuItem}>
            <Ionicons name="images-outline" size={22} color={colors.textSecondary} style={styles.menuIcon} />
            <View style={styles.menuItemContent}>
              <Text style={[styles.menuItemTitle, { color: colors.text }]}>Media visibility</Text>
            </View>
            <Switch
              value={mediaVisibility}
              onValueChange={handleToggleMediaVisibility}
              trackColor={{ false: '#767577', true: '#075E54' }}
              thumbColor="#fff"
            />
          </View>

          {/* Pin chat */}
          <Pressable style={styles.menuItem} onPress={handlePinChat}>
            <Ionicons name="pin-outline" size={22} color={colors.textSecondary} style={styles.menuIcon} />
            <View style={styles.menuItemContent}>
              <Text style={[styles.menuItemTitle, { color: colors.text }]}>
                {chat?.isPinned ? 'Unpin chat' : 'Pin chat'}
              </Text>
            </View>
          </Pressable>

          {/* Add to favorites */}
          <Pressable style={styles.menuItem} onPress={handleFavoriteChat}>
            <Ionicons
              name={chat?.isFavorite ? 'heart' : 'heart-outline'}
              size={22}
              color={chat?.isFavorite ? '#e11d48' : colors.textSecondary}
              style={styles.menuIcon}
            />
            <View style={styles.menuItemContent}>
              <Text style={[styles.menuItemTitle, { color: colors.text }]}>
                {chat?.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Danger zone */}
        <View style={[styles.menuSection, { backgroundColor: colors.cardBackground }]}>
          {/* Block */}
          <Pressable style={styles.menuItem} onPress={handleBlockUser}>
            <Ionicons name="ban-outline" size={22} color="#FF3B30" style={styles.menuIcon} />
            <View style={styles.menuItemContent}>
              <Text style={[styles.menuItemTitle, { color: '#FF3B30' }]}>
                {isBlocked ? `Unblock ${userName}` : `Block ${userName}`}
              </Text>
            </View>
          </Pressable>

          {/* Clear chat */}
          <Pressable style={styles.menuItem} onPress={handleClearChat}>
            <Ionicons name="trash-outline" size={22} color="#FF3B30" style={styles.menuIcon} />
            <View style={styles.menuItemContent}>
              <Text style={[styles.menuItemTitle, { color: '#FF3B30' }]}>Clear chat</Text>
            </View>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Dropdown menu */}
      <Modal visible={showMenu} transparent animationType="fade">
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuDropdown, { backgroundColor: colors.cardBackground, top: insets.top + 8 }]}>
            <Pressable style={styles.dropdownItem} onPress={handleShare}>
              <Text style={[styles.dropdownText, { color: colors.text }]}>Share</Text>
            </Pressable>
            <Pressable style={styles.dropdownItem} onPress={handleEdit}>
              <Text style={[styles.dropdownText, { color: colors.text }]}>Edit</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Edit modal */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <View style={[styles.editOverlay]}>
          <View style={[styles.editModal, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.editTitle, { color: colors.text }]}>Edit Contact</Text>

            <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Name</Text>
            <TextInput
              style={[styles.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Name"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Email</Text>
            <TextInput
              style={[styles.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground }]}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder="Email"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Phone</Text>
            <TextInput
              style={[styles.editInput, { color: colors.textSecondary, borderColor: colors.border, backgroundColor: colors.inputBackground }]}
              value={otherUser?.phone || ''}
              editable={false}
              placeholder="Phone"
              placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.editActions}>
              <Pressable style={[styles.editBtn, { backgroundColor: colors.inputBackground }]} onPress={() => setShowEditModal(false)}>
                <Text style={[styles.editBtnText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.editBtn, { backgroundColor: colors.primary }]} onPress={handleSaveEdit}>
                <Text style={[styles.editBtnText, { color: '#fff' }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Share contact modal */}
      <Modal visible={showShareModal} animationType="slide" onRequestClose={() => setShowShareModal(false)}>
        <View style={[styles.shareModal, { backgroundColor: colors.background }]}>
          <View style={[styles.shareHeader, { backgroundColor: colors.primary, paddingTop: insets.top + 4 }]}>
            <Pressable onPress={() => setShowShareModal(false)} style={{ padding: 8 }}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            <Text style={styles.shareTitle}>Share contact</Text>
          </View>
          <View style={[styles.shareSearch, { backgroundColor: colors.inputBackground }]}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.shareSearchInput, { color: colors.text }]}
              placeholder="Search..."
              placeholderTextColor={colors.textSecondary}
              value={shareSearchQuery}
              onChangeText={setShareSearchQuery}
            />
          </View>
          <FlatList
            data={shareChats.filter(c => (c.name || '').toLowerCase().includes(shareSearchQuery.toLowerCase()))}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <Pressable style={styles.shareItem} onPress={() => handleShareContact(item.id)}>
                {item.avatar ? (
                  <Image source={{ uri: item.avatar }} style={styles.shareAvatar} contentFit="cover" />
                ) : (
                  <View style={[styles.shareAvatar, styles.shareInitials]}>
                    <Text style={styles.shareInitialsText}>{getInitials(item.name)}</Text>
                  </View>
                )}
                <Text style={[styles.shareName, { color: colors.text }]} numberOfLines={1}>{item.name || 'Chat'}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>

      {/* Full image preview */}
      <Modal visible={!!previewUrl} transparent animationType="fade" onRequestClose={() => setPreviewUrl(null)}>
        <View style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <Pressable onPress={() => setPreviewUrl(null)} hitSlop={8} style={{ padding: 4, marginRight: 16 }}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            <Text style={styles.previewName} numberOfLines={1}>{userName}</Text>
          </View>
          {previewUrl && (
            <Image source={{ uri: previewUrl }} style={styles.previewImage} contentFit="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    paddingHorizontal: 4,
  },
  headerBack: { padding: 8 },
  headerMenuBtn: { padding: 8 },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  initialsAvatar: {
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '600',
  },
  userName: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: 12,
  },
  userAbout: {
    fontSize: 14,
    marginTop: 4,
  },
  profileActions: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 32,
  },
  profileActionBtn: {
    alignItems: 'center',
    gap: 6,
  },
  profileActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileActionLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  menuSection: {
    marginBottom: 8,
    paddingVertical: 8,
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  menuCount: {
    fontSize: 14,
  },
  mediaPreviewRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  mediaThumb: {
    width: MEDIA_THUMB_SIZE,
    height: MEDIA_THUMB_SIZE,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 4,
  },
  mediaThumbImage: {
    width: '100%',
    height: '100%',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuIcon: {
    marginRight: 16,
    width: 24,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
  },
  menuOverlay: { flex: 1 },
  menuDropdown: {
    position: 'absolute',
    right: 12,
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 180,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownText: {
    fontSize: 15,
  },
  editOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModal: {
    width: '85%',
    borderRadius: 12,
    padding: 24,
  },
  editTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
  },
  editLabel: {
    fontSize: 12,
    marginBottom: 4,
    marginTop: 12,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
    gap: 12,
  },
  editBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  shareModal: { flex: 1 },
  shareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    paddingHorizontal: 8,
    gap: 12,
  },
  shareTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  shareSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  shareSearchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  shareItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  shareAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  shareInitials: {
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareInitialsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  shareName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  previewName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  previewImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
});

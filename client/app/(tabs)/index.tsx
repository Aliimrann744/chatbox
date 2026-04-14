import { router } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ChatListItem } from '@/components/chat/chat-list-item';
import { ProfilePopup } from '@/components/chat/profile-popup';
import { ContactPickerModal } from '@/components/chat/contact-picker-modal';
import { FloatingActionButton } from '@/components/ui/floating-action-button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCall } from '@/contexts/call-context';
import { useAuth } from '@/contexts/auth-context';
import { chatApi, contactApi, Chat, Contact, uploadApi } from '@/services/api';
import socketService from '@/services/socket';
import { cache, CacheKeys } from '@/services/cache';

type FilterType = 'All' | 'Unread' | 'Favorites' | 'Groups';
const FILTERS: FilterType[] = ['All', 'Unread', 'Favorites', 'Groups'];

export default function ChatsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useAuth();
  const currentUserId = user?.id;
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [initialCache] = useState(() => cache.get<Chat[]>(CacheKeys.CHATS));
  const [chats, setChats] = useState<Chat[]>(initialCache || []);
  const [loading, setLoading] = useState(!initialCache);
  const [refreshing, setRefreshing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [popupUser, setPopupUser] = useState<{ id: string; name: string; avatar?: string } | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [showCameraPicker, setShowCameraPicker] = useState(false);
  const [isSendingPhoto, setIsSendingPhoto] = useState(false);
  const { initiateCall } = useCall();

  // ─── Selection Mode State ───────────────────────────────────────────────────
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const isSelectionMode = selectedChatIds.size > 0;

  // Handle Android back button in selection mode
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isSelectionMode) {
        setSelectedChatIds(new Set());
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [isSelectionMode]);

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchChats = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const data = await chatApi.getChats();
      setChats(data);
      cache.set(CacheKeys.CHATS, data);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (chats.length > 0) {
      cache.set(CacheKeys.CHATS, chats);
    }
  }, [chats]);

  useEffect(() => {
    fetchChats();

    const unsubscribeNewMessage = socketService.on('new_message', (message: any) => {
      setChats((prevChats) => {
        const chatIndex = prevChats.findIndex((c) => c.id === message.chatId);
        if (chatIndex === -1) {
          fetchChats();
          return prevChats;
        }

        const updatedChats = [...prevChats];
        updatedChats[chatIndex] = {
          ...updatedChats[chatIndex],
          lastMessage: message,
          unreadCount: updatedChats[chatIndex].unreadCount + 1,
          updatedAt: message.createdAt,
        };

        updatedChats.sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });

        return updatedChats;
      });
    });

    const unsubscribeOnlineStatus = socketService.on('online_status', (data: any) => {
      setChats((prevChats) =>
        prevChats.map((chat) => {
          if (chat.type === 'PRIVATE') {
            const otherMember = chat.members?.find(
              (m) => m.user.id !== data.userId,
            );
            if (otherMember?.user.id === data.userId) {
              return { ...chat, isOnline: data.isOnline, lastSeen: data.lastSeen };
            }
          }
          return chat;
        }),
      );
    });

    const unsubscribeDeletedForEveryone = socketService.on(
      'message_deleted_for_everyone',
      (data: { messageId: string; chatId: string; senderId: string }) => {
        setChats((prevChats) =>
          prevChats.map((chat) => {
            if (chat.id !== data.chatId) return chat;
            if (!chat.lastMessage || chat.lastMessage.id !== data.messageId) return chat;
            return {
              ...chat,
              lastMessage: {
                ...chat.lastMessage,
                isDeletedForEveryone: true,
                content: undefined,
                mediaUrl: undefined,
                thumbnail: undefined,
                fileName: undefined,
              },
            };
          }),
        );
      },
    );

    const unsubscribeDeletedForMe = socketService.on('message_deleted', () => {
      fetchChats();
    });

    return () => {
      unsubscribeNewMessage();
      unsubscribeOnlineStatus();
      unsubscribeDeletedForEveryone();
      unsubscribeDeletedForMe();
    };
  }, [fetchChats]);

  useFocusEffect(
    useCallback(() => {
      fetchChats();
    }, [fetchChats]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchChats();
  }, [fetchChats]);

  // ─── Filtering ──────────────────────────────────────────────────────────────

  const nonArchivedChats = chats.filter((c) => !c.isArchived);
  const archivedCount = chats.filter((c) => c.isArchived).length;

  const filteredChats = (() => {
    let result = nonArchivedChats;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => (c.name || '').toLowerCase().includes(q));
    }

    switch (activeFilter) {
      case 'Unread':
        result = result.filter((c) => {
          if (c.isMarkedUnread) return true;
          if ((c.unreadCount || 0) > 0) return true;
          const last = c.lastMessage;
          if (!last) return false;
          const isIncoming = last.senderId && last.senderId !== currentUserId;
          return !!isIncoming && last.status !== 'READ';
        });
        break;
      case 'Favorites':
        result = result.filter((c) => !!c.isFavorite);
        break;
      case 'Groups':
        result = result.filter((c) => String(c.type).toUpperCase() === 'GROUP');
        break;
    }

    return result;
  })();

  // ─── Selection Helpers ──────────────────────────────────────────────────────

  const selectedChats = chats.filter((c) => selectedChatIds.has(c.id));

  const handleLongPress = useCallback((chatId: string) => {
    setSelectedChatIds(new Set([chatId]));
  }, []);

  const handleSelect = useCallback((chatId: string) => {
    setSelectedChatIds((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) {
        next.delete(chatId);
      } else {
        next.add(chatId);
      }
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectedChatIds(new Set());
    setShowMoreMenu(false);
  }, []);

  const handleSelectAll = useCallback(() => {
    setShowMoreMenu(false);
    setSelectedChatIds(new Set(nonArchivedChats.map((c) => c.id)));
  }, [nonArchivedChats]);

  // ─── Selection Actions ──────────────────────────────────────────────────────

  const handlePinSelected = useCallback(async () => {
    const allPinned = selectedChats.every((c) => c.isPinned);
    const newPinned = !allPinned;

    if (newPinned) {
      const currentPinnedCount = chats.filter((c) => c.isPinned && !selectedChatIds.has(c.id)).length;
      if (currentPinnedCount + selectedChats.length > 3) {
        Alert.alert('Limit reached', 'You can only pin up to 3 chats.');
        return;
      }
    }

    try {
      await Promise.all(selectedChats.map((c) => chatApi.pinChat(c.id, newPinned)));
      setChats((prev) =>
        prev.map((c) => (selectedChatIds.has(c.id) ? { ...c, isPinned: newPinned } : c)),
      );
      exitSelectionMode();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update pin');
    }
  }, [selectedChats, selectedChatIds, chats, exitSelectionMode]);

  const handleDeleteSelected = useCallback(() => {
    const count = selectedChats.length;
    Alert.alert(
      'Delete chat' + (count > 1 ? 's' : '') + '?',
      `Delete ${count} selected chat${count > 1 ? 's' : ''}? You can still receive new messages.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(selectedChats.map((c) => chatApi.deleteChat(c.id)));
              setChats((prev) => prev.filter((c) => !selectedChatIds.has(c.id)));
              exitSelectionMode();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete chats');
            }
          },
        },
      ],
    );
  }, [selectedChats, selectedChatIds, exitSelectionMode]);

  const handleMuteSelected = useCallback(async () => {
    const allMuted = selectedChats.every((c) => c.isMuted);
    const newMuted = !allMuted;

    try {
      await Promise.all(selectedChats.map((c) => chatApi.muteChat(c.id, newMuted)));
      setChats((prev) =>
        prev.map((c) => (selectedChatIds.has(c.id) ? { ...c, isMuted: newMuted } : c)),
      );
      exitSelectionMode();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update mute');
    }
  }, [selectedChats, selectedChatIds, exitSelectionMode]);

  const handleArchiveSelected = useCallback(async () => {
    try {
      await Promise.all(selectedChats.map((c) => chatApi.archiveChat(c.id, true)));
      setChats((prev) =>
        prev.map((c) => (selectedChatIds.has(c.id) ? { ...c, isArchived: true } : c)),
      );
      exitSelectionMode();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to archive chats');
    }
  }, [selectedChats, selectedChatIds, exitSelectionMode]);

  // ─── More Menu Actions ──────────────────────────────────────────────────────

  const handleMarkUnread = useCallback(async () => {
    setShowMoreMenu(false);
    try {
      await Promise.all(selectedChats.map((c) => chatApi.markChatUnread(c.id)));
      setChats((prev) =>
        prev.map((c) => (selectedChatIds.has(c.id) ? { ...c, isMarkedUnread: true } : c)),
      );
      exitSelectionMode();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to mark as unread');
    }
  }, [selectedChats, selectedChatIds, exitSelectionMode]);

  const handleAddToFavorites = useCallback(async () => {
    setShowMoreMenu(false);
    const allFav = selectedChats.every((c) => c.isFavorite);
    const newFav = !allFav;
    try {
      await Promise.all(selectedChats.map((c) => chatApi.favoriteChat(c.id, newFav)));
      setChats((prev) =>
        prev.map((c) => (selectedChatIds.has(c.id) ? { ...c, isFavorite: newFav } : c)),
      );
      exitSelectionMode();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update favorites');
    }
  }, [selectedChats, selectedChatIds, exitSelectionMode]);

  const handleClearChat = useCallback(() => {
    setShowMoreMenu(false);
    const count = selectedChats.length;
    Alert.alert(
      'Clear chat' + (count > 1 ? 's' : '') + '?',
      'All messages will be removed for you. Other participants will still see them.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(selectedChats.map((c) => chatApi.clearChat(c.id)));
              // Clear per-chat message caches so no stale messages flash
              for (const c of selectedChats) {
                cache.delete(CacheKeys.messages(c.id));
              }
              setChats((prev) =>
                prev.map((c) =>
                  selectedChatIds.has(c.id) ? { ...c, lastMessage: undefined, unreadCount: 0 } : c,
                ),
              );
              exitSelectionMode();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to clear chats');
            }
          },
        },
      ],
    );
  }, [selectedChats, selectedChatIds, exitSelectionMode]);

  const handleBlockChat = useCallback(() => {
    setShowMoreMenu(false);
    // Only block private chats (1-on-1)
    const privateChats = selectedChats.filter((c) => c.type === 'PRIVATE');
    if (privateChats.length === 0) {
      Alert.alert('Cannot block', 'You can only block users in private chats.');
      return;
    }
    const names = privateChats.map((c) => c.name || 'Deleted Account').join(', ');
    Alert.alert(
      'Block user' + (privateChats.length > 1 ? 's' : '') + '?',
      `Block ${names}? They will no longer be able to send you messages.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const chat of privateChats) {
                const otherMember = chat.members?.find((m) => m.userId !== currentUserId);
                if (otherMember) {
                  await contactApi.blockUser(otherMember.userId);
                }
              }
              exitSelectionMode();
              Alert.alert('Blocked', 'User' + (privateChats.length > 1 ? 's' : '') + ' blocked successfully.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to block user');
            }
          },
        },
      ],
    );
  }, [selectedChats, currentUserId, exitSelectionMode]);

  const handleViewContact = useCallback(() => {
    setShowMoreMenu(false);
    if (selectedChats.length !== 1) {
      Alert.alert('Select one chat', 'Please select a single chat to view contact.');
      return;
    }
    const chat = selectedChats[0];
    if (chat.type === 'PRIVATE') {
      const otherMember = chat.members?.find((m) => m.userId !== currentUserId);
      exitSelectionMode();
      if (otherMember) {
        router.push({ pathname: '/chat/user-info' as any, params: { chatId: chat.id, userId: otherMember.userId } });
      } else {
        Alert.alert('Deleted Account', 'This user has deleted their account.');
      }
    } else {
      exitSelectionMode();
      router.push({ pathname: '/group/[id]/info' as any, params: { id: chat.id } });
    }
  }, [selectedChats, currentUserId, exitSelectionMode]);

  // ─── Normal Mode Handlers ───────────────────────────────────────────────────

  const handleNewChat = () => router.push('/new-chat');

  const handleCameraPress = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera permission required', 'Please enable camera access in your device settings to take pictures.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      setCapturedPhoto(result.assets[0]);
      setShowCameraPicker(true);
    } catch (err: any) {
      console.error('Camera error', err);
      Alert.alert('Error', err?.message || 'Could not open camera');
    }
  };

  const handleSharePhoto = async (contacts: Contact[]) => {
    if (!capturedPhoto || contacts.length === 0) return;

    setShowCameraPicker(false);
    setIsSendingPhoto(true);
    try {
      const ext = (capturedPhoto.uri.split('.').pop() || 'jpg').toLowerCase();
      const mimeType = capturedPhoto.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      const upload = await uploadApi.uploadFile(
        { uri: capturedPhoto.uri, type: mimeType, name: `photo.${ext}` },
        'messages',
      );

      await Promise.all(
        contacts.map(async (contact) => {
          try {
            const chat = await chatApi.createChat(contact.contactId);
            await chatApi.sendMessage(chat.id, {
              type: 'IMAGE',
              mediaUrl: upload.url,
              mediaType: mimeType,
              fileName: `photo.${ext}`,
            });
          } catch (err) {
            console.error('Failed to share photo with', contact.contactId, err);
          }
        }),
      );
      Alert.alert('Sent', `Photo shared with ${contacts.length} contact${contacts.length > 1 ? 's' : ''}.`);
      fetchChats();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to share photo');
    } finally {
      setCapturedPhoto(null);
      setIsSendingPhoto(false);
    }
  };

  const handleMarkAllRead = useCallback(() => {
    Alert.alert(
      'Mark all chats as read?',
      undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'OK',
          style: 'default',
          onPress: async () => {
            try {
              let ok = false;
              try {
                const res = await socketService.markAllRead();
                ok = !!res?.success;
              } catch {
                ok = false;
              }
              if (!ok) {
                await chatApi.markAllChatsAsRead();
              }

              setChats((prev) =>
                prev.map((c) => {
                  if (!c.lastMessage) return { ...c, unreadCount: 0, isMarkedUnread: false };
                  const last = c.lastMessage;
                  const isIncoming = last.senderId && last.senderId !== currentUserId;
                  return {
                    ...c,
                    unreadCount: 0,
                    isMarkedUnread: false,
                    lastMessage: isIncoming ? { ...last, status: 'READ' as const } : last,
                  };
                }),
              );
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to mark chats as read');
            }
          },
        },
      ],
      { cancelable: true },
    );
  }, [currentUserId]);

  const handleMenuOption = (option: string) => {
    setShowMenu(false);
    switch (option) {
      case 'new-group':
        router.push('/new-chat');
        break;
      case 'shared':
        router.push('/shared-messages');
        break;
      case 'read-all':
        handleMarkAllRead();
        break;
      case 'settings':
        router.push('/(tabs)/profile');
        break;
      case 'linked-devices':
      case 'switch-account':
        break;
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const allSelectedPinned = selectedChats.length > 0 && selectedChats.every((c) => c.isPinned);
  const allSelectedMuted = selectedChats.length > 0 && selectedChats.every((c) => c.isMuted);
  const allSelectedFav = selectedChats.length > 0 && selectedChats.every((c) => c.isFavorite);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ─── Selection Header ────────────────────────────────────────────────── */}
      {isSelectionMode ? (
        <View style={[styles.selectionHeader, { paddingTop: insets.top + 8, backgroundColor: colors.primary }]}>
          <View style={styles.selectionHeaderLeft}>
            <Pressable onPress={exitSelectionMode} hitSlop={12} style={styles.selectionBackBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            <Text style={styles.selectionCount}>{selectedChatIds.size}</Text>
          </View>

          <View style={styles.selectionHeaderRight}>
            <Pressable onPress={handlePinSelected} hitSlop={8} style={styles.selectionIconBtn}>
              <Ionicons name={allSelectedPinned ? 'pin-outline' : 'pin'} size={22} color="#fff" />
            </Pressable>
            <Pressable onPress={handleDeleteSelected} hitSlop={8} style={styles.selectionIconBtn}>
              <Ionicons name="trash-outline" size={22} color="#fff" />
            </Pressable>
            <Pressable onPress={handleMuteSelected} hitSlop={8} style={styles.selectionIconBtn}>
              <Ionicons name={allSelectedMuted ? 'volume-high-outline' : 'volume-mute-outline'} size={22} color="#fff" />
            </Pressable>
            <Pressable onPress={handleArchiveSelected} hitSlop={8} style={styles.selectionIconBtn}>
              <Ionicons name="archive-outline" size={22} color="#fff" />
            </Pressable>
            <Pressable onPress={() => setShowMoreMenu(true)} hitSlop={8} style={styles.selectionIconBtn}>
              <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
      ) : (
        /* ─── Normal Header ──────────────────────────────────────────────────── */
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>WhatsApp</Text>
          <View style={styles.headerIcons}>
            <Pressable style={styles.headerIconButton} hitSlop={8} onPress={handleCameraPress}>
              <Ionicons name="camera-outline" size={24} color={colors.icon} />
            </Pressable>
            <Pressable style={styles.headerIconButton} hitSlop={8} onPress={() => setShowMenu(true)}>
              <Ionicons name="ellipsis-vertical" size={20} color={colors.icon} />
            </Pressable>
          </View>
        </View>
      )}

      {/* ─── Search Bar ─────────────────────────────────────────────────────── */}
      {!isSelectionMode && (
        <>
          <View style={styles.searchContainer}>
            <View style={[styles.searchBar, { backgroundColor: colors.inputBackground }]}>
              <Ionicons name="search" size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Ask Meta AI or Search"
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filtersScroll}
            contentContainerStyle={styles.filtersRow}
            keyboardShouldPersistTaps="handled"
          >
            {FILTERS?.map((filter) => (
              <Pressable
                key={filter}
                onPress={() => setActiveFilter(filter)}
                style={[
                  styles.filterChip,
                  { backgroundColor: activeFilter === filter ? '#139047' : colors.inputBackground },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: activeFilter === filter ? '#ffffff' : colors.text },
                  ]}
                >
                  {filter}
                </Text>
              </Pressable>
            ))}
            <Pressable style={[styles.filterAddButton, { backgroundColor: colors.inputBackground }]}>
              <Ionicons name="add" size={18} color={colors.text} />
            </Pressable>
          </ScrollView>
        </>
      )}

      {/* ─── Archived Chats Banner ──────────────────────────────────────────── */}
      {!isSelectionMode && archivedCount > 0 && activeFilter === 'All' && !searchQuery && (
        <Pressable
          style={[styles.archivedBanner, { borderBottomColor: colors.border }]}
          onPress={() => router.push('/archived-chats')}
        >
          <View style={styles.archivedBannerLeft}>
            <Ionicons name="archive" size={20} color={colors.primary} />
            <Text style={[styles.archivedBannerText, { color: colors.text }]}>Archived</Text>
          </View>
          <Text style={[styles.archivedBannerCount, { color: colors.accent }]}>{archivedCount}</Text>
        </Pressable>
      )}

      {filteredChats?.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {activeFilter !== 'All' ? `No ${activeFilter.toLowerCase()} chats` : 'No chats yet'}
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            Start a conversation by tapping the button below
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatListItem
              chat={item}
              isSelected={selectedChatIds.has(item.id)}
              isSelectionMode={isSelectionMode}
              onLongPress={handleLongPress}
              onSelect={handleSelect}
              onAvatarPress={(user) => {
                setPopupUser(user);
                setShowPopup(true);
              }}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}

      <ProfilePopup
        visible={showPopup}
        onClose={() => setShowPopup(false)}
        user={popupUser}
        onMessage={() => {
          const chat = chats.find((c) => c.type === 'PRIVATE' && c.members?.some((m) => m.user.id === popupUser?.id));
          if (chat) router.push({ pathname: '/chat/[id]', params: { id: chat.id } });
        }}
        onAudioCall={async () => {
          if (popupUser) {
            await initiateCall(popupUser.id, popupUser.name, popupUser.avatar, 'VOICE');
            router.push('/call/active');
          }
        }}
        onVideoCall={async () => {
          if (popupUser) {
            await initiateCall(popupUser.id, popupUser.name, popupUser.avatar, 'VIDEO');
            router.push('/call/active');
          }
        }}
        onInfo={() => {
          const chat = chats.find((c) => c.type === 'PRIVATE' && c.members?.some((m) => m.user.id === popupUser?.id));
          if (chat) router.push({ pathname: '/chat/user-info' as any, params: { chatId: chat.id, userId: popupUser?.id } });
        }}
      />

      {/* Camera contact picker */}
      <ContactPickerModal
        visible={showCameraPicker}
        onClose={() => { setShowCameraPicker(false); setCapturedPhoto(null); }}
        onConfirm={handleSharePhoto}
        maxSelection={5}
        title="Share photo with..."
        confirmLabel="Send"
      />

      {/* Sending overlay */}
      {isSendingPhoto && (
        <View style={styles.sendingOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.sendingText}>Sending photo...</Text>
        </View>
      )}

      {!isSelectionMode && <FloatingActionButton onPress={handleNewChat} icon="message.fill" />}

      {/* ─── Normal Mode Menu ────────────────────────────────────────────────── */}
      <Modal visible={showMenu} transparent animationType="fade">
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuDropdown, { backgroundColor: colors.cardBackground, top: insets.top + 8 }]}>
            <Pressable style={styles.menuItem} onPress={() => handleMenuOption('new-group')}>
              <Text style={[styles.menuItemText, { color: colors.text }]}>New group</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={() => handleMenuOption('linked-devices')}>
              <Text style={[styles.menuItemText, { color: colors.text }]}>Linked devices</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={() => handleMenuOption('shared')}>
              <Text style={[styles.menuItemText, { color: colors.text }]}>Starred</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={() => handleMenuOption('read-all')}>
              <Text style={[styles.menuItemText, { color: colors.text }]}>Read all</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={() => handleMenuOption('settings')}>
              <Text style={[styles.menuItemText, { color: colors.text }]}>Settings</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={() => handleMenuOption('switch-account')}>
              <Text style={[styles.menuItemText, { color: colors.text }]}>Switch accounts</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ─── Selection More Options Menu ─────────────────────────────────────── */}
      <Modal visible={showMoreMenu} transparent animationType="fade">
        <Pressable style={styles.menuOverlay} onPress={() => setShowMoreMenu(false)}>
          <View style={[styles.menuDropdown, { backgroundColor: colors.cardBackground, top: insets.top + 8 }]}>
            {selectedChats.length === 1 && (
              <Pressable style={styles.menuItem} onPress={handleViewContact}>
                <Ionicons name="person-outline" size={20} color={colors.text} style={styles.menuIcon} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>View contact</Text>
              </Pressable>
            )}
            <Pressable style={styles.menuItem} onPress={handleMarkUnread}>
              <Ionicons name="mail-unread-outline" size={20} color={colors.text} style={styles.menuIcon} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>Mark as unread</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={handleSelectAll}>
              <Ionicons name="checkbox-outline" size={20} color={colors.text} style={styles.menuIcon} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>Select all</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={handleAddToFavorites}>
              <Ionicons name={allSelectedFav ? 'heart-dislike-outline' : 'heart-outline'} size={20} color={colors.text} style={styles.menuIcon} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                {allSelectedFav ? 'Remove from favorites' : 'Add to favorites'}
              </Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={handleClearChat}>
              <Ionicons name="chatbox-outline" size={20} color={colors.text} style={styles.menuIcon} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>Clear chat</Text>
            </Pressable>
            {selectedChats.some((c) => c.type === 'PRIVATE') && (
              <Pressable style={styles.menuItem} onPress={handleBlockChat}>
                <Ionicons name="ban-outline" size={20} color="#e74c3c" style={styles.menuIcon} />
                <Text style={[styles.menuItemText, { color: '#e74c3c' }]}>Block</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Normal Header ────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconButton: {
    padding: 8,
  },

  // ─── Selection Header ──────────────────────────────────────────────────────
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  selectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionBackBtn: {
    padding: 8,
  },
  selectionCount: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 12,
  },
  selectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionIconBtn: {
    padding: 10,
  },

  // ─── Search ────────────────────────────────────────────────────────────────
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },

  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filtersScroll: {
    flexGrow: 0,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  filterAddButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Archived Banner ───────────────────────────────────────────────────────
  archivedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  archivedBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  archivedBannerText: {
    fontSize: 16,
    fontWeight: '500',
  },
  archivedBannerCount: {
    fontSize: 14,
    fontWeight: '600',
  },

  listContent: {
    paddingBottom: 100,
  },

  // ─── Empty State ──────────────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
  },

  // ─── Menu ──────────────────────────────────────────────────────────────────
  menuOverlay: {
    flex: 1,
  },
  menuDropdown: {
    position: 'absolute',
    right: 12,
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 220,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuIcon: {
    marginRight: 14,
  },
  menuItemText: {
    fontSize: 15,
  },
  sendingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  sendingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 15,
  },
});

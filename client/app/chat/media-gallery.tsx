import { router, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { chatApi, SharedMedia } from '@/services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const ITEM_SIZE = (SCREEN_WIDTH - 4) / NUM_COLUMNS;

type TabType = 'Media' | 'Docs';

export default function MediaGalleryScreen() {
  const { chatId, chatName } = useLocalSearchParams<{ chatId: string; chatName?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('Media');
  const [media, setMedia] = useState<SharedMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fetchMedia = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);
    try {
      const type = activeTab === 'Media' ? undefined : 'DOCUMENT';
      const data = await chatApi.getSharedMedia(chatId, type, 1, 200);
      if (activeTab === 'Media') {
        setMedia(data.media.filter(m => m.type === 'IMAGE' || m.type === 'VIDEO'));
      } else {
        setMedia(data.media);
      }
    } catch (error) {
      console.error('Error fetching media:', error);
    } finally {
      setLoading(false);
    }
  }, [chatId, activeTab]);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  const renderMediaItem = ({ item }: { item: SharedMedia }) => (
    <Pressable style={styles.mediaItem} onPress={() => item.mediaUrl && setPreviewUrl(item.mediaUrl)}>
      {item.type === 'IMAGE' || item.type === 'VIDEO' ? (
        <Image source={{ uri: item.thumbnail || item.mediaUrl }} style={styles.mediaThumbnail} contentFit="cover" />
      ) : (
        <View style={[styles.mediaThumbnail, styles.docItem, { backgroundColor: colors.inputBackground }]}>
          <Ionicons name="document" size={28} color={colors.textSecondary} />
          <Text style={[styles.docName, { color: colors.text }]} numberOfLines={2}>{item.fileName || 'Document'}</Text>
        </View>
      )}
      {item.type === 'VIDEO' && (
        <View style={styles.videoOverlay}>
          <Ionicons name="play" size={24} color="#fff" />
        </View>
      )}
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{chatName || 'Media, links, and docs'}</Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(['Media', 'Docs'] as TabType[]).map(tab => (
          <Pressable key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.textSecondary }]}>{tab}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : media.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name={activeTab === 'Media' ? 'images-outline' : 'document-outline'} size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No {activeTab.toLowerCase()} shared yet</Text>
        </View>
      ) : (
        <FlatList
          data={media}
          keyExtractor={item => item.id}
          renderItem={renderMediaItem}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.grid}
        />
      )}

      {/* Image Preview */}
      <Modal visible={!!previewUrl} transparent animationType="fade" onRequestClose={() => setPreviewUrl(null)}>
        <View style={styles.previewContainer}>
          <Pressable style={styles.previewClose} onPress={() => setPreviewUrl(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    paddingHorizontal: 8,
  },
  backButton: { padding: 8 },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#075E54',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  grid: { padding: 1 },
  mediaItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    padding: 1,
  },
  mediaThumbnail: {
    width: '100%',
    height: '100%',
  },
  docItem: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  docName: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  previewImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
  },
});

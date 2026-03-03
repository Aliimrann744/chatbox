import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { statusApi, uploadApi } from '@/services/api';
import { pickMultipleMedia, PickedMedia } from '@/utils/media-picker';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function StatusCreateScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const [media, setMedia] = useState<PickedMedia[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    (async () => {
      const picked = await pickMultipleMedia();
      if (!picked.length) {
        router.back();
        return;
      }
      setMedia(picked);
    })();
  }, []);

  const handleSend = async () => {
    if (!media.length || uploading) return;
    setUploading(true);

    try {
      for (let i = 0; i < media.length; i++) {
        const item = media[i];
        setProgress(`Uploading ${i + 1}/${media.length}...`);

        const uploaded = await uploadApi.uploadFile(
          { uri: item.uri, type: item.mimeType, name: item.name },
          'status',
        );

        await statusApi.createStatus({
          type: item.type === 'video' ? 'VIDEO' : 'IMAGE',
          mediaUrl: uploaded.url,
          caption: i === 0 ? caption || undefined : undefined,
        });
      }

      router.back();
    } catch (error) {
      console.error('Failed to create status:', error);
      setUploading(false);
      setProgress('');
    }
  };

  const renderMediaItem = ({ item }: { item: PickedMedia }) => {
    if (item.type === 'video') {
      return (
        <View style={styles.mediaContainer}>
          <Video
            source={{ uri: item.uri }}
            style={styles.media}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={false}
            isLooping={false}
          />
        </View>
      );
    }
    return (
      <View style={styles.mediaContainer}>
        <Image source={{ uri: item.uri }} style={styles.media} resizeMode="contain" />
      </View>
    );
  };

  if (!media.length) {
    return (
      <View style={[styles.container, { backgroundColor: '#000' }]}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <IconSymbol name="xmark" size={28} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={handleSend}
          disabled={uploading}
          style={[styles.sendButton, { backgroundColor: colors.accent }]}>
          <IconSymbol name="paperplane.fill" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* Media Preview */}
      <FlatList
        ref={flatListRef}
        data={media}
        renderItem={renderMediaItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => i.toString()}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(index);
        }}
      />

      {/* Page Indicator */}
      {media.length > 1 && (
        <View style={styles.pageIndicator}>
          {media.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === currentIndex ? '#fff' : 'rgba(255,255,255,0.4)' },
              ]}
            />
          ))}
        </View>
      )}

      {/* Caption Bar */}
      <View style={[styles.captionBar, { paddingBottom: insets.bottom + 12 }]}>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Add a caption..."
          placeholderTextColor="rgba(255,255,255,0.6)"
          style={styles.captionInput}
          multiline
          maxLength={500}
        />
      </View>

      {/* Upload Overlay */}
      {uploading && (
        <View style={styles.uploadOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.uploadText}>{progress}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerButton: {
    padding: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
  pageIndicator: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  captionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  captionInput: {
    color: '#fff',
    fontSize: 16,
    maxHeight: 80,
    paddingVertical: 8,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  uploadText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
});

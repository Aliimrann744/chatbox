import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { statusApi, uploadApi } from '@/services/api';
import { pickMultipleMedia, PickedMedia } from '@/utils/media-picker';
import * as ImagePicker from 'expo-image-picker';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DRAW_COLORS = [
  '#FFFFFF', '#000000', '#FF3B30', '#FF9500', '#FFCC00',
  '#34C759', '#007AFF', '#5856D6', '#AF52DE', '#FF2D55',
];

interface DrawPath {
  path: string;
  color: string;
  strokeWidth: number;
}

export default function StatusCreateScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const [mediaList, setMediaList] = useState<PickedMedia[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const media = mediaList[currentIndex] || null;
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPaths, setDrawPaths] = useState<DrawPath[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [drawColor, setDrawColor] = useState('#FF3B30');
  const [hasEdits, setHasEdits] = useState(false);

  // Keyboard state
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false),
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Pick media on mount
  useEffect(() => {
    (async () => {
      const picked = await pickMultipleMedia();
      if (!picked.length) {
        router.back();
        return;
      }
      setMediaList(picked);
      setCurrentIndex(0);
    })();
  }, []);

  // Use refs for values accessed inside PanResponder (avoids stale closures)
  const isDrawingRef = useRef(false);
  const drawColorRef = useRef(drawColor);
  const currentPathRef = useRef('');

  useEffect(() => { isDrawingRef.current = isDrawing; }, [isDrawing]);
  useEffect(() => { drawColorRef.current = drawColor; }, [drawColor]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isDrawingRef.current,
      onMoveShouldSetPanResponder: () => isDrawingRef.current,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        const p = `M${locationX},${locationY}`;
        currentPathRef.current = p;
        setCurrentPath(p);
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        const p = `${currentPathRef.current} L${locationX},${locationY}`;
        currentPathRef.current = p;
        setCurrentPath(p);
      },
      onPanResponderRelease: () => {
        const p = currentPathRef.current;
        if (p) {
          setDrawPaths((prev) => [...prev, { path: p, color: drawColorRef.current, strokeWidth: 4 }]);
          currentPathRef.current = '';
          setCurrentPath('');
          setHasEdits(true);
        }
      },
    }),
  ).current;

  const handleCrop = async () => {
    if (!media || media.type === 'video') return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: undefined,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const fileName = asset.uri.split('/').pop() || 'cropped.jpg';
        setMediaList((prev) => {
          const updated = [...prev];
          updated[currentIndex] = {
            uri: asset.uri,
            type: 'image',
            mimeType: asset.mimeType || 'image/jpeg',
            name: fileName,
            size: asset.fileSize,
            width: asset.width,
            height: asset.height,
          };
          return updated;
        });
        setDrawPaths([]);
        setHasEdits(true);
      }
    } catch (error) {
      console.error('Crop error:', error);
    }
  };

  const handleReselect = async () => {
    if (hasEdits || drawPaths.length > 0) {
      Alert.alert(
        'Discard changes?',
        'Your edits will be lost if you select a new image.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: doReselect,
          },
        ],
      );
    } else {
      doReselect();
    }
  };

  const doReselect = async () => {
    const picked = await pickMultipleMedia();
    if (picked.length) {
      setMediaList(picked);
      setCurrentIndex(0);
      setDrawPaths([]);
      setCurrentPath('');
      setHasEdits(false);
      setCaption('');
    }
  };

  const toggleDraw = () => {
    setIsDrawing((prev) => !prev);
  };

  const undoLastDraw = () => {
    setDrawPaths((prev) => prev.slice(0, -1));
    if (drawPaths.length <= 1) setHasEdits(false);
  };

  const handleSend = async () => {
    if (!mediaList.length || uploading) return;
    setUploading(true);

    try {
      for (let i = 0; i < mediaList.length; i++) {
        const item = mediaList[i];
        setProgress(`Uploading ${i + 1} of ${mediaList.length}...`);
        const uploaded = await uploadApi.uploadFile(
          { uri: item.uri, type: item.mimeType, name: item.name },
          'status',
        );

        await statusApi.createStatus({
          type: item.type === 'video' ? 'VIDEO' : 'IMAGE',
          mediaUrl: uploaded.url,
          caption: i === 0 ? (caption || undefined) : undefined,
        });
      }

      router.back();
    } catch (error) {
      console.error('Failed to create status:', error);
      setUploading(false);
      setProgress('');
    }
  };

  const handleClose = () => {
    if (hasEdits || caption.trim()) {
      Alert.alert(
        'Discard status?',
        'If you go back now, your changes will be lost.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => router.back() },
        ],
      );
    } else {
      router.back();
    }
  };

  if (!mediaList.length) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  const bottomPadding = keyboardVisible ? 6 : insets.bottom + 6;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ─── Top Header ─── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={handleClose} style={styles.headerIconBtn}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }} />
        {media.type === 'image' && (
          <>
            <Pressable onPress={handleCrop} style={styles.headerIconBtn}>
              <Ionicons name="crop" size={24} color="#fff" />
            </Pressable>
            <Pressable
              onPress={toggleDraw}
              style={[styles.headerIconBtn, isDrawing && styles.headerIconActive]}
            >
              <Ionicons name="brush" size={24} color="#fff" />
            </Pressable>
          </>
        )}
      </View>

      {/* ─── Media Preview ─── */}
      <View style={styles.mediaArea} {...(isDrawing ? panResponder.panHandlers : {})}>
        {media.type === 'video' ? (
          <Video
            source={{ uri: media.uri }}
            style={styles.mediaFull}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={false}
            isLooping={false}
          />
        ) : (
          <Image source={{ uri: media.uri }} style={styles.mediaFull} resizeMode="contain" />
        )}

        {/* Drawing overlay */}
        {media.type === 'image' && (drawPaths.length > 0 || currentPath) && (
          <Svg style={StyleSheet.absoluteFill}>
            {drawPaths.map((p, i) => (
              <Path
                key={i}
                d={p.path}
                stroke={p.color}
                strokeWidth={p.strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {currentPath ? (
              <Path
                d={currentPath}
                stroke={drawColor}
                strokeWidth={4}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
          </Svg>
        )}

        {/* Multi-media counter */}
        {mediaList.length > 1 && (
          <View style={styles.mediaCounter}>
            <Text style={styles.mediaCounterText}>{currentIndex + 1} / {mediaList.length}</Text>
          </View>
        )}

        {/* Multi-media navigation */}
        {mediaList.length > 1 && currentIndex > 0 && (
          <Pressable onPress={() => setCurrentIndex(i => i - 1)} style={[styles.mediaNavBtn, styles.mediaNavBtnLeft]}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </Pressable>
        )}
        {mediaList.length > 1 && currentIndex < mediaList.length - 1 && (
          <Pressable onPress={() => setCurrentIndex(i => i + 1)} style={[styles.mediaNavBtn, styles.mediaNavBtnRight]}>
            <Ionicons name="chevron-forward" size={28} color="#fff" />
          </Pressable>
        )}
      </View>

      {/* ─── Draw Color Picker ─── */}
      {isDrawing && (
        <View style={styles.colorPickerBar}>
          <Pressable onPress={undoLastDraw} style={styles.undoBtn}>
            <Ionicons name="arrow-undo" size={22} color="#fff" />
          </Pressable>
          <View style={styles.colorDots}>
            {DRAW_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setDrawColor(c)}
                style={[
                  styles.colorDot,
                  { backgroundColor: c },
                  drawColor === c && styles.colorDotSelected,
                ]}
              />
            ))}
          </View>
        </View>
      )}

      {/* ─── Bottom Caption Bar ─── */}
      {!isDrawing && (
        <View style={[styles.bottomBar, { paddingBottom: bottomPadding }]}>
          <View style={styles.captionRow}>
            <Pressable onPress={handleReselect} style={styles.captionIconBtn}>
              <Ionicons name="images-outline" size={22} color="#fff" />
            </Pressable>
            <TextInput
              value={caption}
              onChangeText={(text) => { setCaption(text); }}
              placeholder="Add a caption..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              style={styles.captionInput}
              multiline
              maxLength={500}
            />
            <Pressable
              onPress={handleSend}
              disabled={uploading}
              style={[styles.sendBtn, { backgroundColor: colors.accent }]}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
      )}

      {/* ─── Upload Overlay ─── */}
      {uploading && (
        <View style={styles.uploadOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.uploadText}>{progress}</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  headerIconActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  // Media
  mediaArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaFull: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.72,
  },

  // Color picker
  colorPickerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  undoBtn: {
    padding: 8,
    marginRight: 8,
  },
  colorDots: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotSelected: {
    borderColor: '#fff',
    transform: [{ scale: 1.2 }],
  },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: 8,
    paddingTop: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 24,
    paddingLeft: 6,
    paddingRight: 6,
    paddingVertical: 4,
    minHeight: 48,
  },
  captionIconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captionInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    maxHeight: 100,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Media navigation
  mediaCounter: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  mediaCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  mediaNavBtn: {
    position: 'absolute',
    top: '45%',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaNavBtnLeft: {
    left: 8,
  },
  mediaNavBtnRight: {
    right: 8,
  },

  // Upload overlay
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

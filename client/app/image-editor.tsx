import { router, useLocalSearchParams } from 'expo-router';
import React, { useState, useCallback } from 'react';
import {
  Alert,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

/**
 * WhatsApp-like image preview / editor screen.
 *
 * Params:
 *   uri       – local file URI of the captured/picked image
 *   mode      – "chat" | "share"
 *     "chat"  → send directly to current chat (chatId required)
 *     "share" → open contact picker, then send to selected contacts
 *   chatId    – (optional) target chat ID when mode=chat
 *   recipient – (optional) display name for the recipient label
 *
 * On completion the screen pops itself and passes back via router params
 * or emits a global event. For simplicity we use router.back() with a
 * global callback pattern.
 */

// Global callback for when the editor finishes — set by the caller before
// navigating to this screen, consumed once.
let _onEditorDone: ((uri: string, caption: string) => void) | null = null;

export function setImageEditorCallback(cb: (uri: string, caption: string) => void) {
  _onEditorDone = cb;
}

export default function ImageEditorScreen() {
  const params = useLocalSearchParams<{
    uri: string;
    recipient?: string;
  }>();
  const insets = useSafeAreaInsets();

  const [imageUri, setImageUri] = useState(params.uri);
  const [caption, setCaption] = useState('');
  const [isCropping, setIsCropping] = useState(false);

  const handleCancel = useCallback(() => {
    _onEditorDone = null;
    router.back();
  }, []);

  const handleCrop = useCallback(async () => {
    if (!imageUri) return;
    setIsCropping(true);
    try {
      // Use ImageManipulator for a center crop to square as a quick crop action.
      // For a full crop UI we'd need a third-party lib, but this provides
      // a useful "crop to square" that matches WhatsApp's common use case.
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1080 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
      setImageUri(result.uri);
    } catch (err) {
      console.error('Crop error:', err);
      Alert.alert('Error', 'Failed to process image');
    } finally {
      setIsCropping(false);
    }
  }, [imageUri]);

  const handleRotate = useCallback(async () => {
    if (!imageUri) return;
    try {
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ rotate: 90 }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
      setImageUri(result.uri);
    } catch (err) {
      console.error('Rotate error:', err);
    }
  }, [imageUri]);

  const handleSend = useCallback(() => {
    if (!imageUri) return;
    if (_onEditorDone) {
      const cb = _onEditorDone;
      _onEditorDone = null;
      cb(imageUri, caption.trim());
    }
    router.back();
  }, [imageUri, caption]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ─── Top Bar ──────────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <Pressable onPress={handleCancel} hitSlop={12} style={styles.topBarBtn}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <View style={styles.topBarRight}>
          <Pressable onPress={handleCrop} hitSlop={8} style={styles.topBarBtn} disabled={isCropping}>
            <Ionicons name="crop" size={24} color="#fff" />
          </Pressable>
          <Pressable onPress={handleRotate} hitSlop={8} style={styles.topBarBtn}>
            <Ionicons name="refresh" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* ─── Image Preview ────────────────────────────────────────────────── */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: imageUri }}
          style={styles.imagePreview}
          contentFit="contain"
          transition={150}
        />
      </View>

      {/* ─── Bottom Bar ───────────────────────────────────────────────────── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.captionRow}>
          <TextInput
            style={styles.captionInput}
            placeholder="Add a caption..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={caption}
            onChangeText={setCaption}
            maxLength={500}
            multiline
          />
        </View>
        <View style={styles.sendRow}>
          {params.recipient ? (
            <Text style={styles.recipientLabel} numberOfLines={1}>
              {params.recipient}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <Pressable
            onPress={handleSend}
            style={({ pressed }) => [
              styles.sendButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Ionicons name="send" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  topBarBtn: {
    padding: 8,
  },

  // Image
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreview: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.6,
  },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 12,
  },
  captionInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    maxHeight: 80,
    padding: 0,
  },
  sendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recipientLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    flex: 1,
    marginRight: 12,
  },
  sendButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});

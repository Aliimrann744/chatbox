import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image as RNImage,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
// Square crop window — occupies most of the screen width with small insets
// and leaves room for the header + footer.
const CROP_SIZE = Math.min(SCREEN_W - 24, SCREEN_H - 300);
const MIN_SCALE = 1;
const MAX_SCALE = 4;

// One-shot callback — caller registers this before navigating here and it's
// consumed on successful send.
let _onAvatarEditorDone: ((uri: string) => void) | null = null;

export function setAvatarEditorCallback(cb: (uri: string) => void) {
  _onAvatarEditorDone = cb;
}

const getImageSize = (uri: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    RNImage.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });

export default function AvatarEditorScreen() {
  const params = useLocalSearchParams<{ uri: string }>();
  const insets = useSafeAreaInsets();

  const [imageUri, setImageUri] = useState(params.uri);
  const [processing, setProcessing] = useState(false);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);

  // Reactive image display dimensions (as shared values so worklets can read them)
  const dispW = useSharedValue(CROP_SIZE);
  const dispH = useSharedValue(CROP_SIZE);

  // Pan + pinch state
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const savedScale = useSharedValue(1);

  const resetGestures = useCallback(
    (animated = false) => {
      if (animated) {
        tx.value = withTiming(0, { duration: 200 });
        ty.value = withTiming(0, { duration: 200 });
        scale.value = withTiming(1, { duration: 200 });
      } else {
        tx.value = 0;
        ty.value = 0;
        scale.value = 1;
      }
      savedTx.value = 0;
      savedTy.value = 0;
      savedScale.value = 1;
    },
    [tx, ty, scale, savedTx, savedTy, savedScale],
  );

  // Whenever the image URI changes (pick, rotate, flip), re-read its natural
  // size so the inner <Image/> can be sized correctly to cover the crop
  // window, and reset the pan/zoom.
  useEffect(() => {
    let cancelled = false;
    getImageSize(imageUri)
      .then((size) => {
        if (cancelled) return;
        setNatural(size);
        const cover = Math.max(
          CROP_SIZE / size.width,
          CROP_SIZE / size.height,
        );
        dispW.value = size.width * cover;
        dispH.value = size.height * cover;
        resetGestures(false);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [imageUri, dispW, dispH, resetGestures]);

  // ─── Gestures ─────────────────────────────────────────────────────────
  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    })
    .onUpdate((e) => {
      'worklet';
      const maxX = Math.max(0, (dispW.value * scale.value - CROP_SIZE) / 2);
      const maxY = Math.max(0, (dispH.value * scale.value - CROP_SIZE) / 2);
      let nx = savedTx.value + e.translationX;
      let ny = savedTy.value + e.translationY;
      if (nx > maxX) nx = maxX;
      if (nx < -maxX) nx = -maxX;
      if (ny > maxY) ny = maxY;
      if (ny < -maxY) ny = -maxY;
      tx.value = nx;
      ty.value = ny;
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      'worklet';
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      'worklet';
      const next = savedScale.value * e.scale;
      scale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
      // Re-clamp pan after scale change so the image still covers the frame.
      const maxX = Math.max(0, (dispW.value * scale.value - CROP_SIZE) / 2);
      const maxY = Math.max(0, (dispH.value * scale.value - CROP_SIZE) / 2);
      if (tx.value > maxX) tx.value = maxX;
      if (tx.value < -maxX) tx.value = -maxX;
      if (ty.value > maxY) ty.value = maxY;
      if (ty.value < -maxY) ty.value = -maxY;
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  const animatedImageSize = useAnimatedStyle(() => ({
    width: dispW.value,
    height: dispH.value,
  }));

  // ─── Actions ──────────────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    _onAvatarEditorDone = null;
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  const handleRotate = useCallback(async () => {
    if (!imageUri || processing) return;
    setProcessing(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ rotate: 90 }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );
      setImageUri(result.uri);
    } catch (err: any) {
      console.error('Rotate error:', err?.message || err);
    } finally {
      setProcessing(false);
    }
  }, [imageUri, processing]);

  const handleFlip = useCallback(async () => {
    if (!imageUri || processing) return;
    setProcessing(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ flip: ImageManipulator.FlipType.Horizontal }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );
      setImageUri(result.uri);
    } catch (err: any) {
      console.error('Flip error:', err?.message || err);
    } finally {
      setProcessing(false);
    }
  }, [imageUri, processing]);

  // Crop button = reset framing (pan/zoom back to defaults). Since cropping
  // is always active, there's nothing to "enter" — this just gives the user
  // a quick way to undo their pan/zoom adjustments.
  const handleCropReset = useCallback(() => {
    if (processing) return;
    resetGestures(true);
  }, [processing, resetGestures]);

  // Crop the portion currently visible in the crop window and upload.
  const handleSend = useCallback(async () => {
    if (!imageUri || processing || !natural) return;
    setProcessing(true);
    try {
      const { width: imgW, height: imgH } = natural;
      const cover = Math.max(CROP_SIZE / imgW, CROP_SIZE / imgH);
      const s = scale.value * cover;
      const txv = tx.value;
      const tyv = ty.value;

      // Container point (px, py) ↔ original image point (ix, iy):
      //   px = CROP_SIZE/2 + txv + (ix - imgW/2) * s
      //   ⇒ ix = (px - CROP_SIZE/2 - txv) / s + imgW/2
      let originX = (0 - CROP_SIZE / 2 - txv) / s + imgW / 2;
      let originY = (0 - CROP_SIZE / 2 - tyv) / s + imgH / 2;
      let cropW = CROP_SIZE / s;
      let cropH = CROP_SIZE / s;

      // Clamp to image bounds so rounding errors can't overflow.
      if (cropW > imgW) cropW = imgW;
      if (cropH > imgH) cropH = imgH;
      if (originX < 0) originX = 0;
      if (originY < 0) originY = 0;
      if (originX + cropW > imgW) originX = imgW - cropW;
      if (originY + cropH > imgH) originY = imgH - cropH;

      const rounded = {
        originX: Math.round(originX),
        originY: Math.round(originY),
        width: Math.round(cropW),
        height: Math.round(cropH),
      };

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ crop: rounded }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );

      const cb = _onAvatarEditorDone;
      _onAvatarEditorDone = null;
      if (cb) cb(result.uri);
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (err: any) {
      console.error('Send error:', err?.message || err);
      Alert.alert('Error', 'Failed to process image');
      setProcessing(false);
    }
  }, [imageUri, processing, natural, scale, tx, ty]);

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header with all editing features */}
      <View style={styles.topBar}>
        <Pressable onPress={handleCancel} hitSlop={12} style={styles.topBarBtn}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </Pressable>
        <View style={styles.topBarRight}>
          <Pressable
            onPress={handleRotate}
            hitSlop={8}
            disabled={processing}
            style={({ pressed }) => [styles.topBarBtn, pressed && styles.topBarBtnPressed]}>
            <Ionicons name="refresh" size={22} color="#fff" />
          </Pressable>
          <Pressable
            onPress={handleFlip}
            hitSlop={8}
            disabled={processing}
            style={({ pressed }) => [styles.topBarBtn, pressed && styles.topBarBtnPressed]}>
            <Ionicons name="swap-horizontal" size={24} color="#fff" />
          </Pressable>
          <Pressable
            onPress={handleCropReset}
            hitSlop={8}
            disabled={processing}
            style={({ pressed }) => [styles.topBarBtn, pressed && styles.topBarBtnPressed]}>
            <Ionicons name="crop" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Always-on crop frame with drag + pinch inside */}
      <View style={styles.body}>
        {natural ? (
          <GestureDetector gesture={composedGesture}>
            <View style={styles.cropWindow}>
              <Animated.View style={[styles.imageWrap, animatedImageStyle]}>
                <Animated.Image
                  source={{ uri: imageUri }}
                  style={animatedImageSize}
                  resizeMode="cover"
                />
              </Animated.View>
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <View style={[styles.gridH, { top: CROP_SIZE / 3 }]} />
                <View style={[styles.gridH, { top: (2 * CROP_SIZE) / 3 }]} />
                <View style={[styles.gridV, { left: CROP_SIZE / 3 }]} />
                <View style={[styles.gridV, { left: (2 * CROP_SIZE) / 3 }]} />
                <View style={styles.gridBorder} />
              </View>
            </View>
          </GestureDetector>
        ) : (
          <View style={styles.cropWindowPlaceholder}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        )}
        <Text style={styles.hint}>Drag to reposition · pinch to zoom</Text>
      </View>

      {/* Upload button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.bottomLabel}>Profile photo</Text>
        <Pressable
          onPress={handleSend}
          disabled={processing || !natural}
          style={({ pressed }) => [
            styles.sendButton,
            (processing || !natural) && { opacity: 0.5 },
            pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Upload profile photo">
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="send" size={22} color="#ffffff" />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Header
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
    gap: 2,
  },
  topBarBtn: {
    padding: 10,
    borderRadius: 22,
  },
  topBarBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Body
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropWindow: {
    width: CROP_SIZE,
    height: CROP_SIZE,
    overflow: 'hidden',
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropWindowPlaceholder: {
    width: CROP_SIZE,
    height: CROP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  gridV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  gridBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  hint: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },

  // Footer
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  bottomLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '500',
  },
  sendButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
});

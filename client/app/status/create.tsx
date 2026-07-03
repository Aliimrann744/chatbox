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
import * as ImageManipulator from 'expo-image-manipulator';

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

  // Crop state
  const [cropMode, setCropMode] = useState(false);
  const [cropRect, setCropRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [cropApplying, setCropApplying] = useState(false);

  // Video trim state
  const [trimMode, setTrimMode] = useState(false);
  const [trimStartMs, setTrimStartMs] = useState(0);
  const [trimEndMs, setTrimEndMs] = useState(0);
  const [videoDurationMs, setVideoDurationMs] = useState(0);

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

  // ─── Crop: displayed-image bounds (image is rendered with resizeMode="contain") ─
  const MEDIA_W = SCREEN_WIDTH;
  const MEDIA_H = SCREEN_HEIGHT * 0.72;
  const MIN_CROP = 80;

  const displayedBoundsRef = useRef({ x: 0, y: 0, width: MEDIA_W, height: MEDIA_H });
  const cropRectRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const cropStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    cropRectRef.current = cropRect;
  }, [cropRect]);

  useEffect(() => {
    if (!media || media.type === 'video' || !media.width || !media.height) return;
    const iw = media.width;
    const ih = media.height;
    const imageRatio = iw / ih;
    const containerRatio = MEDIA_W / MEDIA_H;
    let dw: number;
    let dh: number;
    if (imageRatio > containerRatio) {
      dw = MEDIA_W;
      dh = MEDIA_W / imageRatio;
    } else {
      dh = MEDIA_H;
      dw = MEDIA_H * imageRatio;
    }
    const dx = (MEDIA_W - dw) / 2;
    const dy = (MEDIA_H - dh) / 2;
    displayedBoundsRef.current = { x: dx, y: dy, width: dw, height: dh };
  }, [media, MEDIA_W, MEDIA_H]);

  const enterCropMode = () => {
    if (!media || media.type === 'video') return;
    const b = displayedBoundsRef.current;
    const initial = { x: b.x, y: b.y, width: b.width, height: b.height };
    cropRectRef.current = initial;
    setCropRect(initial);
    setCropMode(true);
  };

  const cancelCrop = () => {
    setCropMode(false);
  };

  const applyCrop = async () => {
    if (!media || media.type === 'video' || !media.width || !media.height) {
      setCropMode(false);
      return;
    }
    const b = displayedBoundsRef.current;
    const c = cropRectRef.current;

    const scaleX = media.width / b.width;
    const scaleY = media.height / b.height;

    let originX = Math.round((c.x - b.x) * scaleX);
    let originY = Math.round((c.y - b.y) * scaleY);
    let width = Math.round(c.width * scaleX);
    let height = Math.round(c.height * scaleY);

    originX = Math.max(0, Math.min(originX, media.width - 1));
    originY = Math.max(0, Math.min(originY, media.height - 1));
    width = Math.max(1, Math.min(width, media.width - originX));
    height = Math.max(1, Math.min(height, media.height - originY));

    if (width >= media.width - 1 && height >= media.height - 1 && originX <= 1 && originY <= 1) {
      setCropMode(false);
      return;
    }

    setCropApplying(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        media.uri,
        [{ crop: { originX, originY, width, height } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
      const fileName = result.uri.split('/').pop() || 'cropped.jpg';
      setMediaList((prev) => {
        const updated = [...prev];
        updated[currentIndex] = {
          ...prev[currentIndex],
          uri: result.uri,
          type: 'image',
          mimeType: 'image/jpeg',
          name: fileName,
          width: result.width,
          height: result.height,
        };
        return updated;
      });
      setDrawPaths([]);
      setHasEdits(true);
    } catch (err) {
      console.error('Crop failed:', err);
      Alert.alert('Error', 'Failed to crop image');
    } finally {
      setCropApplying(false);
      setCropMode(false);
    }
  };

  // Crop handle pan responders — each reads from refs to stay current.
  const makeCornerPan = (corner: 'tl' | 'tr' | 'bl' | 'br') =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        cropStartRef.current = { ...cropRectRef.current };
      },
      onPanResponderMove: (_e, g) => {
        const s = cropStartRef.current;
        const b = displayedBoundsRef.current;
        const left = s.x;
        const top = s.y;
        const right = s.x + s.width;
        const bottom = s.y + s.height;
        let nLeft = left, nTop = top, nRight = right, nBottom = bottom;
        if (corner === 'tl') {
          nLeft = Math.max(b.x, Math.min(left + g.dx, right - MIN_CROP));
          nTop = Math.max(b.y, Math.min(top + g.dy, bottom - MIN_CROP));
        } else if (corner === 'tr') {
          nRight = Math.max(left + MIN_CROP, Math.min(right + g.dx, b.x + b.width));
          nTop = Math.max(b.y, Math.min(top + g.dy, bottom - MIN_CROP));
        } else if (corner === 'bl') {
          nLeft = Math.max(b.x, Math.min(left + g.dx, right - MIN_CROP));
          nBottom = Math.max(top + MIN_CROP, Math.min(bottom + g.dy, b.y + b.height));
        } else {
          nRight = Math.max(left + MIN_CROP, Math.min(right + g.dx, b.x + b.width));
          nBottom = Math.max(top + MIN_CROP, Math.min(bottom + g.dy, b.y + b.height));
        }
        const next = { x: nLeft, y: nTop, width: nRight - nLeft, height: nBottom - nTop };
        cropRectRef.current = next;
        setCropRect(next);
      },
    });

  const cropMovePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        cropStartRef.current = { ...cropRectRef.current };
      },
      onPanResponderMove: (_e, g) => {
        const s = cropStartRef.current;
        const b = displayedBoundsRef.current;
        let nx = s.x + g.dx;
        let ny = s.y + g.dy;
        nx = Math.max(b.x, Math.min(nx, b.x + b.width - s.width));
        ny = Math.max(b.y, Math.min(ny, b.y + b.height - s.height));
        const next = { x: nx, y: ny, width: s.width, height: s.height };
        cropRectRef.current = next;
        setCropRect(next);
      },
    }),
  ).current;

  const cropTLPan = useRef(makeCornerPan('tl')).current;
  const cropTRPan = useRef(makeCornerPan('tr')).current;
  const cropBLPan = useRef(makeCornerPan('bl')).current;
  const cropBRPan = useRef(makeCornerPan('br')).current;

  // ─── Video Trim ─────────────────────────────────────────────────────────────
  const MAX_TRIM_MS = 60_000;
  const MIN_TRIM_MS = 1_000;
  const TRIM_TRACK_WIDTH = SCREEN_WIDTH - 32;

  const videoRef = useRef<Video>(null);
  const trimStartRef = useRef(0);
  const trimEndRef = useRef(0);
  const trimStartSnapshotRef = useRef(0);
  const trimEndSnapshotRef = useRef(0);
  const videoDurationRef = useRef(0);

  useEffect(() => { trimStartRef.current = trimStartMs; }, [trimStartMs]);
  useEffect(() => { trimEndRef.current = trimEndMs; }, [trimEndMs]);
  useEffect(() => { videoDurationRef.current = videoDurationMs; }, [videoDurationMs]);

  // When the current media changes, prepare trim state
  useEffect(() => {
    if (!media || media.type !== 'video') {
      setTrimMode(false);
      setVideoDurationMs(0);
      setTrimStartMs(0);
      setTrimEndMs(0);
      return;
    }
    const knownDuration = media.duration ?? 0;
    // Reset duration so onLoad will resync for a different video
    setVideoDurationMs(knownDuration);
    if (typeof media.trimStartMs === 'number' && typeof media.trimEndMs === 'number') {
      setTrimStartMs(media.trimStartMs);
      setTrimEndMs(media.trimEndMs);
      setTrimMode(false);
    } else if (knownDuration > MAX_TRIM_MS) {
      setTrimStartMs(0);
      setTrimEndMs(MAX_TRIM_MS);
      setTrimMode(true);
    } else {
      setTrimStartMs(0);
      setTrimEndMs(knownDuration);
      setTrimMode(false);
    }
  }, [media, currentIndex]);

  const handleVideoLoad = useCallback((status: any) => {
    const d = status?.durationMillis;
    if (typeof d !== 'number' || d <= 0) return;
    if (videoDurationRef.current > 0) return;
    setVideoDurationMs(d);
    if (media && typeof media.trimEndMs !== 'number') {
      if (d > MAX_TRIM_MS) {
        setTrimStartMs(0);
        setTrimEndMs(MAX_TRIM_MS);
        setTrimMode(true);
      } else {
        setTrimStartMs(0);
        setTrimEndMs(d);
      }
    }
  }, [media]);

  const handleVideoPlaybackStatus = useCallback((status: any) => {
    if (!status?.isLoaded || !trimMode) return;
    if (typeof status.positionMillis === 'number' && status.positionMillis >= trimEndRef.current) {
      videoRef.current?.setPositionAsync(trimStartRef.current).catch(() => {});
    }
  }, [trimMode]);

  const trimLeftPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        trimStartSnapshotRef.current = trimStartRef.current;
      },
      onPanResponderMove: (_e, g) => {
        const duration = videoDurationRef.current;
        if (duration <= 0) return;
        const dxMs = (g.dx / TRIM_TRACK_WIDTH) * duration;
        let next = trimStartSnapshotRef.current + dxMs;
        next = Math.max(0, next);
        next = Math.min(next, trimEndRef.current - MIN_TRIM_MS);
        next = Math.max(next, trimEndRef.current - MAX_TRIM_MS);
        trimStartRef.current = next;
        setTrimStartMs(next);
      },
      onPanResponderRelease: () => {
        videoRef.current?.setPositionAsync(trimStartRef.current).catch(() => {});
      },
    }),
  ).current;

  const trimRightPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        trimEndSnapshotRef.current = trimEndRef.current;
      },
      onPanResponderMove: (_e, g) => {
        const duration = videoDurationRef.current;
        if (duration <= 0) return;
        const dxMs = (g.dx / TRIM_TRACK_WIDTH) * duration;
        let next = trimEndSnapshotRef.current + dxMs;
        next = Math.min(duration, next);
        next = Math.max(next, trimStartRef.current + MIN_TRIM_MS);
        next = Math.min(next, trimStartRef.current + MAX_TRIM_MS);
        trimEndRef.current = next;
        setTrimEndMs(next);
      },
      onPanResponderRelease: () => {
        videoRef.current?.setPositionAsync(trimStartRef.current).catch(() => {});
      },
    }),
  ).current;

  const applyTrim = () => {
    if (!media || media.type !== 'video') return;
    setMediaList((prev) => {
      const updated = [...prev];
      updated[currentIndex] = {
        ...prev[currentIndex],
        trimStartMs: Math.round(trimStartRef.current),
        trimEndMs: Math.round(trimEndRef.current),
        duration: Math.round(trimEndRef.current - trimStartRef.current),
      };
      return updated;
    });
    setTrimMode(false);
    setHasEdits(true);
  };

  const cancelTrim = () => {
    if (videoDurationRef.current > MAX_TRIM_MS && typeof media?.trimEndMs !== 'number') {
      Alert.alert(
        'Trim required',
        'This video is longer than 60 seconds. Select a 60-second portion to share, or pick a different video.',
        [
          { text: 'Pick another', onPress: handleReselect },
          { text: 'Continue trimming', style: 'cancel' },
        ],
      );
      return;
    }
    setTrimMode(false);
  };

  const formatTrimTime = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
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

    const needsTrimIdx = mediaList.findIndex(
      (m) =>
        m.type === 'video' &&
        (m.duration ?? 0) > MAX_TRIM_MS &&
        typeof m.trimEndMs !== 'number',
    );
    if (needsTrimIdx >= 0) {
      setCurrentIndex(needsTrimIdx);
      Alert.alert(
        'Trim required',
        'One or more videos are longer than 60 seconds. Please trim them before sending.',
      );
      return;
    }

    setUploading(true);

    try {
      for (let i = 0; i < mediaList.length; i++) {
        const item = mediaList[i];
        setProgress(`Uploading ${i + 1} of ${mediaList.length}...`);
        const uploaded = await uploadApi.uploadFile(
          { uri: item.uri, type: item.mimeType, name: item.name },
          'status',
        );

        const hasTrim =
          item.type === 'video' &&
          typeof item.trimStartMs === 'number' &&
          typeof item.trimEndMs === 'number';

        await statusApi.createStatus({
          type: item.type === 'video' ? 'VIDEO' : 'IMAGE',
          mediaUrl: uploaded.url,
          caption: i === 0 ? (caption || undefined) : undefined,
          ...(hasTrim && {
            trimStartMs: item.trimStartMs,
            trimEndMs: item.trimEndMs,
          }),
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
      {!cropMode && !trimMode && (
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={handleClose} style={styles.headerIconBtn}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }} />
          {media.type === 'image' && (
            <>
              <Pressable onPress={enterCropMode} style={styles.headerIconBtn}>
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
      )}

      {/* ─── Media Preview ─── */}
      <View style={styles.mediaArea} {...(isDrawing ? panResponder.panHandlers : {})}>
        <View style={styles.mediaContent}>
          {media.type === 'video' ? (
            <Video
              ref={videoRef}
              source={{ uri: media.uri }}
              style={styles.mediaFull}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={trimMode}
              isLooping={false}
              onLoad={handleVideoLoad}
              onPlaybackStatusUpdate={handleVideoPlaybackStatus}
              progressUpdateIntervalMillis={200}
            />
          ) : (
            <Image source={{ uri: media.uri }} style={styles.mediaFull} resizeMode="contain" />
          )}

          {/* Drawing overlay — inside mediaContent so strokes are clipped to the image box */}
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

          {/* ─── Crop Overlay ─── */}
          {cropMode && media.type === 'image' && cropRect.width > 0 && (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              {/* dim regions outside crop */}
              <View style={[styles.cropDim, { left: 0, top: 0, right: 0, height: cropRect.y }]} pointerEvents="none" />
              <View style={[styles.cropDim, { left: 0, top: cropRect.y + cropRect.height, right: 0, bottom: 0 }]} pointerEvents="none" />
              <View style={[styles.cropDim, { left: 0, top: cropRect.y, width: cropRect.x, height: cropRect.height }]} pointerEvents="none" />
              <View style={[styles.cropDim, { left: cropRect.x + cropRect.width, top: cropRect.y, right: 0, height: cropRect.height }]} pointerEvents="none" />

              {/* crop frame */}
              <View
                style={[
                  styles.cropFrame,
                  { left: cropRect.x, top: cropRect.y, width: cropRect.width, height: cropRect.height },
                ]}
                pointerEvents="box-none"
              >
                {/* draggable interior */}
                <View {...cropMovePan.panHandlers} style={StyleSheet.absoluteFill} />

                {/* grid lines */}
                <View style={[styles.cropGridLineH, { top: '33.33%' }]} pointerEvents="none" />
                <View style={[styles.cropGridLineH, { top: '66.66%' }]} pointerEvents="none" />
                <View style={[styles.cropGridLineV, { left: '33.33%' }]} pointerEvents="none" />
                <View style={[styles.cropGridLineV, { left: '66.66%' }]} pointerEvents="none" />

                {/* corner handles */}
                <View {...cropTLPan.panHandlers} style={[styles.cropHandle, styles.cropHandleTL]} />
                <View {...cropTRPan.panHandlers} style={[styles.cropHandle, styles.cropHandleTR]} />
                <View {...cropBLPan.panHandlers} style={[styles.cropHandle, styles.cropHandleBL]} />
                <View {...cropBRPan.panHandlers} style={[styles.cropHandle, styles.cropHandleBR]} />
              </View>
            </View>
          )}
        </View>

        {/* Multi-media counter */}
        {mediaList.length > 1 && !cropMode && !trimMode && (
          <View style={styles.mediaCounter}>
            <Text style={styles.mediaCounterText}>{currentIndex + 1} / {mediaList.length}</Text>
          </View>
        )}

        {/* Multi-media navigation */}
        {mediaList.length > 1 && currentIndex > 0 && !cropMode && !trimMode && (
          <Pressable onPress={() => setCurrentIndex(i => i - 1)} style={[styles.mediaNavBtn, styles.mediaNavBtnLeft]}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </Pressable>
        )}
        {mediaList.length > 1 && currentIndex < mediaList.length - 1 && !cropMode && !trimMode && (
          <Pressable onPress={() => setCurrentIndex(i => i + 1)} style={[styles.mediaNavBtn, styles.mediaNavBtnRight]}>
            <Ionicons name="chevron-forward" size={28} color="#fff" />
          </Pressable>
        )}
      </View>

      {/* ─── Draw Color Picker ─── */}
      {isDrawing && !cropMode && !trimMode && (
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

      {/* ─── Crop Footer ─── */}
      {cropMode && (
        <View style={[styles.cropFooter, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={cancelCrop} disabled={cropApplying} style={styles.cropFooterBtn}>
            <Text style={styles.cropFooterCancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.cropFooterTitle}>Crop</Text>
          <Pressable onPress={applyCrop} disabled={cropApplying} style={styles.cropFooterBtn}>
            {cropApplying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.cropFooterDone}>Done</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* ─── Video Trim Footer ─── */}
      {trimMode && media.type === 'video' && videoDurationMs > 0 && (
        <View style={[styles.trimContainer, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.trimInfoRow}>
            <Text style={styles.trimInfoText}>{formatTrimTime(trimStartMs)}</Text>
            <Text style={styles.trimInfoText}>
              {formatTrimTime(trimEndMs - trimStartMs)} selected
            </Text>
            <Text style={styles.trimInfoText}>{formatTrimTime(trimEndMs)}</Text>
          </View>

          <View style={[styles.trimTrack, { width: TRIM_TRACK_WIDTH }]}>
            <View
              style={[
                styles.trimWindow,
                {
                  left: (trimStartMs / videoDurationMs) * TRIM_TRACK_WIDTH,
                  width: ((trimEndMs - trimStartMs) / videoDurationMs) * TRIM_TRACK_WIDTH,
                },
              ]}
              pointerEvents="box-none"
            >
              <View {...trimLeftPan.panHandlers} style={styles.trimHandleLeft}>
                <View style={styles.trimHandleBar} />
              </View>
              <View {...trimRightPan.panHandlers} style={styles.trimHandleRight}>
                <View style={styles.trimHandleBar} />
              </View>
            </View>
          </View>

          <View style={styles.trimFooter}>
            <Pressable onPress={cancelTrim} style={styles.cropFooterBtn}>
              <Text style={styles.cropFooterCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.cropFooterTitle}>Trim</Text>
            <Pressable onPress={applyTrim} style={styles.cropFooterBtn}>
              <Text style={styles.cropFooterDone}>Done</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ─── Bottom Caption Bar ─── */}
      {!isDrawing && !cropMode && !trimMode && (
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
  mediaContent: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.72,
    position: 'relative',
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

  // Crop
  cropDim: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  cropFrame: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  cropGridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  cropGridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  cropHandle: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.001)',
  },
  cropHandleTL: {
    left: -14,
    top: -14,
    borderLeftWidth: 3,
    borderTopWidth: 3,
  },
  cropHandleTR: {
    right: -14,
    top: -14,
    borderRightWidth: 3,
    borderTopWidth: 3,
  },
  cropHandleBL: {
    left: -14,
    bottom: -14,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
  },
  cropHandleBR: {
    right: -14,
    bottom: -14,
    borderRightWidth: 3,
    borderBottomWidth: 3,
  },
  cropFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  cropFooterBtn: {
    minWidth: 60,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropFooterTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  cropFooterCancel: {
    color: '#fff',
    fontSize: 16,
  },
  cropFooterDone: {
    color: '#34C759',
    fontSize: 16,
    fontWeight: '700',
  },

  // Video trim
  trimContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  trimInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  trimInfoText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  trimTrack: {
    height: 56,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'visible',
  },
  trimWindow: {
    position: 'absolute',
    top: -2,
    bottom: -2,
    borderWidth: 3,
    borderColor: '#FFD60A',
    backgroundColor: 'rgba(255,214,10,0.12)',
    borderRadius: 6,
  },
  trimHandleLeft: {
    position: 'absolute',
    left: -14,
    top: -8,
    bottom: -8,
    width: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trimHandleRight: {
    position: 'absolute',
    right: -14,
    top: -8,
    bottom: -8,
    width: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trimHandleBar: {
    width: 4,
    height: '70%',
    backgroundColor: '#FFD60A',
    borderRadius: 2,
  },
  trimFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
});

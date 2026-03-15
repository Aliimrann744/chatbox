import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '@/components/ui/avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { statusApi, Status, StatusViewInfo } from '@/services/api';
import { useAuth } from '@/contexts/auth-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STATUS_DURATION = 5000;

export default function StatusViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    userId: string;
    statuses: string;
    allGroups?: string;
    groupIndex?: string;
  }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();

  const [statusList, setStatusList] = useState<Status[]>([]);
  const [allGroups, setAllGroups] = useState<{ userId: string; statuses: Status[] }[]>([]);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [viewers, setViewers] = useState<StatusViewInfo[]>([]);
  const [showViewers, setShowViewers] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef(0);
  const isPausedRef = useRef(false);

  const isOwnStatus = params.userId === currentUser?.id;

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    try {
      const parsed: Status[] = JSON.parse(params.statuses || '[]');
      setStatusList(parsed);

      if (params.allGroups) {
        const groups = JSON.parse(params.allGroups);
        setAllGroups(groups);
        setCurrentGroupIndex(parseInt(params.groupIndex || '0', 10));
      }
    } catch {
      router.back();
    }
  }, []);

  const currentStatus = statusList[currentIndex];

  // Mark as viewed
  useEffect(() => {
    if (!currentStatus) return;
    statusApi.viewStatus(currentStatus.id).catch(() => {});
  }, [currentStatus?.id]);

  // Load viewers for own statuses
  useEffect(() => {
    if (isOwnStatus && currentStatus?.views) {
      setViewers(currentStatus.views);
    }
  }, [currentStatus]);

  const goNext = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (currentIndex < statusList.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else if (allGroups.length > 0 && currentGroupIndex < allGroups.length - 1) {
      const nextGroupIdx = currentGroupIndex + 1;
      setCurrentGroupIndex(nextGroupIdx);
      setStatusList(allGroups[nextGroupIdx].statuses);
      setCurrentIndex(0);
    } else {
      router.back();
    }
  }, [currentIndex, statusList.length, allGroups, currentGroupIndex]);

  const goPrev = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else if (allGroups.length > 0 && currentGroupIndex > 0) {
      const prevGroupIdx = currentGroupIndex - 1;
      setCurrentGroupIndex(prevGroupIdx);
      const prevStatuses = allGroups[prevGroupIdx].statuses;
      setStatusList(prevStatuses);
      setCurrentIndex(prevStatuses.length - 1);
    }
  }, [currentIndex, allGroups, currentGroupIndex]);

  // Progress timer
  useEffect(() => {
    if (statusList.length === 0 || !currentStatus) return;

    if (timerRef.current) clearInterval(timerRef.current);
    progressRef.current = 0;
    setProgress(0);

    const isVideo = currentStatus.type === 'VIDEO';
    const duration = isVideo ? 10000 : STATUS_DURATION;
    const interval = 50;

    timerRef.current = setInterval(() => {
      if (isPausedRef.current) return;
      progressRef.current += interval / duration;
      setProgress(progressRef.current);

      if (progressRef.current >= 1) {
        goNext();
      }
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, statusList, currentStatus, goNext]);

  const handlePress = (e: any) => {
    if (showViewers) {
      setShowViewers(false);
      return;
    }
    const x = e.nativeEvent.locationX;
    if (x < SCREEN_WIDTH / 3) {
      goPrev();
    } else {
      goNext();
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const canGoPrev = currentIndex > 0 || (allGroups.length > 0 && currentGroupIndex > 0);
  const canGoNext = currentIndex < statusList.length - 1 || (allGroups.length > 0 && currentGroupIndex < allGroups.length - 1);

  if (!currentStatus) {
    return (
      <View style={[styles.container, { backgroundColor: '#000' }]}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      {/* Tap Zone */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handlePress}
        onLongPress={() => setIsPaused(true)}
        onPressOut={() => setIsPaused(false)}
      >
        {/* Media */}
        {currentStatus.type === 'VIDEO' ? (
          <Video
            source={{ uri: currentStatus.mediaUrl }}
            style={styles.media}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={!isPaused}
            isLooping={false}
          />
        ) : (
          <Image
            source={{ uri: currentStatus.mediaUrl }}
            style={styles.media}
            resizeMode="contain"
          />
        )}
      </Pressable>

      {/* Progress Bars */}
      <View style={[styles.progressContainer, { paddingTop: insets.top + 4 }]}>
        {statusList.map((_, i) => (
          <View key={i} style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width:
                    i < currentIndex
                      ? '100%'
                      : i === currentIndex
                        ? `${Math.min(progress * 100, 100)}%`
                        : '0%',
                },
              ]}
            />
          </View>
        ))}
      </View>

      {/* Header */}
      <View style={[styles.header, { top: insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="arrow.left" size={24} color="#fff" />
        </Pressable>
        {currentStatus.user?.avatar ? (
          <Avatar uri={currentStatus.user.avatar} size={36} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarInitial}>
              {currentStatus.user?.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{currentStatus.user?.name || 'Unknown'}</Text>
          <Text style={styles.headerTime}>{formatTimeAgo(currentStatus.createdAt)}</Text>
        </View>
      </View>

      {/* Left/Right Arrow Navigation */}
      {canGoPrev && !showViewers && (
        <Pressable style={[styles.navArrow, styles.navArrowLeft]} onPress={goPrev}>
          <Ionicons name="chevron-back" size={28} color="rgba(255,255,255,0.8)" />
        </Pressable>
      )}
      {canGoNext && !showViewers && (
        <Pressable style={[styles.navArrow, styles.navArrowRight]} onPress={goNext}>
          <Ionicons name="chevron-forward" size={28} color="rgba(255,255,255,0.8)" />
        </Pressable>
      )}

      {/* Bottom Area: Caption + View Count */}
      {!showViewers && (
        <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 12 }]}>
          {/* Caption */}
          {currentStatus.caption ? (
            <View style={styles.captionContainer}>
              <Text style={styles.captionText}>{currentStatus.caption}</Text>
            </View>
          ) : null}

          {/* View count for own statuses */}
          {isOwnStatus && (
            <Pressable style={styles.viewCountRow} onPress={() => setShowViewers(true)}>
              <Ionicons name="eye-outline" size={18} color="rgba(255,255,255,0.8)" />
              <Text style={styles.viewCountText}>
                {currentStatus.viewCount || 0} view{currentStatus.viewCount !== 1 ? 's' : ''}
              </Text>
              <Ionicons name="chevron-up" size={16} color="rgba(255,255,255,0.6)" />
            </Pressable>
          )}
        </View>
      )}

      {/* Viewers List (own statuses only) */}
      {showViewers && isOwnStatus && (
        <View style={[styles.viewersList, { paddingBottom: insets.bottom }]}>
          <View style={styles.viewersHeader}>
            <View style={styles.viewersHeaderLeft}>
              <Ionicons name="eye-outline" size={18} color="#fff" />
              <Text style={styles.viewersTitle}>
                {currentStatus.viewCount || 0} view{currentStatus.viewCount !== 1 ? 's' : ''}
              </Text>
            </View>
            <Pressable onPress={() => setShowViewers(false)} style={styles.viewersCloseBtn}>
              <Ionicons name="chevron-down" size={22} color="#fff" />
            </Pressable>
          </View>
          <FlatList
            data={viewers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.viewerRow}>
                {item.viewer?.avatar ? (
                  <Avatar uri={item.viewer.avatar} size={40} />
                ) : (
                  <View style={[styles.viewerAvatar, { backgroundColor: colors.primary }]}>
                    <Text style={styles.viewerInitial}>
                      {item.viewer?.name?.charAt(0)?.toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
                <View style={styles.viewerInfo}>
                  <Text style={styles.viewerName}>{item.viewer?.name}</Text>
                  <Text style={styles.viewerTime}>{formatTimeAgo(item.viewedAt)}</Text>
                </View>
              </View>
            )}
            style={styles.viewersScroll}
            ListEmptyComponent={
              <View style={styles.emptyViewers}>
                <Text style={styles.emptyViewersText}>No views yet</Text>
              </View>
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  media: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },

  // Progress bars
  progressContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    paddingHorizontal: 8,
    gap: 3,
  },
  progressTrack: {
    flex: 1,
    height: 2.5,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },

  // Header
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  backButton: {
    padding: 8,
    marginRight: 4,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerInfo: {
    marginLeft: 10,
    flex: 1,
  },
  headerName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  headerTime: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 1,
  },

  // Navigation arrows
  navArrow: {
    position: 'absolute',
    top: '45%',
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navArrowLeft: {
    left: 8,
  },
  navArrowRight: {
    right: 8,
  },

  // Bottom area (caption + view count)
  bottomArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  captionContainer: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  captionText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  viewCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    gap: 6,
  },
  viewCountText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
  },

  // Viewers list
  viewersList: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SCREEN_HEIGHT * 0.5,
    backgroundColor: 'rgba(30,30,30,0.95)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    zIndex: 20,
  },
  viewersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  viewersHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewersTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  viewersCloseBtn: {
    padding: 4,
  },
  viewersScroll: {
    maxHeight: SCREEN_HEIGHT * 0.35,
  },
  viewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  viewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  viewerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  viewerName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  viewerTime: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  emptyViewers: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyViewersText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
});

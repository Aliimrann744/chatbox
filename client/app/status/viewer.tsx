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

import { Avatar } from '@/components/ui/avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { statusApi, Status, StatusViewInfo } from '@/services/api';
import { useAuth } from '@/contexts/auth-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STATUS_DURATION = 5000; // 5s for images

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

  const isOwnStatus = params.userId === currentUser?.id;

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

  // Progress timer
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    progressRef.current = 0;
    setProgress(0);

    const isVideo = currentStatus?.type === 'VIDEO';
    const duration = isVideo ? 10000 : STATUS_DURATION;
    const interval = 50;

    timerRef.current = setInterval(() => {
      if (isPaused) return;
      progressRef.current += interval / duration;
      setProgress(progressRef.current);

      if (progressRef.current >= 1) {
        goNext();
      }
    }, interval);
  }, [currentIndex, statusList, isPaused, currentGroupIndex, allGroups]);

  useEffect(() => {
    if (statusList.length > 0) {
      startTimer();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, statusList, startTimer]);

  const goNext = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (currentIndex < statusList.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else if (allGroups.length > 0 && currentGroupIndex < allGroups.length - 1) {
      // Move to next user's statuses
      const nextGroupIdx = currentGroupIndex + 1;
      setCurrentGroupIndex(nextGroupIdx);
      setStatusList(allGroups[nextGroupIdx].statuses);
      setCurrentIndex(0);
    } else {
      router.back();
    }
  };

  const goPrev = () => {
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
  };

  const handlePress = (e: any) => {
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

  if (!currentStatus) {
    return (
      <View style={[styles.container, { backgroundColor: '#000' }]}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      {/* Tap Zones */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handlePress}
        onLongPress={() => setIsPaused(true)}
        onPressOut={() => setIsPaused(false)}>
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

      {/* Caption */}
      {currentStatus.caption ? (
        <View style={[styles.captionContainer, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.captionText}>{currentStatus.caption}</Text>
        </View>
      ) : null}

      {/* View Count (own statuses) */}
      {isOwnStatus && (
        <Pressable
          style={[styles.viewCountBar, { paddingBottom: insets.bottom + 16 }]}
          onPress={() => setShowViewers(!showViewers)}>
          <IconSymbol name="person.fill" size={18} color="#fff" />
          <Text style={styles.viewCountText}>
            {currentStatus.viewCount || 0} view{currentStatus.viewCount !== 1 ? 's' : ''}
          </Text>
        </Pressable>
      )}

      {/* Viewers List */}
      {showViewers && isOwnStatus && (
        <View style={[styles.viewersList, { paddingBottom: insets.bottom }]}>
          <View style={styles.viewersHeader}>
            <Text style={styles.viewersTitle}>Viewed by</Text>
            <Pressable onPress={() => setShowViewers(false)}>
              <IconSymbol name="xmark" size={22} color="#fff" />
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
  captionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  captionText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  viewCountBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    gap: 6,
  },
  viewCountText: {
    color: '#fff',
    fontSize: 14,
  },
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
  viewersTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
});

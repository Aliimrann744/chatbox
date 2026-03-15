import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export interface PlaybackState {
  isLoading: boolean;
  isPlaying: boolean;
  position: number;
  duration: number;
}

export interface AudioPlayerResult {
  playback: PlaybackState;
  play: (uri: string) => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (position: number) => Promise<void>;
}

// Simple in-memory map of remote URI → local cached path
const localCacheMap = new Map<string, string>();

async function getCachedUri(uri: string): Promise<string> {
  // Local files don't need caching
  if (!uri.startsWith('http')) return uri;

  // File caching only works on native
  if (Platform.OS === 'web') return uri;

  // Already resolved this session
  if (localCacheMap.has(uri)) return localCacheMap.get(uri)!;

  try {
    const cacheDir = `${(FileSystem as any).cacheDirectory}voice_cache/`;
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
    }

    // Create a stable filename from the URL
    const hash = uri.split('/').pop() || `audio_${Date.now()}`;
    const localPath = `${cacheDir}${hash}`;

    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      localCacheMap.set(uri, localPath);
      return localPath;
    }

    // Download in background — return remote URI for now, cache for next play
    FileSystem.downloadAsync(uri, localPath)
      .then(() => {
        localCacheMap.set(uri, localPath);
      })
      .catch(() => {
        // Silent fail — will use remote URI
      });

    return uri;
  } catch {
    return uri;
  }
}

export function useAudioPlayer(): AudioPlayerResult {
  const [playback, setPlayback] = useState<PlaybackState>({
    isLoading: false,
    isPlaying: false,
    position: 0,
    duration: 0,
  });

  const soundRef = useRef<Audio.Sound | null>(null);
  const currentUriRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const onPlaybackStatusUpdate = useCallback((status: any) => {
    if (status.isLoaded) {
      setPlayback({
        isLoading: false,
        isPlaying: status.isPlaying,
        position: status.positionMillis || 0,
        duration: status.durationMillis || 0,
      });

      // Auto stop when finished
      if (status.didJustFinish) {
        setPlayback((prev) => ({
          ...prev,
          isPlaying: false,
          position: 0,
        }));
      }
    }
  }, []);

  const play = useCallback(async (uri: string) => {
    try {
      // If playing a different audio, unload the current one
      if (currentUriRef.current !== uri && soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Load new audio if needed
      if (!soundRef.current || currentUriRef.current !== uri) {
        setPlayback((prev) => ({ ...prev, isLoading: true }));

        // Try cached local file first
        const resolvedUri = await getCachedUri(uri);

        const { sound } = await Audio.Sound.createAsync(
          { uri: resolvedUri, overrideFileExtensionAndroid: 'mp4' },
          { shouldPlay: true, progressUpdateIntervalMillis: 100 },
          onPlaybackStatusUpdate,
          false
        );

        soundRef.current = sound;
        currentUriRef.current = uri;
      } else {
        // Resume existing audio
        await soundRef.current.playAsync();
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setPlayback((prev) => ({ ...prev, isLoading: false }));
    }
  }, [onPlaybackStatusUpdate]);

  const pause = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.pauseAsync();
      }
    } catch (error) {
      console.error('Error pausing audio:', error);
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.setPositionAsync(0);
      }
    } catch (error) {
      console.error('Error stopping audio:', error);
    }
  }, []);

  const seek = useCallback(async (position: number) => {
    try {
      if (soundRef.current) {
        await soundRef.current.setPositionAsync(position);
      }
    } catch (error) {
      console.error('Error seeking audio:', error);
    }
  }, []);

  return {
    playback,
    play,
    pause,
    stop,
    seek,
  };
}

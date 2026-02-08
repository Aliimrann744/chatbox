import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';

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

        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
          onPlaybackStatusUpdate
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

import React, { useState, useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAudioPlayer } from '@/hooks/use-audio-player';

interface AudioPlayerProps {
  uri: string;
  duration?: number;
  isOwnMessage?: boolean;
}

export function AudioPlayer({ uri, duration = 0, isOwnMessage = false }: AudioPlayerProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { playback, play, pause, stop } = useAudioPlayer();

  const [currentUri, setCurrentUri] = useState<string | null>(null);

  // Track if this player is the one playing
  const isThisPlaying = currentUri === uri && playback.isPlaying;
  const isThisLoading = currentUri === uri && playback.isLoading;

  const handlePlayPause = async () => {
    if (isThisPlaying) {
      await pause();
    } else {
      setCurrentUri(uri);
      await play(uri);
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const displayDuration = isThisPlaying ? playback.position : duration;
  const totalDuration = playback.duration > 0 ? playback.duration : duration;
  const progress = totalDuration > 0 ? (displayDuration / totalDuration) * 100 : 0;

  const buttonColor = isOwnMessage ? '#ffffff' : colors.primary;
  const textColor = isOwnMessage ? '#ffffff' : colors.text;
  const waveColor = isOwnMessage ? 'rgba(255,255,255,0.5)' : colors.textSecondary;
  const progressColor = isOwnMessage ? '#ffffff' : colors.primary;

  return (
    <View style={styles.container}>
      {/* Play/Pause button */}
      <Pressable
        onPress={handlePlayPause}
        disabled={isThisLoading}
        style={({ pressed }) => [
          styles.playButton,
          {
            backgroundColor: isOwnMessage
              ? 'rgba(255,255,255,0.2)'
              : colors.primary + '20',
          },
          pressed && styles.buttonPressed,
        ]}>
        {isThisLoading ? (
          <View style={[styles.loadingDot, { backgroundColor: buttonColor }]} />
        ) : (
          <IconSymbol name={isThisPlaying ? 'pause.fill' : 'play.fill'} size={26} color={buttonColor} />
        )}
      </Pressable>

      {/* Waveform / Progress */}
      <View style={styles.waveformContainer}>
        <View style={styles.waveform}>
          {/* Simplified waveform bars */}
          {[...Array(20)].map((_, i) => {
            const height = Math.random() * 16 + 4;
            const isActive = (i / 20) * 100 <= progress;
            return (
              <View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    height,
                    backgroundColor: isActive ? progressColor : waveColor,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Duration */}
        <Text style={[styles.duration, { color: textColor }]}>
          {formatDuration(displayDuration)}
        </Text>
      </View>
    </View>
  );
}

// Simple audio message preview for chat list
interface AudioPreviewProps {
  duration?: number;
}

export function AudioPreview({ duration = 0 }: AudioPreviewProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.previewContainer}>
      <IconSymbol name="mic.fill" size={14} color={colors.primary} />
      <Text style={[styles.previewText, { color: colors.textSecondary }]}>
        {formatDuration(duration)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 200,
    maxWidth: 280,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  waveformContainer: {
    flex: 1,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    marginBottom: 4,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
    marginHorizontal: 1,
  },
  duration: {
    fontSize: 11,
  },
  // Preview styles
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewText: {
    fontSize: 14,
  },
});

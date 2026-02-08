import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';

interface VoiceRecorderProps {
  onSend: (uri: string, duration: number) => void;
  onCancel: () => void;
}

export function VoiceRecorder({ onSend, onCancel }: VoiceRecorderProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const {
    recording,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceRecorder();

  // Start recording when component mounts
  useEffect(() => {
    startRecording();
  }, [startRecording]);

  // Pulse animation for recording indicator
  useEffect(() => {
    if (recording.isRecording && !recording.isPaused) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [recording.isRecording, recording.isPaused, pulseAnim]);

  const handleSend = async () => {
    const result = await stopRecording();
    if (result && result.uri) {
      onSend(result.uri, result.duration);
    } else {
      onCancel();
    }
  };

  const handleCancel = async () => {
    await cancelRecording();
    onCancel();
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Cancel button */}
      <Pressable
        onPress={handleCancel}
        style={({ pressed }) => [
          styles.cancelButton,
          pressed && styles.buttonPressed,
        ]}>
        <IconSymbol name="xmark" size={24} color={colors.error} />
      </Pressable>

      {/* Recording indicator and duration */}
      <View style={styles.recordingInfo}>
        <Animated.View
          style={[
            styles.recordingDot,
            { transform: [{ scale: pulseAnim }] },
          ]}
        />
        <Text style={[styles.duration, { color: colors.text }]}>
          {formatDuration(recording.duration)}
        </Text>
        <Text style={[styles.slideText, { color: colors.textSecondary }]}>
          Recording...
        </Text>
      </View>

      {/* Send button */}
      <Pressable
        onPress={handleSend}
        style={({ pressed }) => [
          styles.sendButton,
          { backgroundColor: colors.primary },
          pressed && styles.buttonPressed,
        ]}>
        <IconSymbol name="arrow.up" size={20} color="#ffffff" />
      </Pressable>
    </View>
  );
}

// Inline voice recorder that appears in the input area
interface InlineVoiceRecorderProps {
  isRecording: boolean;
  duration: number;
  onStop: () => void;
  onCancel: () => void;
}

export function InlineVoiceRecorder({
  isRecording,
  duration,
  onStop,
  onCancel,
}: InlineVoiceRecorderProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isRecording, pulseAnim]);

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.inlineContainer}>
      {/* Cancel button */}
      <Pressable onPress={onCancel} style={styles.inlineCancelButton}>
        <IconSymbol name="trash.fill" size={20} color={colors.error} />
      </Pressable>

      {/* Recording info */}
      <View style={styles.inlineRecordingInfo}>
        <Animated.View
          style={[
            styles.recordingDot,
            { transform: [{ scale: pulseAnim }] },
          ]}
        />
        <Text style={[styles.inlineDuration, { color: colors.text }]}>
          {formatDuration(duration)}
        </Text>
      </View>

      {/* Stop/Send button */}
      <Pressable
        onPress={onStop}
        style={[styles.inlineSendButton, { backgroundColor: colors.primary }]}>
        <IconSymbol name="stop.fill" size={16} color="#ffffff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    padding: 8,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  recordingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F44336',
    marginRight: 12,
  },
  duration: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 12,
  },
  slideText: {
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Inline styles
  inlineContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineCancelButton: {
    padding: 8,
    marginRight: 8,
  },
  inlineRecordingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineDuration: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  inlineSendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

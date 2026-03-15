import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import { Alert, Platform } from 'react-native';

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  uri: string | null;
}

export interface VoiceRecorderResult {
  recording: RecordingState;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<{ uri: string; duration: number } | null>;
  cancelRecording: () => Promise<void>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
}

export function useVoiceRecorder(): VoiceRecorderResult {
  const [recording, setRecording] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    uri: null,
  });

  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Microphone permission is required to record voice messages.',
          [{ text: 'OK' }]
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error requesting audio permission:', error);
      return false;
    }
  };

  const startRecording = useCallback(async () => {
    try {
      const hasPermission = await requestPermission();
      if (!hasPermission) return;

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Create and prepare recording
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = newRecording;

      // Start duration timer
      const startTime = Date.now();
      durationIntervalRef.current = setInterval(() => {
        setRecording((prev) => ({
          ...prev,
          duration: Date.now() - startTime,
        }));
      }, 100);

      setRecording({
        isRecording: true,
        isPaused: false,
        duration: 0,
        uri: null,
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<{ uri: string; duration: number } | null> => {
    try {
      if (!recordingRef.current) return null;

      // Stop duration timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // Stop recording
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      const status = await recordingRef.current.getStatusAsync();

      recordingRef.current = null;

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const duration = recording.duration;

      setRecording({
        isRecording: false,
        isPaused: false,
        duration: 0,
        uri: null,
      });

      if (uri) {
        return { uri, duration };
      }
      return null;
    } catch (error) {
      console.error('Error stopping recording:', error);
      return null;
    }
  }, [recording.duration]);

  const cancelRecording = useCallback(async () => {
    try {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      setRecording({
        isRecording: false,
        isPaused: false,
        duration: 0,
        uri: null,
      });
    } catch (error) {
      console.error('Error canceling recording:', error);
    }
  }, []);

  const pauseRecording = useCallback(async () => {
    try {
      if (!recordingRef.current) return;

      await recordingRef.current.pauseAsync();

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      setRecording((prev) => ({
        ...prev,
        isPaused: true,
      }));
    } catch (error) {
      console.error('Error pausing recording:', error);
    }
  }, []);

  const resumeRecording = useCallback(async () => {
    try {
      if (!recordingRef.current) return;

      await recordingRef.current.startAsync();

      // Resume duration timer
      const currentDuration = recording.duration;
      const resumeTime = Date.now();
      durationIntervalRef.current = setInterval(() => {
        setRecording((prev) => ({
          ...prev,
          duration: currentDuration + (Date.now() - resumeTime),
        }));
      }, 100);

      setRecording((prev) => ({
        ...prev,
        isPaused: false,
      }));
    } catch (error) {
      console.error('Error resuming recording:', error);
    }
  }, [recording.duration]);

  return {
    recording,
    startRecording,
    stopRecording,
    cancelRecording,
    pauseRecording,
    resumeRecording,
  };
}

import React, { useEffect, useState, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { RTCView } from '@/utils/webrtc';

import { Avatar } from '@/components/ui/avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useCall } from '@/contexts/call-context';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function ActiveCallScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { callState, endCall, toggleMute, toggleSpeaker, toggleVideo, switchCamera, localStream, remoteStream } = useCall();

  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Update call duration
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (callState.status === 'connected' && callState.startTime) {
      interval = setInterval(() => {
        const now = new Date();
        const diff = Math.floor((now.getTime() - callState.startTime!.getTime()) / 1000);
        setDuration(diff);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState.status, callState.startTime]);

  // Navigate away if call ends
  useEffect(() => {
    if (callState.status === 'idle') {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    }
  }, [callState.status]);

  // Auto-hide controls for video calls
  useEffect(() => {
    if (callState.type === 'VIDEO' && showControls) {
      const timeout = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setShowControls(false));
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [callState.type, showControls, fadeAnim]);

  const handleTap = () => {
    if (callState.type === 'VIDEO') {
      setShowControls(true);
      fadeAnim.setValue(1);
    }
  };

  const handleEndCall = async () => {
    await endCall();
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    switch (callState.status) {
      case 'calling':
        return 'Calling...';
      case 'ringing':
        return 'Ringing...';
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return formatDuration(duration);
      default:
        return '';
    }
  };

  const isConnected = callState.status === 'connected';

  return (
    <Pressable
      style={[styles.container, { backgroundColor: '#1a1a2e' }]}
      onPress={handleTap}>
      {/* Video / Avatar area */}
      <View style={styles.mainContent}>
        {callState.type === 'VIDEO' ? (
          <View style={styles.videoContainer}>
            {/* Remote video */}
            <View style={styles.remoteVideo}>
              {remoteStream ? (
                <RTCView
                  streamURL={remoteStream.toURL()}
                  objectFit="cover"
                  zOrder={0}
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <>
                  <Avatar uri={callState.participant?.avatar || ""} size={160} showOnlineStatus={false} />
                  {!isConnected && (<Text style={styles.connectingText}>{getStatusText()}</Text>)}
                </>
              )}
            </View>

            {/* Local video PiP */}
            <View style={styles.localVideo}>
              {callState.isVideoEnabled && localStream ? (
                <RTCView
                  streamURL={localStream.toURL()}
                  objectFit="cover"
                  mirror={true}
                  zOrder={1}
                  style={{ width: 100, height: 140 }}
                />
              ) : (
                <IconSymbol name="person.fill" size={40} color="#ffffff" />
              )}
            </View>
          </View>
        ) : (
          <View style={styles.voiceContainer}>
            <Avatar uri={callState.participant?.avatar || ""} size={140} showOnlineStatus={false} />
            <Text style={styles.participantName}>
              {callState.participant?.name || 'Unknown'}
            </Text>
            <Text style={styles.callStatus}>{getStatusText()}</Text>
          </View>
        )}
      </View>

      {/* Top info for video calls */}
      {callState.type === 'VIDEO' && (
        <View style={styles.topInfo}>
          <Text style={styles.videoParticipantName}>
            {callState.participant?.name}
          </Text>
          <Text style={styles.videoDuration}>{getStatusText()}</Text>
        </View>
      )}

      {/* Controls */}
      <Animated.View
        style={[
          styles.controlsContainer,
          { opacity: callState.type === 'VIDEO' ? fadeAnim : 1 },
        ]}>
        {/* Action buttons */}
        <View style={styles.actionsContainer}>
          {/* Mute button */}
          <Pressable
            onPress={toggleMute}
            style={({ pressed }) => [
              styles.controlButton,
              pressed && styles.buttonPressed,
            ]}>
            <View style={[styles.controlButtonCircle, callState.isMuted && styles.controlButtonCircleActive]}>
              <IconSymbol
                name={callState.isMuted ? 'mic.slash.fill' : 'mic.fill'}
                size={24}
                color="#ffffff"
              />
            </View>
            <Text style={styles.controlLabel}>
              {callState.isMuted ? 'Unmute' : 'Mute'}
            </Text>
          </Pressable>

          {/* Speaker button (voice only) */}
          {callState.type === 'VOICE' && (
            <Pressable
              onPress={toggleSpeaker}
              style={({ pressed }) => [
                styles.controlButton,
                pressed && styles.buttonPressed,
              ]}>
              <View style={[styles.controlButtonCircle, callState.isSpeakerOn && styles.controlButtonCircleActive]}>
                <IconSymbol
                  name={callState.isSpeakerOn ? 'speaker.wave.3.fill' : 'speaker.fill'}
                  size={24}
                  color="#ffffff"
                />
              </View>
              <Text style={styles.controlLabel}>Speaker</Text>
            </Pressable>
          )}

          {/* Video toggle button */}
          {callState.type === 'VIDEO' && (
            <Pressable
              onPress={toggleVideo}
              style={({ pressed }) => [
                styles.controlButton,
                pressed && styles.buttonPressed,
              ]}>
              <View style={[styles.controlButtonCircle, !callState.isVideoEnabled && styles.controlButtonCircleActive]}>
                <IconSymbol
                  name={callState.isVideoEnabled ? 'video.fill' : 'video.slash.fill'}
                  size={24}
                  color="#ffffff"
                />
              </View>
              <Text style={styles.controlLabel}>
                {callState.isVideoEnabled ? 'Video' : 'Video Off'}
              </Text>
            </Pressable>
          )}

          {/* Flip camera button (video only) */}
          {callState.type === 'VIDEO' && (
            <Pressable
              onPress={switchCamera}
              style={({ pressed }) => [
                styles.controlButton,
                pressed && styles.buttonPressed,
              ]}>
              <View style={styles.controlButtonCircle}>
                <IconSymbol name="camera.rotate.fill" size={24} color="#ffffff" />
              </View>
              <Text style={styles.controlLabel}>Flip</Text>
            </Pressable>
          )}
        </View>

        {/* End call button */}
        <Pressable
          onPress={handleEndCall}
          style={({ pressed }) => [
            styles.endCallButton,
            pressed && styles.buttonPressed,
          ]}>
          <IconSymbol name="phone.down.fill" size={32} color="#ffffff" />
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    flex: 1,
    width: '100%',
  },
  remoteVideo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2a2a3e',
  },
  localVideo: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    right: 20,
    width: 100,
    height: 140,
    borderRadius: 12,
    backgroundColor: '#3a3a4e',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  voiceContainer: {
    alignItems: 'center',
  },
  participantName: {
    fontSize: 28,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 24,
  },
  callStatus: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 8,
  },
  connectingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 16,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
  },
  topInfo: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    zIndex: 10,
  },
  videoParticipantName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  videoDuration: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 32,
  },
  controlButton: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  controlButtonCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  controlButtonCircleActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  controlLabel: {
    fontSize: 10,
    color: '#ffffff',
    marginTop: 6,
    textAlign: 'center',
  },
  endCallButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
});

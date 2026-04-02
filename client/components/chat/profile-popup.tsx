import React, { useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const POPUP_WIDTH = SCREEN_WIDTH * 0.8;
const IMAGE_HEIGHT = POPUP_WIDTH * 1.05;

interface ProfilePopupProps {
  visible: boolean;
  onClose: () => void;
  user: {
    id: string;
    name: string;
    avatar?: string;
  } | null;
  onMessage: () => void;
  onAudioCall: () => void;
  onVideoCall: () => void;
  onInfo: () => void;
}

function getInitials(name: string | undefined): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProfilePopup({ visible, onClose, user, onMessage, onAudioCall, onVideoCall, onInfo }: ProfilePopupProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [showFullImage, setShowFullImage] = useState(false);

  if (!user) return null;

  return (
    <>
      <Modal visible={visible && !showFullImage} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={[styles.popup, { backgroundColor: colors.cardBackground }]} onPress={(e) => e.stopPropagation()}>
            {/* Image / Initials */}
            <Pressable onPress={() => { if (user.avatar) setShowFullImage(true); }}>
              <View style={styles.imageContainer}>
                {user.avatar ? (
                  <Image source={{ uri: user.avatar }} style={styles.profileImage} contentFit="cover" />
                ) : (
                  <View style={[styles.profileImage, styles.initialsContainer]}>
                    <Text style={styles.initialsText}>{getInitials(user.name)}</Text>
                  </View>
                )}
                {/* Name overlay */}
                <View style={styles.nameOverlay}>
                  <Text style={styles.nameText} numberOfLines={1}>{user.name}</Text>
                </View>
              </View>
            </Pressable>

            {/* Action buttons */}
            <View style={styles.actionsRow}>
              <Pressable style={styles.actionButton} onPress={() => { onClose(); onMessage(); }}>
                <Ionicons name="chatbubble" size={22} color={colors.primary} />
                <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>Message</Text>
              </Pressable>
              <Pressable style={styles.actionButton} onPress={() => { onClose(); onAudioCall(); }}>
                <Ionicons name="call" size={22} color={colors.primary} />
                <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>Audio</Text>
              </Pressable>
              <Pressable style={styles.actionButton} onPress={() => { onClose(); onVideoCall(); }}>
                <Ionicons name="videocam" size={22} color={colors.primary} />
                <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>Video</Text>
              </Pressable>
              <Pressable style={styles.actionButton} onPress={() => { onClose(); onInfo(); }}>
                <Ionicons name="information-circle" size={22} color={colors.primary} />
                <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>Info</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Full screen image viewer */}
      <Modal visible={showFullImage} animationType="fade" onRequestClose={() => setShowFullImage(false)}>
        <View style={styles.fullImageContainer}>
          <StatusBar backgroundColor="#000" barStyle="light-content" />
          <View style={styles.fullImageHeader}>
            <Pressable onPress={() => setShowFullImage(false)} hitSlop={8} style={styles.fullImageBack}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            <Text style={styles.fullImageName} numberOfLines={1}>{user.name}</Text>
          </View>
          {user.avatar && (
            <Image source={{ uri: user.avatar }} style={styles.fullImage} contentFit="contain" />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: SCREEN_HEIGHT * 0.12,
  },
  popup: {
    width: POPUP_WIDTH,
    borderRadius: 2,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  imageContainer: {
    width: POPUP_WIDTH,
    height: IMAGE_HEIGHT,
    position: 'relative',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  initialsContainer: {
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    color: '#ffffff',
    fontSize: 72,
    fontWeight: '600',
  },
  nameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  nameText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  actionLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  fullImageContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImageHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  fullImageBack: {
    padding: 4,
    marginRight: 16,
  },
  fullImageName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
});

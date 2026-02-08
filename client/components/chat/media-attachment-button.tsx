import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  pickImage,
  pickVideo,
  pickDocument,
  takePhoto,
  recordVideo,
  PickedMedia,
} from '@/utils/media-picker';

interface MediaAttachmentButtonProps {
  onMediaSelected: (media: PickedMedia) => void;
  disabled?: boolean;
}

interface AttachmentOption {
  id: string;
  label: string;
  icon: string;
  color: string;
  onPress: () => Promise<PickedMedia | null>;
}

export function MediaAttachmentButton({
  onMediaSelected,
  disabled,
}: MediaAttachmentButtonProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [showModal, setShowModal] = useState(false);

  const options: AttachmentOption[] = [
    {
      id: 'camera',
      label: 'Camera',
      icon: 'camera.fill',
      color: '#E91E63',
      onPress: takePhoto,
    },
    {
      id: 'gallery',
      label: 'Gallery',
      icon: 'photo.fill',
      color: '#9C27B0',
      onPress: pickImage,
    },
    {
      id: 'video',
      label: 'Video',
      icon: 'video.fill',
      color: '#F44336',
      onPress: pickVideo,
    },
    {
      id: 'document',
      label: 'Document',
      icon: 'doc.fill',
      color: '#3F51B5',
      onPress: pickDocument,
    },
  ];

  const handleOptionPress = async (option: AttachmentOption) => {
    setShowModal(false);
    const media = await option.onPress();
    if (media) {
      onMediaSelected(media);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setShowModal(true)}
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          disabled && styles.buttonDisabled,
        ]}>
        <IconSymbol
          name="plus"
          size={24}
          color={disabled ? colors.textSecondary : colors.primary}
        />
      </Pressable>

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowModal(false)}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.background },
            ]}>
            <View style={styles.modalHandle} />

            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Share content
            </Text>

            <View style={styles.optionsGrid}>
              {options.map((option) => (
                <Pressable
                  key={option.id}
                  style={styles.optionItem}
                  onPress={() => handleOptionPress(option)}>
                  <View
                    style={[
                      styles.optionIcon,
                      { backgroundColor: option.color },
                    ]}>
                    <IconSymbol name={option.icon} size={24} color="#ffffff" />
                  </View>
                  <Text style={[styles.optionLabel, { color: colors.text }]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[
                styles.cancelButton,
                { backgroundColor: colors.backgroundSecondary },
              ]}
              onPress={() => setShowModal(false)}>
              <Text style={[styles.cancelText, { color: colors.text }]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ccc',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  optionItem: {
    alignItems: 'center',
    width: '25%',
    marginBottom: 20,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  cancelButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

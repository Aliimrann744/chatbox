import { Alert, Linking } from 'react-native';
import * as Contacts from 'expo-contacts';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';

import { cache } from '@/services/cache';

type PermissionKind = 'camera' | 'microphone' | 'contacts';

type PermissionResult = {
  granted: boolean;
  status: string;
  canAskAgain?: boolean;
};

const askedKey = (kind: PermissionKind) => `permission:asked:${kind}`;

function showSettingsAlert(kind: PermissionKind, reason: string) {
  Alert.alert(
    `${kind[0].toUpperCase()}${kind.slice(1)} permission`,
    `${reason} You can enable it from the app's system settings.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
    ],
  );
}

function confirmPermission(title: string, reason: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, reason, [
      { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continue', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

async function ensurePermission(
  kind: PermissionKind,
  title: string,
  reason: string,
  getStatus: () => Promise<PermissionResult>,
  request: () => Promise<PermissionResult>,
): Promise<boolean> {
  const current = await getStatus();
  if (current.granted) return true;

  const wasAsked = cache.get<boolean>(askedKey(kind)) === true;
  if (current.canAskAgain === false || wasAsked) {
    showSettingsAlert(kind, reason);
    return false;
  }

  const confirmed = await confirmPermission(title, reason);
  if (!confirmed) return false;

  cache.set(askedKey(kind), true);
  const result = await request();
  if (result.granted) return true;

  if (result.canAskAgain === false) showSettingsAlert(kind, reason);
  return false;
}

export function ensureCameraPermission(reason = 'Camera access is needed to take photos and videos.') {
  return ensurePermission(
    'camera',
    'Allow camera access?',
    reason,
    ImagePicker.getCameraPermissionsAsync,
    ImagePicker.requestCameraPermissionsAsync,
  );
}

export function ensureMicrophonePermission(reason = 'Microphone access is needed to record audio.') {
  return ensurePermission(
    'microphone',
    'Allow microphone access?',
    reason,
    Audio.getPermissionsAsync,
    Audio.requestPermissionsAsync,
  );
}

export function ensureContactsPermission(reason = 'Contacts access is needed to find people you know.') {
  return ensurePermission(
    'contacts',
    'Allow contacts access?',
    reason,
    Contacts.getPermissionsAsync,
    Contacts.requestPermissionsAsync,
  );
}


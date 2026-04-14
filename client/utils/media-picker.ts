import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Alert, Platform } from 'react-native';

export interface PickedMedia {
  uri: string;
  type: 'image' | 'video' | 'document';
  mimeType: string;
  name: string;
  size?: number;
  duration?: number;
  width?: number;
  height?: number;
}

// Request camera permissions
async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Permission Required',
      'Camera permission is required to take photos and videos.',
      [{ text: 'OK' }]
    );
    return false;
  }
  return true;
}

// Request media library permissions
async function requestMediaLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Permission Required',
      'Media library permission is required to select photos and videos.',
      [{ text: 'OK' }]
    );
    return false;
  }
  return true;
}

// Pick image from gallery
export async function pickImage(): Promise<PickedMedia | null> {
  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const fileName = asset.uri.split('/').pop() || 'image.jpg';

  return {
    uri: asset.uri,
    type: 'image',
    mimeType: asset.mimeType || 'image/jpeg',
    name: fileName,
    size: asset.fileSize,
    width: asset.width,
    height: asset.height,
  };
}

// Pick video from gallery
export async function pickVideo(): Promise<PickedMedia | null> {
  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    allowsEditing: true,
    quality: 0.8,
    videoMaxDuration: 60,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const fileName = asset.uri.split('/').pop() || 'video.mp4';

  return {
    uri: asset.uri,
    type: 'video',
    mimeType: asset.mimeType || 'video/mp4',
    name: fileName,
    size: asset.fileSize,
    duration: asset.duration ?? undefined,
    width: asset.width,
    height: asset.height,
  };
}

// Take photo with camera
export async function takePhoto(): Promise<PickedMedia | null> {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const fileName = `photo_${Date.now()}.jpg`;

  return {
    uri: asset.uri,
    type: 'image',
    mimeType: asset.mimeType || 'image/jpeg',
    name: fileName,
    size: asset.fileSize,
    width: asset.width,
    height: asset.height,
  };
}

// Record video with camera
export async function recordVideo(): Promise<PickedMedia | null> {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    allowsEditing: true,
    quality: 0.8,
    videoMaxDuration: 60,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const fileName = `video_${Date.now()}.mp4`;

  return {
    uri: asset.uri,
    type: 'video',
    mimeType: asset.mimeType || 'video/mp4',
    name: fileName,
    size: asset.fileSize,
    duration: asset.duration ?? undefined,
    width: asset.width,
    height: asset.height,
  };
}

// Pick document
export async function pickDocument(): Promise<PickedMedia | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets[0]) return null;

    const asset = result.assets[0];

    return {
      uri: asset.uri,
      type: 'document',
      mimeType: asset.mimeType || 'application/octet-stream',
      name: asset.name,
      size: asset.size,
    };
  } catch (error) {
    console.error('Error picking document:', error);
    return null;
  }
}

// Pick multiple media (images and videos) from gallery
export async function pickMultipleMedia(): Promise<PickedMedia[]> {
  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    allowsMultipleSelection: true,
    quality: 0.8,
    videoMaxDuration: 30,
    selectionLimit: 10,
  });

  if (result.canceled || !result.assets.length) return [];

  return result.assets.map((asset) => {
    const isVideo = asset.type === 'video';
    const fileName = asset.uri.split('/').pop() || (isVideo ? 'video.mp4' : 'image.jpg');
    return {
      uri: asset.uri,
      type: isVideo ? ('video' as const) : ('image' as const),
      mimeType: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
      name: fileName,
      size: asset.fileSize,
      duration: asset.duration ?? undefined,
      width: asset.width,
      height: asset.height,
    };
  });
}

// Get media type from mime type
export function getMessageTypeFromMimeType(mimeType: string): 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  return 'DOCUMENT';
}

// Format file size for display
export function formatFileSize(bytes?: number): string {
  if (!bytes) return 'Unknown size';

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Format duration for display (in milliseconds)
export function formatDuration(ms?: number): string {
  if (!ms) return '0:00';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

import { ExpoConfig, ConfigContext } from 'expo/config';

const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || '';
const FACEBOOK_CLIENT_TOKEN = process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN || '';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'WhatsApp',
  slug: 'Chatbox',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.jpeg',
  scheme: 'whatsapp',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    infoPlist: {
      NSMicrophoneUsageDescription: 'WhatsApp needs microphone access for voice and video calls',
      NSCameraUsageDescription: 'WhatsApp needs camera access for video calls',
      ITSAppUsesNonExemptEncryption: false,
    },
    bundleIdentifier: 'com.chatbox.app',
  },
  android: {
    package: 'com.chatbox.app',
    adaptiveIcon: {
      foregroundImage: './assets/images/icon.jpeg',
      backgroundColor: '#25D366',
    },
    permissions: ['RECORD_AUDIO', 'CAMERA'],
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static' as const,
    favicon: './assets/images/splash-icon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: {
          backgroundColor: '#000000',
        },
      },
    ],
    'expo-secure-store',
    ['@react-native-google-signin/google-signin'],
    [
      'react-native-fbsdk-next',
      {
        appID: FACEBOOK_APP_ID,
        clientToken: FACEBOOK_CLIENT_TOKEN,
        displayName: 'WhatsApp',
        scheme: `fb${FACEBOOK_APP_ID}`,
        advertiserIDCollectionEnabled: false,
        autoLogAppEventsEnabled: false,
        isAutoInitEnabled: true,
      },
    ],
    './plugins/force-agp-version',
    './plugins/fix-android-stl',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: '89ded1b4-8ad5-4959-a35d-40bac6aaa11e',
    },
  },
});

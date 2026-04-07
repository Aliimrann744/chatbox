import { ExpoConfig, ConfigContext } from 'expo/config';
import 'dotenv/config';

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
    googleServicesFile: './GoogleService-Info.plist',
    infoPlist: {
      NSMicrophoneUsageDescription: 'WhatsApp needs microphone access for voice and video calls',
      NSCameraUsageDescription: 'WhatsApp needs camera access for video calls',
      ITSAppUsesNonExemptEncryption: false,
      UIBackgroundModes: ['voip', 'remote-notification', 'fetch'],
    },
    bundleIdentifier: 'com.chatbox.app',
  },
  android: {
    package: 'com.chatbox.app',
    googleServicesFile: './google-services.json',
    adaptiveIcon: {
      foregroundImage: './assets/images/icon.jpeg',
      backgroundColor: '#25D366',
    },
    permissions: [
      'RECORD_AUDIO',
      'CAMERA',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_PHONE_CALL',
      'USE_FULL_SCREEN_INTENT',
      'VIBRATE',
      'RECEIVE_BOOT_COMPLETED',
      'WAKE_LOCK',
    ],
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
    ["@react-native-google-signin/google-signin", { iosUrlScheme: "com.googleusercontent.apps.dummy" }],
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
    '@react-native-firebase/app',
    '@react-native-firebase/messaging',
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

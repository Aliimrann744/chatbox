import { ExpoConfig, ConfigContext } from 'expo/config';
import 'dotenv/config';

const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || '';
const FACEBOOK_CLIENT_TOKEN = process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN || '';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Whatchat',
  slug: 'Whatchat',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'whatchat',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: {
    url: 'https://u.expo.dev/d244487d-5c67-4831-b789-c26d573a0f47',
    fallbackToCacheTimeout: 0,
    checkAutomatically: 'ON_LOAD',
  },
  ios: {
    supportsTablet: true,
    googleServicesFile: './GoogleService-Info.plist',
    infoPlist: {
      NSMicrophoneUsageDescription: 'Whatchat needs microphone access for voice messages and calls',
      NSCameraUsageDescription: 'Whatchat needs camera access for taking photos and video calls',
      NSPhotoLibraryUsageDescription: 'Whatchat needs photo library access to share photos and videos',
      ITSAppUsesNonExemptEncryption: false,
      UIBackgroundModes: ['voip', 'remote-notification', 'fetch'],
    },
    bundleIdentifier: 'com.whatchat.chat',
    buildNumber: '1',
  },
  android: {
    package: 'com.whatchat.chat',
    googleServicesFile: './google-services.json',
    softwareKeyboardLayoutMode: 'resize',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon-fg.png',
      backgroundColor: '#128C7E',
    },
    permissions: [
      'RECORD_AUDIO',
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'READ_MEDIA_IMAGES',
      'READ_MEDIA_VIDEO',
      'READ_MEDIA_AUDIO',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_PHONE_CALL',
      'USE_FULL_SCREEN_INTENT',
      'VIBRATE',
      'RECEIVE_BOOT_COMPLETED',
      'WAKE_LOCK',
      // Required so Android 13+ can prompt the user to allow push
      // notifications — without this messaging().requestPermission()
      // never actually asks, which breaks FCM OTP delivery.
      'POST_NOTIFICATIONS',
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
    'expo-updates',
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          minSdkVersion: 24,
          buildToolsVersion: '35.0.0',
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
        ios: {
          deploymentTarget: '15.1',
        },
      },
    ],
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
    'expo-localization',
    ["@react-native-google-signin/google-signin", { iosUrlScheme: "com.googleusercontent.apps.dummy" }],
    [
      'react-native-fbsdk-next',
      {
        appID: FACEBOOK_APP_ID,
        clientToken: FACEBOOK_CLIENT_TOKEN,
        displayName: 'Whatchat',
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
      "projectId": "d244487d-5c67-4831-b789-c26d573a0f47"
    },
  },
  owner: 'mr.hais',
});

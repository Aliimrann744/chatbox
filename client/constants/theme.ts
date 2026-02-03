/**
 * Theme configuration for Chatbox - WhatsApp-like chat application
 * Primary color: #04003a (deep navy blue)
 */

import { Platform } from 'react-native';

// Primary brand color
const primaryColor = '#04003a';
const primaryColorLight = '#1a1a5e';
const accentColor = '#25D366'; // WhatsApp green for accents

export const Colors = {
  light: {
    text: '#11181C',
    textSecondary: '#687076',
    background: '#ffffff',
    backgroundSecondary: '#f0f2f5',
    tint: primaryColor,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: primaryColor,
    primary: primaryColor,
    primaryLight: primaryColorLight,
    accent: accentColor,
    border: '#e0e0e0',
    cardBackground: '#ffffff',
    inputBackground: '#f0f2f5',
    messageOutgoing: '#dcf8c6',
    messageIncoming: '#ffffff',
    online: '#25D366',
    headerBackground: primaryColor,
    headerText: '#ffffff',
  },
  dark: {
    text: '#ECEDEE',
    textSecondary: '#9BA1A6',
    background: '#0b141a',
    backgroundSecondary: '#1f2c34',
    tint: '#ffffff',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#ffffff',
    primary: primaryColor,
    primaryLight: primaryColorLight,
    accent: accentColor,
    border: '#2a3942',
    cardBackground: '#1f2c34',
    inputBackground: '#2a3942',
    messageOutgoing: '#005c4b',
    messageIncoming: '#1f2c34',
    online: '#25D366',
    headerBackground: primaryColor,
    headerText: '#ffffff',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// Common spacing values
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

// Common border radius values
export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  full: 9999,
};

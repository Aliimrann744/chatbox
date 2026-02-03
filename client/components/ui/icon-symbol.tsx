// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING: Record<string, ComponentProps<typeof MaterialIcons>['name']> = {
  // Navigation icons
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',

  // Chat app icons
  'message.fill': 'chat',
  'phone.fill': 'phone',
  'gear': 'settings',
  'person.fill': 'person',
  'person.circle.fill': 'account-circle',
  'plus': 'add',
  'magnifyingglass': 'search',
  'camera.fill': 'camera-alt',
  'mic.fill': 'mic',
  'paperclip': 'attach-file',
  'ellipsis.vertical': 'more-vert',
  'arrow.left': 'arrow-back',
  'person.2.fill': 'group',
  'person.badge.plus': 'person-add',
  'building.2.fill': 'business',
  'checkmark': 'check',
  'checkmark.double': 'done-all',
  'xmark': 'close',
  'photo': 'photo',
  'doc.fill': 'description',
  'location.fill': 'location-on',
  'video.fill': 'videocam',
  'phone.arrow.up.right': 'phone-callback',
  'phone.arrow.down.left': 'phone-in-talk',
  'phone.fill.arrow.up.right': 'call-made',
  'phone.fill.arrow.down.left': 'call-received',
};

export type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}

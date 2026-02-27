import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView, SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { StyleProp, ViewStyle } from 'react-native';

// Mapping for icons that don't have direct SF Symbol equivalents
const FALLBACK_MAPPING: Record<string, ComponentProps<typeof MaterialIcons>['name']> = {
  'checkmark.double': 'done-all',
  'ellipsis.vertical': 'more-vert',
  'phone.fill.arrow.up.right': 'call-made',
  'phone.fill.arrow.down.left': 'call-received',
};

// List of valid SF Symbols we use
const VALID_SF_SYMBOLS: string[] = [
  'house.fill',
  'paperplane.fill',
  'chevron.left.forwardslash.chevron.right',
  'chevron.right',
  'chevron.left',
  'message.fill',
  'phone.fill',
  'gear',
  'gearshape',
  'person.fill',
  'person.circle.fill',
  'plus',
  'magnifyingglass',
  'camera.fill',
  'mic.fill',
  'paperclip',
  'arrow.left',
  'person.2.fill',
  'person.badge.plus',
  'building.2.fill',
  'checkmark',
  'xmark',
  'photo',
  'doc.fill',
  'location.fill',
  'video.fill',
  'phone.arrow.up.right',
  'phone.arrow.down.left',
  'phone.down.fill',
  'mic.slash.fill',
  'speaker.wave.3.fill',
  'speaker.fill',
  'video.slash.fill',
  'camera.rotate.fill',
  'exclamationmark.circle',
];

export type IconSymbolName = string;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = 'regular',
}: {
  name: IconSymbolName;
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}) {
  // Check if we need to use Material Icons fallback
  const fallbackIcon = FALLBACK_MAPPING[name];
  if (fallbackIcon) {
    return (
      <MaterialIcons
        name={fallbackIcon}
        size={size}
        color={color}
        style={style as any}
      />
    );
  }

  // Use SF Symbols for supported icons
  return (
    <SymbolView
      weight={weight}
      tintColor={color}
      resizeMode="scaleAspectFit"
      name={name as SymbolViewProps['name']}
      style={[
        {
          width: size,
          height: size,
        },
        style,
      ]}
    />
  );
}

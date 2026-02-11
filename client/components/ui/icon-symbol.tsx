import { MAPPING } from '@/constants/icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { SymbolWeight } from 'expo-symbols';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

interface IconSymbolTypes {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}

export type IconSymbolName = keyof typeof MAPPING;
export function IconSymbol({ name, size = 24, color, style }: IconSymbolTypes) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}

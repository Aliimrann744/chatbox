import React, { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type IonIconName = keyof typeof Ionicons.glyphMap;

// ─── Page shell ─────────────────────────────────────────────────────────────

export function SettingsScreen({
  title,
  rightAction,
  scroll = true,
  children,
  contentContainerStyle,
}: {
  title: string;
  rightAction?: ReactNode;
  scroll?: boolean;
  children: ReactNode;
  contentContainerStyle?: ViewStyle;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const Body: any = scroll ? ScrollView : View;
  const bodyProps = scroll
    ? {
        showsVerticalScrollIndicator: false,
        contentContainerStyle: [{ paddingBottom: insets.bottom + 24 }, contentContainerStyle],
      }
    : { style: [{ flex: 1 }, contentContainerStyle] };

  return (
    <View style={[styles.shell, { backgroundColor: colors.backgroundSecondary }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 6, backgroundColor: colors.primary },
        ]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          hitSlop={10}
          style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerRight}>{rightAction}</View>
      </View>
      <Body {...bodyProps}>{children}</Body>
    </View>
  );
}

// ─── Section ────────────────────────────────────────────────────────────────

export function SettingsSection({
  title,
  footer,
  children,
  noCard = false,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
  noCard?: boolean;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  return (
    <View style={styles.section}>
      {title ? (
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>{title}</Text>
      ) : null}
      <View
        style={[
          !noCard && { backgroundColor: colors.background },
          !noCard && { borderColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
        ]}>
        {children}
      </View>
      {footer ? (
        <Text style={[styles.sectionFooter, { color: colors.textSecondary }]}>{footer}</Text>
      ) : null}
    </View>
  );
}

// ─── Item row ───────────────────────────────────────────────────────────────

export function SettingsItem({
  icon,
  iconColor,
  title,
  subtitle,
  value,
  onPress,
  showChevron,
  destructive,
  disabled,
}: {
  icon?: IonIconName;
  iconColor?: string;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  destructive?: boolean;
  disabled?: boolean;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const titleColor = destructive ? '#E11D48' : colors.text;
  const iconTint = destructive ? '#E11D48' : iconColor || colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [
        styles.item,
        pressed && onPress ? { backgroundColor: colors.backgroundSecondary } : null,
        disabled && { opacity: 0.5 },
      ]}>
      {icon ? (
        <Ionicons name={icon} size={22} color={iconTint} style={styles.itemIcon} />
      ) : null}
      <View style={styles.itemBody}>
        <Text style={[styles.itemTitle, { color: titleColor }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={[styles.itemValue, { color: colors.textSecondary }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {showChevron && onPress ? (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.textSecondary}
          style={{ marginLeft: 4 }}
        />
      ) : null}
    </Pressable>
  );
}

// ─── Toggle row ─────────────────────────────────────────────────────────────

export function SettingsToggle({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
}: {
  icon?: IonIconName;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  return (
    <View style={[styles.item, disabled && { opacity: 0.5 }]}>
      {icon ? (
        <Ionicons name={icon} size={22} color={colors.textSecondary} style={styles.itemIcon} />
      ) : null}
      <View style={styles.itemBody}>
        <Text style={[styles.itemTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: '#767577', true: colors.primary }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

// ─── Radio row (used inside a section list of radio items) ──────────────────

export function SettingsRadio<T extends string>({
  title,
  subtitle,
  selected,
  onSelect,
  value,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onSelect: (v: T) => void;
  value: T;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  return (
    <Pressable
      onPress={() => onSelect(value)}
      style={({ pressed }) => [
        styles.item,
        pressed ? { backgroundColor: colors.backgroundSecondary } : null,
      ]}>
      <View style={styles.itemBody}>
        <Text style={[styles.itemTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      <View
        style={[
          styles.radio,
          { borderColor: selected ? colors.primary : colors.textSecondary },
        ]}>
        {selected ? (
          <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
        ) : null}
      </View>
    </Pressable>
  );
}

// ─── Divider ────────────────────────────────────────────────────────────────

export function SettingsDivider() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  return (
    <View style={[styles.divider, { backgroundColor: colors.border }]} />
  );
}

// ─── styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  shell: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 6,
  },
  headerRight: {
    minWidth: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingRight: 6,
  },
  section: {
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sectionFooter: {
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  itemIcon: {
    width: 26,
    marginRight: 18,
    textAlign: 'center',
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '400',
  },
  itemSubtitle: {
    fontSize: 13,
    marginTop: 3,
  },
  itemValue: {
    fontSize: 14,
    marginLeft: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 60,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});

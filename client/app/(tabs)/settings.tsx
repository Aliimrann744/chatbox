import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type IonIconName = keyof typeof Ionicons.glyphMap;

interface SettingsRowProps {
  icon: IonIconName;
  title: string;
  subtitle: string;
  onPress: () => void;
}

function SettingsRow({ icon, title, subtitle, onPress }: SettingsRowProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: colors.backgroundSecondary },
      ]}>
      <Ionicons name={icon} size={24} color={colors.text} style={styles.rowIcon} />
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const go = (path: string) => () => router.push(path as any);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, backgroundColor: colors.background },
        ]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <Pressable hitSlop={10} style={styles.headerBtn} onPress={() => {}}>
          <Ionicons name="search" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 4 }}>
        <SettingsRow
          icon="person-add-outline"
          title="Invite a friend"
          subtitle="Invite people to chat on WhatsApp"
          onPress={go('/settings/invite')}
        />
        <SettingsRow
          icon="key-outline"
          title="Account"
          subtitle="Security notifications, change number"
          onPress={go('/settings/account')}
        />
        <SettingsRow
          icon="lock-closed-outline"
          title="Privacy"
          subtitle="Blocked accounts, disappearing messages"
          onPress={go('/settings/privacy')}
        />
        <SettingsRow
          icon="albums-outline"
          title="Lists"
          subtitle="Manage people and groups"
          onPress={go('/settings/lists')}
        />
        <SettingsRow
          icon="chatbubble-outline"
          title="Chats"
          subtitle="Theme, wallpapers, chat history"
          onPress={go('/settings/chats')}
        />
        <SettingsRow
          icon="megaphone-outline"
          title="Broadcasts"
          subtitle="Manage lists and send broadcasts"
          onPress={go('/settings/broadcasts')}
        />
        <SettingsRow
          icon="notifications-outline"
          title="Notifications"
          subtitle="Message, group & call tones"
          onPress={go('/settings/notifications')}
        />
        <SettingsRow
          icon="sync-circle-outline"
          title="Storage and data"
          subtitle="Network usage, auto-download"
          onPress={go('/settings/storage')}
        />
        <SettingsRow
          icon="accessibility-outline"
          title="Accessibility"
          subtitle="Increase contrast, animation"
          onPress={go('/settings/accessibility')}
        />
        <SettingsRow
          icon="globe-outline"
          title="App language"
          subtitle="English (device's language)"
          onPress={go('/settings/language')}
        />
        <SettingsRow
          icon="help-circle-outline"
          title="Help and feedback"
          subtitle="Help center, contact us, privacy policy"
          onPress={go('/settings/help')}
        />

        <View style={styles.appInfo}>
          <Text style={[styles.appVersion, { color: colors.textSecondary }]}>
            from Meta
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  rowIcon: {
    width: 28,
    marginRight: 22,
    textAlign: 'center',
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '500',
  },
  rowSubtitle: {
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  appInfo: {
    alignItems: 'center',
    paddingTop: 30,
    paddingBottom: 10,
  },
  appVersion: {
    fontSize: 12,
  },
});

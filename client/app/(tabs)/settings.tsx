import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface SettingsItemProps {
  icon: IconSymbolName;
  iconColor?: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showArrow?: boolean;
}

function SettingsItem({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  showArrow = true,
}: SettingsItemProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsItem,
        {
          backgroundColor: pressed ? colors.backgroundSecondary : colors.background,
        },
      ]}>
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: iconColor || colors.primary },
        ]}>
        <IconSymbol name={icon} size={20} color="#ffffff" />
      </View>
      <View style={styles.settingsItemContent}>
        <Text style={[styles.settingsItemTitle, { color: colors.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.settingsItemSubtitle, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {showArrow && (
        <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
      )}
    </Pressable>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View style={styles.section}>
      {title && (
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
      )}
      <View style={[styles.sectionContent, { backgroundColor: colors.cardBackground }]}>
        {children}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      {/* Account Settings */}
      <SettingsSection>
        <SettingsItem
          icon="person.fill"
          iconColor="#5856D6"
          title="Account"
          subtitle="Privacy, security, change number"
        />
      </SettingsSection>

      {/* App Settings */}
      <SettingsSection>
        <SettingsItem
          icon="message.fill"
          iconColor="#34C759"
          title="Chats"
          subtitle="Theme, wallpapers, chat history"
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <SettingsItem
          icon="phone.fill"
          iconColor="#FF9500"
          title="Notifications"
          subtitle="Message, group & call tones"
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <SettingsItem
          icon="photo"
          iconColor="#007AFF"
          title="Storage and Data"
          subtitle="Network usage, auto-download"
        />
      </SettingsSection>

      {/* Help & Info */}
      <SettingsSection>
        <SettingsItem
          icon="doc.fill"
          iconColor="#FF3B30"
          title="Help"
          subtitle="Help center, contact us, privacy policy"
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <SettingsItem
          icon="person.2.fill"
          iconColor="#007AFF"
          title="Invite a Friend"
          showArrow={false}
        />
      </SettingsSection>

      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={[styles.appName, { color: colors.textSecondary }]}>WhatsApp</Text>
        <Text style={[styles.appVersion, { color: colors.textSecondary }]}>
          Version 1.0.0
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingVertical: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  sectionContent: {
    marginHorizontal: 0,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingsItemContent: {
    flex: 1,
  },
  settingsItemTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingsItemSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 62,
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 20,
    paddingBottom: 40,
  },
  appName: {
    fontSize: 14,
    fontWeight: '600',
  },
  appVersion: {
    fontSize: 12,
    marginTop: 4,
  },
});

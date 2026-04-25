import React, { useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SettingsItem, SettingsScreen, SettingsSection } from '@/components/settings/settings-ui';

const INVITE_URL = 'https://whatsapp.com/dl';
const APP_NAME = 'Whatchat';

export default function InviteScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [justCopied, setJustCopied] = useState(false);

  const message = `Join me on ${APP_NAME} for seamless communication. Download it here: ${INVITE_URL}`;

  const shareVia = async (mode?: 'sms' | 'email' | 'generic') => {
    try {
      await Share.share(
        {
          message,
          ...(mode === 'email'
            ? { subject: `Let's chat on ${APP_NAME}` }
            : {}),
        },
        { dialogTitle: `Invite a friend to ${APP_NAME}` },
      );
    } catch (e: any) {
      Alert.alert('Could not open share sheet', e?.message || 'Please try again.');
    }
  };

  const copyLink = async () => {
    try {
      await Clipboard.setStringAsync(INVITE_URL);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 1500);
    } catch {
      Alert.alert('Error', 'Could not copy link.');
    }
  };

  return (
    <SettingsScreen title="Invite a friend">
      <View style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: colors.primary + '22' }]}>
          <Ionicons name="person-add" size={40} color={colors.primary} />
        </View>
        <Text style={[styles.heroTitle, { color: colors.text }]}>
          Invite friends to {APP_NAME}
        </Text>
        <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
          Share the link below so your friends can join you on {APP_NAME}.
        </Text>
      </View>

      <SettingsSection>
        <SettingsItem
          icon="share-social-outline"
          title="Share link"
          subtitle="Send via any app"
          onPress={() => shareVia('generic')}
          showChevron
        />
        <SettingsItem
          icon="chatbubble-ellipses-outline"
          title="Invite via SMS"
          onPress={() => shareVia('sms')}
          showChevron
        />
        <SettingsItem
          icon="mail-outline"
          title="Invite via email"
          onPress={() => shareVia('email')}
          showChevron
        />
        <SettingsItem
          icon={justCopied ? 'checkmark-done' : 'link-outline'}
          title={justCopied ? 'Link copied' : 'Copy link'}
          value={INVITE_URL}
          onPress={copyLink}
        />
      </SettingsSection>

      <Text style={[styles.footer, { color: colors.textSecondary }]}>
        Anyone with this link can download and join {APP_NAME}.
      </Text>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingTop: 28,
    paddingHorizontal: 32,
    paddingBottom: 12,
  },
  heroIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 24,
  },
});

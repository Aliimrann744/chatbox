import React from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SettingsDivider, SettingsItem, SettingsScreen, SettingsSection } from '@/components/settings/settings-ui';

const HELP_CENTER_URL = 'https://faq.whatsapp.com/';
const CONTACT_EMAIL = 'support@whatschat.com';
const PRIVACY_URL = 'https://www.whatsapp.com/legal/privacy-policy';
const TERMS_URL = 'https://www.whatsapp.com/legal/terms-of-service';

const open = async (url: string) => {
  try {
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else throw new Error('No app to open this link');
  } catch (e: any) {
    Alert.alert('Cannot open link', e?.message || 'Please try again.');
  }
};

export default function HelpScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const appVersion =
    (Constants.expoConfig as any)?.version ||
    (Constants as any).manifest?.version ||
    '1.0.0';

  return (
    <SettingsScreen title="Help and feedback">
      <SettingsSection>
        <SettingsItem
          icon="help-buoy-outline"
          title="Help center"
          subtitle="Answers to common questions"
          onPress={() => open(HELP_CENTER_URL)}
          showChevron
        />
        <SettingsDivider />
        <SettingsItem
          icon="mail-outline"
          title="Contact us"
          subtitle="Questions? Need help?"
          onPress={() =>
            open(
              `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                'App feedback',
              )}&body=${encodeURIComponent('Describe your issue...')}`,
            )
          }
          showChevron
        />
        <SettingsDivider />
        <SettingsItem
          icon="star-outline"
          title="Rate the app"
          onPress={() =>
            Alert.alert(
              'Rate the app',
              'Opening the store page is not yet available on this build.',
            )
          }
          showChevron
        />
      </SettingsSection>

      <SettingsSection title="Legal">
        <SettingsItem
          icon="shield-checkmark-outline"
          title="Privacy policy"
          onPress={() => open(PRIVACY_URL)}
          showChevron
        />
        <SettingsDivider />
        <SettingsItem
          icon="document-text-outline"
          title="Terms of service"
          onPress={() => open(TERMS_URL)}
          showChevron
        />
      </SettingsSection>

      <View style={styles.versionBlock}>
        <Text style={[styles.appName, { color: colors.text }]}>Whatchat</Text>
        <Text style={[styles.version, { color: colors.textSecondary }]}>
          Version {appVersion}
        </Text>
      </View>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  versionBlock: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  appName: {
    fontSize: 16,
    fontWeight: '600',
  },
  version: {
    fontSize: 12,
    marginTop: 4,
  },
});

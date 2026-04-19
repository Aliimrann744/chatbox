import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { settingsApi } from '@/services/api';
import { cache } from '@/services/cache';
import { useAuth } from '@/contexts/auth-context';
import {
  SettingsDivider,
  SettingsItem,
  SettingsScreen,
  SettingsSection,
  SettingsToggle,
} from '@/components/settings/settings-ui';

const K_SECURITY_NOTIFS = 'settings:account:securityNotifs';
const K_TWO_STEP = 'settings:account:twoStep';

export default function AccountScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { user, logout } = useAuth();

  const [securityNotifs, setSecurityNotifs] = useState(true);
  const [twoStepEnabled, setTwoStepEnabled] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const sn = cache.get<boolean>(K_SECURITY_NOTIFS);
    const ts = cache.get<boolean>(K_TWO_STEP);
    if (typeof sn === 'boolean') setSecurityNotifs(sn);
    if (typeof ts === 'boolean') setTwoStepEnabled(ts);
  }, []);

  const toggleSecurity = (v: boolean) => {
    setSecurityNotifs(v);
    cache.set(K_SECURITY_NOTIFS, v);
  };

  const handleChangeNumber = () => {
    Alert.alert(
      'Change number',
      'Your account information, groups and messages will be moved to your new number.\n\nBefore proceeding, please ensure that you can receive SMS on your new number.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            // Route through the existing OTP flow in (auth)/continue
            router.push('/(auth)/continue');
          },
        },
      ],
    );
  };

  const handleTwoStep = () => {
    Alert.alert(
      twoStepEnabled ? 'Turn off two-step verification?' : 'Two-step verification',
      twoStepEnabled
        ? 'You will no longer be asked for a PIN when you register your phone number.'
        : 'For added security, enable two-step verification which will require a PIN when registering your phone number with WhatsApp again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: twoStepEnabled ? 'Turn off' : 'Enable',
          onPress: () => {
            const next = !twoStepEnabled;
            setTwoStepEnabled(next);
            cache.set(K_TWO_STEP, next);
          },
        },
      ],
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete my account',
      'Deleting your account will:\n\n• Delete your account info and profile photo\n• Delete you from all groups\n• Delete your message history\n• Delete your payments history\n\nThis cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete my account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await settingsApi.deleteAccount();
              await logout();
              router.replace('/(auth)/continue');
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to delete account.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SettingsScreen title="Account">
      <SettingsSection>
        <SettingsToggle
          icon="shield-checkmark-outline"
          title="Security notifications"
          subtitle="Get notified when a contact's security code has changed."
          value={securityNotifs}
          onValueChange={toggleSecurity}
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsItem
          icon="swap-horizontal-outline"
          title="Change number"
          subtitle={
            user?.phone
              ? `${(user as any)?.countryCode || ''}${user.phone}`
              : 'Add a phone number'
          }
          onPress={handleChangeNumber}
          showChevron
        />
        <SettingsDivider />
        <SettingsItem
          icon="key-outline"
          title="Two-step verification"
          subtitle={twoStepEnabled ? 'Enabled' : 'Disabled'}
          onPress={handleTwoStep}
          showChevron
        />
        <SettingsDivider />
        <SettingsItem
          icon="mail-outline"
          title="Email address"
          value={user?.email || 'Not set'}
          onPress={() => router.push('/(tabs)/profile')}
          showChevron
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsItem
          icon="trash-outline"
          title="Delete my account"
          destructive
          onPress={handleDeleteAccount}
          disabled={deleting}
        />
      </SettingsSection>

      <Text style={[styles.footer, { color: colors.textSecondary }]}>
        Signed in as {user?.name || 'Unknown'}.
      </Text>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  footer: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
  },
});

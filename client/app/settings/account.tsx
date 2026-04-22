import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { settingsApi, twoFactorApi, TwoFactorStatus } from '@/services/api';
import { useAuth } from '@/contexts/auth-context';
import {
  SettingsDivider,
  SettingsItem,
  SettingsScreen,
  SettingsSection,
} from '@/components/settings/settings-ui';

export default function AccountScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  const [twoFactor, setTwoFactor] = useState<TwoFactorStatus | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    twoFactorApi.getStatus().then(setTwoFactor).catch(() => {});
  }, []);

  const handleChangeNumber = () => {
    Alert.alert(
      t('account.changeNumber.alertTitle'),
      t('account.changeNumber.alertBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.continue'),
          onPress: () => router.push('/(auth)/continue'),
        },
      ],
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('account.deleteAccount.confirmTitle'),
      t('account.deleteAccount.confirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('account.deleteAccount.confirmButton'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await settingsApi.deleteAccount();
              await logout();
              router.replace('/(auth)/continue');
            } catch (e: any) {
              Alert.alert(t('common.error'), e?.message || 'Failed to delete account.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  const twoFactorSubtitle = twoFactor?.enabled
    ? t('account.twoStep.enabled')
    : t('account.twoStep.disabled');

  return (
    <SettingsScreen title={t('account.title')}>
      <SettingsSection>
        <SettingsItem
          icon="shield-checkmark-outline"
          title={t('account.securityNotifications.title')}
          subtitle={t('account.securityNotifications.subtitle')}
          onPress={() => router.push('/settings/account/security-notifications')}
          showChevron
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsItem
          icon="swap-horizontal-outline"
          title={t('account.changeNumber.title')}
          subtitle={
            user?.phone
              ? `${(user as any)?.countryCode || ''}${user.phone}`
              : t('account.changeNumber.subtitleAdd')
          }
          onPress={handleChangeNumber}
          showChevron
        />
        <SettingsDivider />
        <SettingsItem
          icon="key-outline"
          title={t('account.twoStep.title')}
          subtitle={twoFactorSubtitle}
          onPress={() => router.push('/settings/account/two-factor')}
          showChevron
        />
        <SettingsDivider />
        <SettingsItem
          icon="finger-print"
          title={t('account.passkeys.title')}
          subtitle={t('account.passkeys.subtitle')}
          onPress={() => router.push('/settings/account/passkeys')}
          showChevron
        />
        <SettingsDivider />
        <SettingsItem
          icon="mail-outline"
          title={t('account.email.title')}
          subtitle={user?.email || t('account.email.notSet')}
          onPress={() => router.push('/settings/account/change-email')}
          showChevron
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsItem
          icon="document-text-outline"
          title={t('account.requestData.title')}
          subtitle={t('account.requestData.subtitle')}
          onPress={() => router.push('/settings/account/request-data')}
          showChevron
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsItem
          icon="log-out-outline"
          title={t('account.removeAccount.title')}
          subtitle={t('account.removeAccount.subtitle')}
          onPress={() => router.push('/settings/account/remove-account')}
          showChevron
        />
        <SettingsDivider />
        <SettingsItem
          icon="trash-outline"
          title={t('account.deleteAccount.title')}
          destructive
          onPress={handleDeleteAccount}
          disabled={deleting}
        />
      </SettingsSection>

      <Text style={[styles.footer, { color: colors.textSecondary }]}>
        {t('account.signedInAs', { name: user?.name || 'Unknown' })}
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

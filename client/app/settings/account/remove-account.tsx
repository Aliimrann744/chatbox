import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { settingsApi } from '@/services/api';
import { useAuth } from '@/contexts/auth-context';
import { SettingsScreen, SettingsSection } from '@/components/settings/settings-ui';

export default function RemoveAccountScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const { logout } = useAuth();

  const [busy, setBusy] = useState(false);

  const deactivate = () => {
    Alert.alert(t('removeAccount.title'), t('removeAccount.intro'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('removeAccount.deactivate'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await settingsApi.deactivateAccount();
            await logout();
            router.replace('/(auth)/continue');
          } catch (e: any) {
            Alert.alert(t('common.error'), e?.message || 'Failed');
            setBusy(false);
          }
        },
      },
    ]);
  };

  const schedule = () => {
    Alert.alert(
      t('account.deleteAccount.scheduleTitle'),
      t('account.deleteAccount.scheduleBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.continue'),
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await settingsApi.scheduleDeletion();
              await logout();
              router.replace('/(auth)/continue');
            } catch (e: any) {
              Alert.alert(t('common.error'), e?.message || 'Failed');
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SettingsScreen title={t('removeAccount.title')}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={[styles.body, { color: colors.text }]}>{t('removeAccount.intro')}</Text>

        <Pressable
          onPress={deactivate}
          disabled={busy}
          style={[styles.danger, { borderColor: '#E11D48', opacity: busy ? 0.5 : 1 }]}>
          {busy ? (
            <ActivityIndicator color="#E11D48" />
          ) : (
            <Text style={[styles.dangerText, { color: '#E11D48' }]}>
              {t('removeAccount.deactivate')}
            </Text>
          )}
        </Pressable>

        <Text style={[styles.note, { color: colors.textSecondary, marginTop: 32 }]}>
          {t('removeAccount.scheduleIntro')}
        </Text>
        <Pressable
          onPress={schedule}
          disabled={busy}
          style={[styles.danger, { borderColor: '#E11D48', opacity: busy ? 0.5 : 1 }]}>
          <Text style={[styles.dangerText, { color: '#E11D48' }]}>
            {t('removeAccount.scheduleDeletion')}
          </Text>
        </Pressable>
      </ScrollView>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 22 },
  danger: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dangerText: { fontSize: 16, fontWeight: '600' },
  note: { fontSize: 13, lineHeight: 18 },
});

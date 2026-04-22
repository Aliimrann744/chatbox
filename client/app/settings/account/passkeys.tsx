import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SettingsScreen } from '@/components/settings/settings-ui';

export default function PasskeysScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  return (
    <SettingsScreen title={t('passkeys.title')}>
      <View style={styles.wrap}>
        <View style={[styles.badge, { backgroundColor: colors.backgroundSecondary }]}>
          <Ionicons name="finger-print" size={48} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{t('passkeys.comingSoonTitle')}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {t('passkeys.comingSoonBody')}
        </Text>
      </View>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 32, alignItems: 'center' },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
});

import React, { useEffect, useState } from 'react';
import { Alert, NativeModules, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { cache } from '@/services/cache';
import { settingsApi } from '@/services/api';
import { changeLanguage, LANGUAGE_CACHE_KEY, SUPPORTED_LANGUAGES } from '@/i18n';
import {
  SettingsDivider,
  SettingsRadio,
  SettingsScreen,
  SettingsSection,
} from '@/components/settings/settings-ui';

type LangOption = { value: string; label: string; native: string };

export default function LanguageScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string>('system');

  useEffect(() => {
    const v = cache.get<string>(LANGUAGE_CACHE_KEY);
    if (v) setSelected(v);
  }, []);

  const options: LangOption[] = [
    { value: 'system', label: t('settings.language.deviceLanguage'), native: '' },
    ...SUPPORTED_LANGUAGES.map((l) => ({ value: l.value, label: l.label, native: l.native })),
  ];

  const deviceTag =
    Platform.OS === 'ios'
      ? NativeModules.SettingsManager?.settings?.AppleLocale ||
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
        'en-US'
      : NativeModules.I18nManager?.localeIdentifier || 'en-US';

  const onSelect = async (v: string) => {
    setSelected(v);
    await changeLanguage(v as any);
    // Persist on server (best-effort — falls back silently if offline)
    try {
      await settingsApi.setLanguage(v);
    } catch {}
    Alert.alert(t('settings.language.updated'), '');
  };

  return (
    <SettingsScreen title={t('settings.language.title')}>
      <View style={[styles.banner, { backgroundColor: colors.backgroundSecondary }]}>
        <Text style={[styles.bannerLabel, { color: colors.textSecondary }]}>
          {t('settings.language.deviceLanguage')}
        </Text>
        <Text style={[styles.bannerValue, { color: colors.text }]}>{deviceTag}</Text>
      </View>

      <SettingsSection footer={t('settings.language.footer')}>
        {options.map((l, i) => (
          <React.Fragment key={l.value}>
            {i > 0 ? <SettingsDivider /> : null}
            <SettingsRadio
              title={l.label}
              subtitle={l.native || undefined}
              value={l.value}
              selected={selected === l.value}
              onSelect={onSelect}
            />
          </React.Fragment>
        ))}
      </SettingsSection>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bannerLabel: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
  bannerValue: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
});

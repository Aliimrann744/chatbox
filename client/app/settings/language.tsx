import React, { useEffect, useState } from 'react';
import { Alert, NativeModules, Platform, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { cache } from '@/services/cache';
import {
  SettingsDivider,
  SettingsRadio,
  SettingsScreen,
  SettingsSection,
} from '@/components/settings/settings-ui';

const K_LANG = 'settings:language';

const LANGUAGES: { value: string; label: string; native: string }[] = [
  { value: 'system', label: "Device's language", native: '' },
  { value: 'en', label: 'English', native: 'English' },
  { value: 'es', label: 'Spanish', native: 'Español' },
  { value: 'fr', label: 'French', native: 'Français' },
  { value: 'de', label: 'German', native: 'Deutsch' },
  { value: 'pt', label: 'Portuguese', native: 'Português' },
  { value: 'ar', label: 'Arabic', native: 'العربية' },
  { value: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { value: 'ur', label: 'Urdu', native: 'اردو' },
  { value: 'zh', label: 'Chinese', native: '中文' },
  { value: 'ja', label: 'Japanese', native: '日本語' },
  { value: 'ko', label: 'Korean', native: '한국어' },
];

export default function LanguageScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [selected, setSelected] = useState('system');

  useEffect(() => {
    const v = cache.get<string>(K_LANG);
    if (v) setSelected(v);
  }, []);

  const deviceTag =
    Platform.OS === 'ios'
      ? NativeModules.SettingsManager?.settings?.AppleLocale ||
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
        'en-US'
      : NativeModules.I18nManager?.localeIdentifier || 'en-US';

  const onSelect = (v: string) => {
    setSelected(v);
    cache.set(K_LANG, v);
    Alert.alert(
      'Language updated',
      'Reopen the app for the change to take full effect.',
    );
  };

  return (
    <SettingsScreen title="App language">
      <View style={[styles.banner, { backgroundColor: colors.backgroundSecondary }]}>
        <Text style={[styles.bannerLabel, { color: colors.textSecondary }]}>
          Device language
        </Text>
        <Text style={[styles.bannerValue, { color: colors.text }]}>{deviceTag}</Text>
      </View>

      <SettingsSection>
        {LANGUAGES.map((l, i) => (
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

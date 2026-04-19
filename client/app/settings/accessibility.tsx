import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { cache } from '@/services/cache';
import {
  SettingsDivider,
  SettingsItem,
  SettingsRadio,
  SettingsScreen,
  SettingsSection,
  SettingsToggle,
} from '@/components/settings/settings-ui';

const K = {
  increaseContrast: 'settings:a11y:contrast',
  reduceMotion: 'settings:a11y:reduceMotion',
  fontScale: 'settings:a11y:fontScale',
  boldText: 'settings:a11y:bold',
};

const FONT_SCALES: { value: string; label: string }[] = [
  { value: '0.85', label: 'Small' },
  { value: '1.00', label: 'Default' },
  { value: '1.15', label: 'Large' },
  { value: '1.30', label: 'Extra large' },
];

export default function AccessibilityScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [contrast, setContrast] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [boldText, setBoldText] = useState(false);
  const [fontScale, setFontScale] = useState('1.00');
  const [scalePicker, setScalePicker] = useState(false);

  useEffect(() => {
    const read = <T,>(k: string, def: T) => {
      const v = cache.get<T>(k);
      return (v === null || v === undefined ? def : v) as T;
    };
    setContrast(read(K.increaseContrast, false));
    setReduceMotion(read(K.reduceMotion, false));
    setBoldText(read(K.boldText, false));
    setFontScale(read(K.fontScale, '1.00'));
  }, []);

  const save = (k: string, v: any) => cache.set(k, v);

  const label = FONT_SCALES.find((o) => o.value === fontScale)?.label || 'Default';

  return (
    <SettingsScreen title="Accessibility">
      <SettingsSection title="Display">
        <SettingsToggle
          title="Increase contrast"
          subtitle="Use higher-contrast colors to improve legibility."
          value={contrast}
          onValueChange={(v) => {
            setContrast(v);
            save(K.increaseContrast, v);
          }}
        />
        <SettingsDivider />
        <SettingsToggle
          title="Bold text"
          value={boldText}
          onValueChange={(v) => {
            setBoldText(v);
            save(K.boldText, v);
          }}
        />
        <SettingsDivider />
        <SettingsItem
          title="Font size"
          value={label}
          onPress={() => setScalePicker(true)}
          showChevron
        />
      </SettingsSection>

      <SettingsSection title="Motion">
        <SettingsToggle
          title="Reduce animations"
          subtitle="Minimize screen transitions and on-screen movement."
          value={reduceMotion}
          onValueChange={(v) => {
            setReduceMotion(v);
            save(K.reduceMotion, v);
          }}
        />
      </SettingsSection>

      <SettingsSection
        title="Screen reader"
        footer="This app works with your device's built-in screen reader (VoiceOver / TalkBack).">
        <SettingsItem
          title="Test screen reader"
          onPress={() =>
            Alert.alert(
              'Screen reader',
              'Enable VoiceOver (iOS) or TalkBack (Android) from your device settings to test.',
            )
          }
          showChevron
        />
      </SettingsSection>

      <Modal
        visible={scalePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setScalePicker(false)}>
        <Pressable style={styles.backdrop} onPress={() => setScalePicker(false)}>
          <Pressable style={[styles.card, { backgroundColor: colors.cardBackground }]} onPress={() => {}}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Font size</Text>
            {FONT_SCALES.map((o) => (
              <SettingsRadio
                key={o.value}
                title={o.label}
                value={o.value}
                selected={fontScale === o.value}
                onSelect={(v) => {
                  setFontScale(v);
                  save(K.fontScale, v);
                  setScalePicker(false);
                }}
              />
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: { width: '100%', borderRadius: 14, paddingVertical: 12 },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
});

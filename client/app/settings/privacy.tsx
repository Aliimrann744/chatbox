import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { settingsApi, PrivacySettings } from '@/services/api';
import { cache } from '@/services/cache';
import {
  SettingsDivider,
  SettingsItem,
  SettingsRadio,
  SettingsScreen,
  SettingsSection,
  SettingsToggle,
} from '@/components/settings/settings-ui';

type Privacy = PrivacySettings['lastSeenPrivacy'];
const OPTIONS: { value: Privacy; label: string }[] = [
  { value: 'EVERYONE', label: 'Everyone' },
  { value: 'CONTACTS', label: 'My contacts' },
  { value: 'NOBODY', label: 'Nobody' },
];

const labelFor = (v: Privacy) => OPTIONS.find((o) => o.value === v)?.label || v;

const DISAPPEAR_OPTIONS: { value: string; label: string }[] = [
  { value: 'OFF', label: 'Off' },
  { value: '24H', label: '24 hours' },
  { value: '7D', label: '7 days' },
  { value: '90D', label: '90 days' },
];
const K_DISAPPEAR = 'settings:privacy:disappearing';

export default function PrivacyScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerField, setPickerField] = useState<null | {
    key: 'lastSeenPrivacy' | 'avatarPrivacy' | 'aboutPrivacy';
    title: string;
  }>(null);
  const [disappearing, setDisappearing] = useState<string>('OFF');
  const [disappearingPicker, setDisappearingPicker] = useState(false);

  useEffect(() => {
    settingsApi
      .getPrivacySettings()
      .then(setSettings)
      .catch(() => {
        // Fallback to cached or defaults if server unreachable
        setSettings({
          lastSeenPrivacy: 'EVERYONE',
          avatarPrivacy: 'EVERYONE',
          aboutPrivacy: 'EVERYONE',
          readReceiptsEnabled: true,
        });
      })
      .finally(() => setLoading(false));

    const d = cache.get<string>(K_DISAPPEAR);
    if (d) setDisappearing(d);
  }, []);

  const update = async (patch: Partial<PrivacySettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    try {
      await settingsApi.updatePrivacySettings(patch);
    } catch (e: any) {
      setSettings(settings); // revert
      Alert.alert('Error', e?.message || 'Failed to update privacy settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <SettingsScreen title="Privacy">
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SettingsScreen>
    );
  }

  return (
    <SettingsScreen title="Privacy">
      <SettingsSection
        title="Who can see my personal info"
        footer="If you don't share your last seen, you won't be able to see other people's last seen.">
        <SettingsItem
          title="Last seen and online"
          value={labelFor(settings.lastSeenPrivacy)}
          onPress={() => setPickerField({ key: 'lastSeenPrivacy', title: 'Last seen and online' })}
          showChevron
        />
        <SettingsDivider />
        <SettingsItem
          title="Profile photo"
          value={labelFor(settings.avatarPrivacy)}
          onPress={() => setPickerField({ key: 'avatarPrivacy', title: 'Profile photo' })}
          showChevron
        />
        <SettingsDivider />
        <SettingsItem
          title="About"
          value={labelFor(settings.aboutPrivacy)}
          onPress={() => setPickerField({ key: 'aboutPrivacy', title: 'About' })}
          showChevron
        />
      </SettingsSection>

      <SettingsSection title="Messaging">
        <SettingsToggle
          title="Read receipts"
          subtitle="If turned off, you won't send or receive read receipts."
          value={settings.readReceiptsEnabled}
          onValueChange={(v) => update({ readReceiptsEnabled: v })}
          disabled={saving}
        />
        <SettingsDivider />
        <SettingsItem
          title="Default message timer"
          subtitle="Start new chats with disappearing messages set to your timer"
          value={DISAPPEAR_OPTIONS.find((o) => o.value === disappearing)?.label || 'Off'}
          onPress={() => setDisappearingPicker(true)}
          showChevron
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsItem
          icon="ban-outline"
          title="Blocked contacts"
          onPress={() => router.push('/blocked-users')}
          showChevron
        />
      </SettingsSection>

      {/* Privacy option picker */}
      <Modal
        visible={!!pickerField}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerField(null)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setPickerField(null)}>
          <Pressable
            style={[styles.pickerCard, { backgroundColor: colors.cardBackground }]}
            onPress={() => {}}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>
              {pickerField?.title}
            </Text>
            {OPTIONS.map((o) => (
              <SettingsRadio
                key={o.value}
                title={o.label}
                value={o.value}
                selected={pickerField ? settings[pickerField.key] === o.value : false}
                onSelect={(v: Privacy) => {
                  if (pickerField) update({ [pickerField.key]: v } as Partial<PrivacySettings>);
                  setPickerField(null);
                }}
              />
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Disappearing message picker */}
      <Modal
        visible={disappearingPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setDisappearingPicker(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setDisappearingPicker(false)}>
          <Pressable
            style={[styles.pickerCard, { backgroundColor: colors.cardBackground }]}
            onPress={() => {}}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>
              Default message timer
            </Text>
            {DISAPPEAR_OPTIONS.map((o) => (
              <SettingsRadio
                key={o.value}
                title={o.label}
                value={o.value}
                selected={disappearing === o.value}
                onSelect={(v) => {
                  setDisappearing(v);
                  cache.set(K_DISAPPEAR, v);
                  setDisappearingPicker(false);
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
  loader: { paddingVertical: 60, alignItems: 'center' },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickerCard: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 12,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
});

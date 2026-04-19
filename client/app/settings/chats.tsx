import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

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

type Theme = 'SYSTEM' | 'LIGHT' | 'DARK';
type FontSize = 'SMALL' | 'MEDIUM' | 'LARGE';

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'SYSTEM', label: 'System default' },
  { value: 'LIGHT', label: 'Light' },
  { value: 'DARK', label: 'Dark' },
];
const FONT_OPTIONS: { value: FontSize; label: string }[] = [
  { value: 'SMALL', label: 'Small' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LARGE', label: 'Large' },
];

const K_THEME = 'settings:chats:theme';
const K_FONT = 'settings:chats:fontSize';
const K_ENTER_SEND = 'settings:chats:enterSend';
const K_MEDIA_VISIBILITY = 'settings:chats:mediaVisibility';

export default function ChatsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [theme, setTheme] = useState<Theme>('SYSTEM');
  const [fontSize, setFontSize] = useState<FontSize>('MEDIUM');
  const [enterSend, setEnterSend] = useState(false);
  const [mediaVisibility, setMediaVisibility] = useState(true);
  const [themePicker, setThemePicker] = useState(false);
  const [fontPicker, setFontPicker] = useState(false);

  useEffect(() => {
    const t = cache.get<Theme>(K_THEME);
    const f = cache.get<FontSize>(K_FONT);
    const es = cache.get<boolean>(K_ENTER_SEND);
    const mv = cache.get<boolean>(K_MEDIA_VISIBILITY);
    if (t) setTheme(t);
    if (f) setFontSize(f);
    if (typeof es === 'boolean') setEnterSend(es);
    if (typeof mv === 'boolean') setMediaVisibility(mv);
  }, []);

  const labelFor = (opts: { value: string; label: string }[], v: string) =>
    opts.find((o) => o.value === v)?.label || v;

  const handleClearHistory = () => {
    Alert.alert(
      'Clear all chat history?',
      'All messages will be removed from this device. Server messages may remain.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            cache.clearAll();
            Alert.alert('Done', 'Chat history cleared.');
          },
        },
      ],
    );
  };

  const handleWallpaper = () => {
    Alert.alert('Wallpaper', 'Choose how to set the chat wallpaper.', [
      { text: 'Solid colors', onPress: () => {} },
      { text: 'Bright', onPress: () => {} },
      { text: 'Dark', onPress: () => {} },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <SettingsScreen title="Chats">
      <SettingsSection title="Display">
        <SettingsItem
          title="Theme"
          value={labelFor(THEME_OPTIONS, theme)}
          onPress={() => setThemePicker(true)}
          showChevron
        />
        <SettingsDivider />
        <SettingsItem
          title="Wallpaper"
          onPress={handleWallpaper}
          showChevron
        />
        <SettingsDivider />
        <SettingsItem
          title="Font size"
          value={labelFor(FONT_OPTIONS, fontSize)}
          onPress={() => setFontPicker(true)}
          showChevron
        />
      </SettingsSection>

      <SettingsSection title="Chat settings">
        <SettingsToggle
          title="Enter is send"
          subtitle="Enter key will send your message."
          value={enterSend}
          onValueChange={(v) => {
            setEnterSend(v);
            cache.set(K_ENTER_SEND, v);
          }}
        />
        <SettingsDivider />
        <SettingsToggle
          title="Media visibility"
          subtitle="Show newly downloaded media in your device's gallery."
          value={mediaVisibility}
          onValueChange={(v) => {
            setMediaVisibility(v);
            cache.set(K_MEDIA_VISIBILITY, v);
          }}
        />
      </SettingsSection>

      <SettingsSection title="Chat history">
        <SettingsItem
          icon="archive-outline"
          title="Archive all chats"
          onPress={() =>
            Alert.alert('Archive all chats', 'All chats will be archived.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Archive', onPress: () => {} },
            ])
          }
          showChevron
        />
        <SettingsDivider />
        <SettingsItem
          icon="document-text-outline"
          title="Export chat"
          onPress={() => Alert.alert('Export chat', 'Choose a chat to export from its info page.')}
          showChevron
        />
        <SettingsDivider />
        <SettingsItem
          icon="trash-outline"
          title="Clear all chats"
          destructive
          onPress={handleClearHistory}
        />
      </SettingsSection>

      {/* Theme picker */}
      <Modal visible={themePicker} transparent animationType="fade" onRequestClose={() => setThemePicker(false)}>
        <Pressable style={styles.backdrop} onPress={() => setThemePicker(false)}>
          <Pressable style={[styles.card, { backgroundColor: colors.cardBackground }]} onPress={() => {}}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Theme</Text>
            {THEME_OPTIONS.map((o) => (
              <SettingsRadio
                key={o.value}
                title={o.label}
                value={o.value}
                selected={theme === o.value}
                onSelect={(v: Theme) => {
                  setTheme(v);
                  cache.set(K_THEME, v);
                  setThemePicker(false);
                }}
              />
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Font picker */}
      <Modal visible={fontPicker} transparent animationType="fade" onRequestClose={() => setFontPicker(false)}>
        <Pressable style={styles.backdrop} onPress={() => setFontPicker(false)}>
          <Pressable style={[styles.card, { backgroundColor: colors.cardBackground }]} onPress={() => {}}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Font size</Text>
            {FONT_OPTIONS.map((o) => (
              <SettingsRadio
                key={o.value}
                title={o.label}
                value={o.value}
                selected={fontSize === o.value}
                onSelect={(v: FontSize) => {
                  setFontSize(v);
                  cache.set(K_FONT, v);
                  setFontPicker(false);
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

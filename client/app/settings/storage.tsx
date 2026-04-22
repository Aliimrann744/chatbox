import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { cache } from '@/services/cache';
import {
  SettingsDivider,
  SettingsItem,
  SettingsScreen,
  SettingsSection,
  SettingsToggle,
} from '@/components/settings/settings-ui';

const K = {
  wifiAuto: 'settings:storage:wifiAuto',
  mobileAuto: 'settings:storage:mobileAuto',
  roamingAuto: 'settings:storage:roamingAuto',
  lowDataCalls: 'settings:storage:lowDataCalls',
};

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
};

export default function StorageScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [cacheSize, setCacheSize] = useState<number | null>(null);
  const [wifiAuto, setWifiAuto] = useState(true);
  const [mobileAuto, setMobileAuto] = useState(false);
  const [roamingAuto, setRoamingAuto] = useState(false);
  const [lowDataCalls, setLowDataCalls] = useState(false);

  const loadSize = useCallback(async () => {
    try {
      const cache = Paths.cache;
      if (!cache.exists) {
        setCacheSize(0);
        return;
      }
      // Directory.size reports the recursive byte total.
      setCacheSize(cache.size ?? 0);
    } catch {
      setCacheSize(0);
    }
  }, []);

  useEffect(() => {
    loadSize();
    const read = <T,>(k: string, def: T) => {
      const v = cache.get<T>(k);
      return (v === null || v === undefined ? def : v) as T;
    };
    setWifiAuto(read(K.wifiAuto, true));
    setMobileAuto(read(K.mobileAuto, false));
    setRoamingAuto(read(K.roamingAuto, false));
    setLowDataCalls(read(K.lowDataCalls, false));
  }, [loadSize]);

  const bind = (setter: (v: boolean) => void, key: string) => (v: boolean) => {
    setter(v);
    cache.set(key, v);
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear cached files?',
      'This will remove downloaded media from this device. Messages will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const cache = Paths.cache;
              if (!cache.exists) {
                await loadSize();
                return;
              }
              for (const entry of cache.list()) {
                try {
                  (entry as Directory | File).delete();
                } catch {}
              }
              await loadSize();
              Alert.alert('Done', 'Cache cleared.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to clear cache.');
            }
          },
        },
      ],
    );
  };

  return (
    <SettingsScreen title="Storage and data">
      <SettingsSection title="Storage">
        <View style={styles.storageCard}>
          <Text style={[styles.storageLabel, { color: colors.textSecondary }]}>Cache used</Text>
          <Text style={[styles.storageValue, { color: colors.text }]}>
            {cacheSize === null ? '…' : formatBytes(cacheSize)}
          </Text>
        </View>
        <SettingsDivider />
        <SettingsItem
          icon="refresh-outline"
          title="Manage storage"
          subtitle="Review and delete items that take up the most space"
          onPress={handleClearCache}
          showChevron
        />
      </SettingsSection>

      <SettingsSection title="Media auto-download" footer="Voice messages are always downloaded.">
        <SettingsToggle
          title="When using Wi-Fi"
          value={wifiAuto}
          onValueChange={bind(setWifiAuto, K.wifiAuto)}
        />
        <SettingsDivider />
        <SettingsToggle
          title="When using mobile data"
          value={mobileAuto}
          onValueChange={bind(setMobileAuto, K.mobileAuto)}
        />
        <SettingsDivider />
        <SettingsToggle
          title="When roaming"
          value={roamingAuto}
          onValueChange={bind(setRoamingAuto, K.roamingAuto)}
        />
      </SettingsSection>

      <SettingsSection title="Call settings">
        <SettingsToggle
          title="Use less data for calls"
          subtitle="Reduces call quality to save data when on slow connections."
          value={lowDataCalls}
          onValueChange={bind(setLowDataCalls, K.lowDataCalls)}
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsItem
          icon="stats-chart-outline"
          title="Network usage"
          subtitle="Sent and received data"
          onPress={() =>
            Alert.alert(
              'Network usage',
              'Detailed network stats are not yet available on this device.',
            )
          }
          showChevron
        />
      </SettingsSection>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  storageCard: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  storageLabel: {
    fontSize: 13,
  },
  storageValue: {
    fontSize: 28,
    fontWeight: '600',
    marginTop: 4,
  },
});

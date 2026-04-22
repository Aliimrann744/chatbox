import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { LoginEvent, settingsApi } from '@/services/api';
import { cache } from '@/services/cache';
import {
  SettingsDivider,
  SettingsItem,
  SettingsScreen,
  SettingsSection,
  SettingsToggle,
} from '@/components/settings/settings-ui';

const K = 'settings:account:securityNotifs';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function SecurityNotificationsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  const [enabled, setEnabled] = useState<boolean>(true);
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cached = cache.get<boolean>(K);
      if (typeof cached === 'boolean') setEnabled(cached);
      const res = await settingsApi.getLoginEvents(20);
      setEvents(res.events);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (v: boolean) => {
    setEnabled(v);
    cache.set(K, v);
    try {
      await settingsApi.setSecurityNotifications(v);
    } catch {
      setEnabled(!v);
      cache.set(K, !v);
    }
  };

  return (
    <SettingsScreen title={t('securityNotifications.title')}>
      <SettingsSection footer={t('securityNotifications.intro')}>
        <SettingsToggle
          icon="shield-checkmark-outline"
          title={t('securityNotifications.title')}
          value={enabled}
          onValueChange={toggle}
        />
      </SettingsSection>

      <SettingsSection title={t('securityNotifications.recentLogins')}>
        {loading ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : events.length === 0 ? (
          <View style={{ padding: 24 }}>
            <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
              {t('securityNotifications.noEvents')}
            </Text>
          </View>
        ) : (
          events.map((e, i) => (
            <React.Fragment key={e.id}>
              {i > 0 ? <SettingsDivider /> : null}
              <SettingsItem
                icon={e.isNewDevice ? 'warning-outline' : 'checkmark-done-outline'}
                iconColor={e.isNewDevice ? '#E11D48' : undefined}
                title={e.device || e.method}
                subtitle={`${formatTime(e.createdAt)}${e.ipAddress ? ' · ' + e.ipAddress : ''}`}
              />
            </React.Fragment>
          ))
        )}
      </SettingsSection>
    </SettingsScreen>
  );
}

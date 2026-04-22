import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DataExportRequest, settingsApi } from '@/services/api';
import { useAuth } from '@/contexts/auth-context';
import {
  SettingsDivider,
  SettingsItem,
  SettingsScreen,
  SettingsSection,
} from '@/components/settings/settings-ui';

const POLL_INTERVAL_MS = 5000;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function RequestDataScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const { user } = useAuth();

  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<DataExportRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await settingsApi.listDataExports(10);
      setRequests(r.requests);
    } catch {
      // Keep whatever we had.
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll every 5s while any request is still pending or running so the UI
  // reflects completion without the user having to refresh manually.
  useEffect(() => {
    const hasActive = requests.some((r) => r.status === 'PENDING' || r.status === 'RUNNING');
    if (!hasActive) return;
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [requests, load]);

  const request = async () => {
    if (!user?.email) {
      Alert.alert(t('requestData.noEmail'), '');
      return;
    }
    setBusy(true);
    try {
      const r = await settingsApi.requestDataExport();
      Alert.alert(r.alreadyQueued ? t('requestData.alreadyQueued') : t('requestData.queued'), '');
      await load();
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (s: DataExportRequest['status']) =>
    t(`requestData.status.${s}`);

  const statusColor = (s: DataExportRequest['status']) => {
    switch (s) {
      case 'COMPLETED':
        return colors.primary;
      case 'FAILED':
        return '#E11D48';
      case 'RUNNING':
        return '#F59E0B';
      default:
        return colors.textSecondary;
    }
  };

  return (
    <SettingsScreen title={t('requestData.title')}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={[styles.body, { color: colors.text }]}>{t('requestData.intro')}</Text>
        <Pressable
          onPress={request}
          disabled={busy}
          style={[styles.primary, { backgroundColor: colors.primary, opacity: busy ? 0.5 : 1 }]}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>{t('requestData.request')}</Text>
          )}
        </Pressable>
      </ScrollView>

      <SettingsSection title={t('requestData.history')}>
        {loadingHistory ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : requests.length === 0 ? (
          <View style={{ padding: 24 }}>
            <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
              {t('requestData.noRequests')}
            </Text>
          </View>
        ) : (
          requests.map((r, i) => (
            <React.Fragment key={r.id}>
              {i > 0 ? <SettingsDivider /> : null}
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>
                    {formatDateTime(r.requestedAt)}
                  </Text>
                  <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                    {r.status === 'COMPLETED' && r.sentTo
                      ? t('requestData.sentTo', { email: r.sentTo })
                      : r.error || ''}
                  </Text>
                </View>
                <Text style={[styles.status, { color: statusColor(r.status) }]}>
                  {statusLabel(r.status)}
                </Text>
              </View>
            </React.Fragment>
          ))
        )}
      </SettingsSection>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 22 },
  primary: {
    marginTop: 24,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
    gap: 12,
  },
  rowTitle: { fontSize: 15 },
  rowSubtitle: { fontSize: 13, marginTop: 3 },
  status: { fontSize: 13, fontWeight: '600' },
});

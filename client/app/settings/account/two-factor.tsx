import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { twoFactorApi, TwoFactorStatus } from '@/services/api';
import {
  SettingsDivider,
  SettingsItem,
  SettingsScreen,
  SettingsSection,
} from '@/components/settings/settings-ui';

type Stage = 'status' | 'choose-method' | 'totp-setup' | 'totp-verify' | 'backup-codes' | 'disable-otp';

export default function TwoFactorScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  const [stage, setStage] = useState<Stage>('status');
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [totpSetup, setTotpSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await twoFactorApi.getStatus();
      setStatus(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startTotp = async () => {
    setBusy(true);
    try {
      const r = await twoFactorApi.setupTotp();
      setTotpSetup({ secret: r.secret, qrDataUrl: r.qrDataUrl });
      setCode('');
      setStage('totp-verify');
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || 'Failed to start setup');
    } finally {
      setBusy(false);
    }
  };

  const verifyTotp = async () => {
    setBusy(true);
    try {
      const r = await twoFactorApi.verifyTotpSetup(code.trim());
      setBackupCodes(r.backupCodes);
      setStage('backup-codes');
      setCode('');
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || 'Invalid code');
    } finally {
      setBusy(false);
    }
  };

  const enableEmail = async () => {
    setBusy(true);
    try {
      const r = await twoFactorApi.enableEmailOtp();
      setBackupCodes(r.backupCodes);
      setStage('backup-codes');
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || 'Failed to enable email 2FA');
    } finally {
      setBusy(false);
    }
  };

  const requestDisable = async () => {
    setBusy(true);
    try {
      await twoFactorApi.requestDisable();
      setCode('');
      setStage('disable-otp');
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || 'Failed to send code');
    } finally {
      setBusy(false);
    }
  };

  const confirmDisable = async () => {
    setBusy(true);
    try {
      await twoFactorApi.confirmDisable(code.trim());
      await load();
      setStage('status');
      setCode('');
      Alert.alert(t('common.done'), '');
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || 'Invalid code');
    } finally {
      setBusy(false);
    }
  };

  const regenerateBackupCodes = async () => {
    setBusy(true);
    try {
      const r = await twoFactorApi.regenerateBackupCodes();
      setBackupCodes(r.backupCodes);
      setStage('backup-codes');
      await load();
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || 'Failed to regenerate');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert(t('common.copied'), '');
  };

  if (loading || !status) {
    return (
      <SettingsScreen title={t('twoFactor.title')}>
        <View style={{ padding: 32, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SettingsScreen>
    );
  }

  if (stage === 'status') {
    if (status.enabled) {
      const methodKey =
        status.method === 'TOTP'
          ? t('twoFactor.methods.totp')
          : status.method === 'EMAIL'
          ? t('twoFactor.methods.email')
          : t('twoFactor.methods.none');
      return (
        <SettingsScreen title={t('twoFactor.title')}>
          <SettingsSection footer={t('twoFactor.enabled', { method: methodKey })}>
            <SettingsItem
              icon="shield-checkmark-outline"
              title={t('twoFactor.status')}
              value={methodKey}
            />
          </SettingsSection>
          <SettingsSection>
            <SettingsItem
              icon="refresh-outline"
              title={t('twoFactor.regenerateBackupCodes')}
              subtitle={t('twoFactor.backupCodesRemaining', { count: status.backupCodesRemaining })}
              onPress={regenerateBackupCodes}
              showChevron
              disabled={busy}
            />
            <SettingsDivider />
            <SettingsItem
              icon="close-circle-outline"
              title={t('common.disable')}
              destructive
              onPress={() =>
                Alert.alert(
                  t('twoFactor.confirmDisableTitle'),
                  t('twoFactor.confirmDisableBody'),
                  [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('common.continue'), onPress: requestDisable },
                  ],
                )
              }
              disabled={busy}
            />
          </SettingsSection>
        </SettingsScreen>
      );
    }
    return (
      <SettingsScreen title={t('twoFactor.title')}>
        <SettingsSection title={t('twoFactor.chooseMethod')}>
          <SettingsItem
            icon="phone-portrait-outline"
            title={t('twoFactor.methods.totp')}
            subtitle={t('twoFactor.authenticatorSubtitle')}
            onPress={startTotp}
            showChevron
            disabled={busy}
          />
          <SettingsDivider />
          <SettingsItem
            icon="mail-outline"
            title={t('twoFactor.methods.email')}
            subtitle={t('twoFactor.emailSubtitle')}
            onPress={enableEmail}
            showChevron
            disabled={busy}
          />
        </SettingsSection>
      </SettingsScreen>
    );
  }

  if (stage === 'totp-verify' && totpSetup) {
    return (
      <SettingsScreen title={t('twoFactor.title')}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {t('twoFactor.scanQr')}
          </Text>
          <View style={[styles.qrBox, { backgroundColor: '#fff', borderColor: colors.border }]}>
            <Image source={{ uri: totpSetup.qrDataUrl }} style={{ width: 200, height: 200 }} />
          </View>
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>
            {t('twoFactor.orEnterSecret')}
          </Text>
          <Pressable onPress={() => copy(totpSetup.secret)}>
            <Text selectable style={[styles.secret, { color: colors.text, borderColor: colors.border }]}>
              {totpSetup.secret}
            </Text>
          </Pressable>
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 20 }]}>
            {t('twoFactor.enterCode')}
          </Text>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            placeholder={t('twoFactor.enterCodePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            maxLength={6}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <Pressable
            onPress={verifyTotp}
            disabled={busy || code.length !== 6}
            style={[styles.primary, { backgroundColor: colors.primary, opacity: busy || code.length !== 6 ? 0.5 : 1 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('twoFactor.verifyAndEnable')}</Text>}
          </Pressable>
        </ScrollView>
      </SettingsScreen>
    );
  }

  if (stage === 'backup-codes' && backupCodes) {
    return (
      <SettingsScreen title={t('twoFactor.backupCodes')}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={[styles.body, { color: colors.text }]}>{t('twoFactor.backupCodesIntro')}</Text>
          <View style={[styles.codeGrid, { borderColor: colors.border }]}>
            {backupCodes.map((c) => (
              <Text key={c} style={[styles.codeItem, { color: colors.text }]}>
                {c}
              </Text>
            ))}
          </View>
          <Pressable
            onPress={() => copy(backupCodes.join('\n'))}
            style={[styles.secondary, { borderColor: colors.primary }]}>
            <Text style={[styles.secondaryText, { color: colors.primary }]}>{t('common.copy')}</Text>
          </Pressable>
          <Pressable
            onPress={() => { setStage('status'); setBackupCodes(null); load(); }}
            style={[styles.primary, { backgroundColor: colors.primary }]}>
            <Text style={styles.primaryText}>{t('common.done')}</Text>
          </Pressable>
        </ScrollView>
      </SettingsScreen>
    );
  }

  if (stage === 'disable-otp') {
    return (
      <SettingsScreen title={t('twoFactor.title')}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={[styles.body, { color: colors.text }]}>
            {t('twoFactor.enterDisableCode')}
          </Text>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            placeholder={t('twoFactor.enterCodePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            maxLength={6}
            style={[styles.input, { color: colors.text, borderColor: colors.border, marginTop: 16 }]}
          />
          <Pressable
            onPress={confirmDisable}
            disabled={busy || code.length !== 6}
            style={[styles.primary, { backgroundColor: '#E11D48', opacity: busy || code.length !== 6 ? 0.5 : 1 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('common.disable')}</Text>}
          </Pressable>
        </ScrollView>
      </SettingsScreen>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  body: { fontSize: 15, lineHeight: 22 },
  qrBox: {
    alignSelf: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  secret: {
    fontSize: 16,
    fontFamily: 'Courier',
    letterSpacing: 2,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    letterSpacing: 4,
    textAlign: 'center',
  },
  primary: {
    marginTop: 16,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondary: {
    marginTop: 16,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryText: { fontSize: 15, fontWeight: '600' },
  codeGrid: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  codeItem: {
    fontSize: 15,
    fontFamily: 'Courier',
    letterSpacing: 1,
    width: '48%',
    paddingVertical: 6,
    textAlign: 'center',
  },
});

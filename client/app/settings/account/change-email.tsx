import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { settingsApi } from '@/services/api';
import { useAuth } from '@/contexts/auth-context';
import { SettingsScreen } from '@/components/settings/settings-ui';

type Stage = 'enter-email' | 'enter-code';

export default function ChangeEmailScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const { refreshUser } = useAuth();

  const [stage, setStage] = useState<Stage>('enter-email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    setBusy(true);
    try {
      await settingsApi.requestEmailChange(clean);
      setStage('enter-code');
      setCode('');
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || 'Failed to send code');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    try {
      await settingsApi.verifyEmailChange(code.trim());
      await refreshUser();
      Alert.alert(t('changeEmail.updated'), '');
      router.back();
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || 'Invalid code');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsScreen title={t('changeEmail.title')}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {stage === 'enter-email' ? (
          <>
            <Text style={[styles.body, { color: colors.text }]}>{t('changeEmail.intro')}</Text>
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>
              {t('changeEmail.newEmail')}
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t('changeEmail.emailPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <Pressable
              onPress={sendCode}
              disabled={busy || !email.trim()}
              style={[
                styles.primary,
                { backgroundColor: colors.primary, opacity: busy || !email.trim() ? 0.5 : 1 },
              ]}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>{t('changeEmail.sendCode')}</Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.body, { color: colors.text }]}>
              {t('changeEmail.enterCode', { email })}
            </Text>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              maxLength={6}
              style={[
                styles.input,
                { color: colors.text, borderColor: colors.border, marginTop: 16, textAlign: 'center', letterSpacing: 4, fontSize: 22 },
              ]}
            />
            <Pressable
              onPress={verify}
              disabled={busy || code.length !== 6}
              style={[
                styles.primary,
                { backgroundColor: colors.primary, opacity: busy || code.length !== 6 ? 0.5 : 1 },
              ]}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>{t('changeEmail.verify')}</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 22 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  primary: {
    marginTop: 20,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

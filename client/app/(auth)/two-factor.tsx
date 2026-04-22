import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import { authApi } from '@/services/api';

type Method = 'totp' | 'email' | 'backup';

export default function TwoFactorChallengeScreen() {
  const { challengeToken, method: serverMethod, loginMode } = useLocalSearchParams<{
    challengeToken: string;
    method: 'EMAIL' | 'TOTP';
    loginMode?: string;
  }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { completeTwoFactor } = useAuth();

  const initialMethod: Method = serverMethod === 'EMAIL' ? 'email' : 'totp';
  const [method, setMethod] = useState<Method>(initialMethod);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const cleaned = method === 'backup' ? code.trim().toUpperCase() : code.trim();
    if (!cleaned) return;
    setSubmitting(true);
    try {
      const { isNewUser } = await completeTwoFactor(challengeToken, cleaned, method);
      router.replace({
        pathname: '/(auth)/loading',
        params: { isNewUser: isNewUser ? '1' : '0', loginMode: loginMode || 'phone' },
      });
    } catch (e: any) {
      Alert.alert('Verification failed', e?.message || 'Invalid code');
      setCode('');
    } finally {
      setSubmitting(false);
    }
  };

  const resendEmail = async () => {
    try {
      await authApi.resendTwoFactorEmail(challengeToken);
      Alert.alert('Code sent', 'We sent a new code to your email.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not resend code');
    }
  };

  const description = {
    totp: 'Open your authenticator app and enter the 6-digit code.',
    email: 'Enter the code we sent to your registered email.',
    backup: 'Enter one of your backup codes (one-time use).',
  }[method];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={[styles.title, { color: colors.text }]}>Two-step verification</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>

      <TextInput
        value={code}
        onChangeText={(t) => setCode(method === 'backup' ? t.toUpperCase() : t.replace(/\D/g, ''))}
        placeholder={method === 'backup' ? 'ABCDE-12345' : '123456'}
        placeholderTextColor={colors.textSecondary}
        keyboardType={method === 'backup' ? 'default' : 'number-pad'}
        autoCapitalize="characters"
        maxLength={method === 'backup' ? 11 : 6}
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
      />

      <Pressable
        onPress={submit}
        disabled={submitting || !code.trim()}
        style={[styles.primary, { backgroundColor: colors.primary, opacity: submitting || !code.trim() ? 0.5 : 1 }]}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Verify</Text>}
      </Pressable>

      <View style={styles.methods}>
        {initialMethod === 'email' ? (
          <Pressable onPress={resendEmail} style={styles.link}>
            <Text style={[styles.linkText, { color: colors.primary }]}>Resend code</Text>
          </Pressable>
        ) : null}
        {method !== 'backup' ? (
          <Pressable onPress={() => { setMethod('backup'); setCode(''); }} style={styles.link}>
            <Text style={[styles.linkText, { color: colors.primary }]}>Use a backup code</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => { setMethod(initialMethod); setCode(''); }} style={styles.link}>
            <Text style={[styles.linkText, { color: colors.primary }]}>
              {initialMethod === 'email' ? 'Use email code' : 'Use authenticator app'}
            </Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 8 },
  description: { fontSize: 14, marginBottom: 24, lineHeight: 20 },
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
    marginTop: 20,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  methods: { marginTop: 24, alignItems: 'center', gap: 12 },
  link: { paddingVertical: 6 },
  linkText: { fontSize: 14, fontWeight: '500' },
});

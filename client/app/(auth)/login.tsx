import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

type LoginMode = 'phone' | 'email';

export default function LoginScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { sendOtp } = useAuth();

  const [loginMode, setLoginMode] = useState<LoginMode>('phone');
  const [countryCode, setCountryCode] = useState('+92');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; email?: string }>({});

  const validate = () => {
    const newErrors: typeof errors = {};

    if (loginMode === 'phone') {
      const cleaned = phone.replace(/\D/g, '');
      if (!cleaned) {
        newErrors.phone = 'Phone number is required';
      } else if (cleaned.length < 7 || cleaned.length > 15) {
        newErrors.phone = 'Please enter a valid phone number';
      }
    } else {
      const trimmed = email.trim();
      if (!trimmed) {
        newErrors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        newErrors.email = 'Please enter a valid email address';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (!validate()) return;

    setIsLoading(true);
    try {
      if (loginMode === 'phone') {
        const cleaned = phone?.replace(/\D/g, '')?.replace(/^0/, '');
        await sendOtp({ phone: cleaned, countryCode });
        router.push({
          pathname: '/(auth)/verify-otp',
          params: { phone: cleaned, countryCode, loginMode: 'phone' },
        });
      } else {
        const trimmed = email.trim();
        await sendOtp({ email: trimmed });
        router.push({
          pathname: '/(auth)/verify-otp',
          params: { email: trimmed, loginMode: 'email' },
        });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Text style={[styles.appName, { color: colors.text }]}>WhatsApp</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            Connect with friends and family
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={[styles.title, { color: colors.text }]}>
            {loginMode === 'phone' ? 'Enter Your Phone Number' : 'Enter Your Email'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {loginMode === 'phone'
              ? "We'll send you a verification code via WhatsApp"
              : "We'll send you a verification code via email"}
          </Text>

          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <Pressable
              style={[
                styles.modeButton,
                loginMode === 'phone' && { backgroundColor: colors.primary },
                loginMode !== 'phone' && { backgroundColor: colors.inputBackground, borderColor: colors.border, borderWidth: 1 },
              ]}
              onPress={() => { setLoginMode('phone'); setErrors({}); }}>
              <Text style={[styles.modeButtonText, { color: loginMode === 'phone' ? '#ffffff' : colors.textSecondary }]}>
                Phone
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.modeButton,
                loginMode === 'email' && { backgroundColor: colors.primary },
                loginMode !== 'email' && { backgroundColor: colors.inputBackground, borderColor: colors.border, borderWidth: 1 },
              ]}
              onPress={() => { setLoginMode('email'); setErrors({}); }}>
              <Text style={[styles.modeButtonText, { color: loginMode === 'email' ? '#ffffff' : colors.textSecondary }]}>
                Email
              </Text>
            </Pressable>
          </View>

          {loginMode === 'phone' ? (
            /* Phone Input */
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Phone Number</Text>
              <View style={styles.phoneRow}>
                {/* Country Code */}
                <View
                  style={[
                    styles.countryCodeContainer,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.border,
                    },
                  ]}>
                  <TextInput
                    style={[styles.countryCodeInput, { color: colors.text }]}
                    value={countryCode}
                    onChangeText={setCountryCode}
                    keyboardType="phone-pad"
                    maxLength={5}
                  />
                </View>

                {/* Phone Number */}
                <View
                  style={[
                    styles.phoneContainer,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: errors.phone ? '#ef4444' : colors.border,
                    },
                  ]}>
                  <IconSymbol name="phone.fill" size={20} color={colors.textSecondary} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="Phone number"
                    placeholderTextColor={colors.textSecondary}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    autoFocus
                  />
                </View>
              </View>
              {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
            </View>
          ) : (
            /* Email Input */
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Email Address</Text>
              <View
                style={[
                  styles.emailContainer,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: errors.email ? '#ef4444' : colors.border,
                  },
                ]}>
                <IconSymbol name="envelope.fill" size={20} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Enter your email"
                  placeholderTextColor={colors.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
              </View>
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>
          )}

          {/* Next Button */}
          <Pressable
            style={[
              styles.button,
              { backgroundColor: colors.primary },
              isLoading && styles.buttonDisabled,
            ]}
            onPress={handleNext}
            disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Next</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
  },
  form: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  modeToggle: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  modeButton: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
  },
  countryCodeContainer: {
    width: 72,
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  countryCodeInput: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  phoneContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    gap: 12,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  button: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

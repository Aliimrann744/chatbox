import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

const OTP_LENGTH = 6;
export default function VerifyOtpScreen() {
  const { phone, countryCode, email, loginMode } = useLocalSearchParams<{
    phone?: string;
    countryCode?: string;
    email?: string;
    loginMode: 'phone' | 'email';
  }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { verifyOtp, sendOtp } = useAuth();
  const [resendLoading, setResetLoading] = useState(false);
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const isEmailMode = loginMode === 'email';
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Timer for resend
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) {
      // Handle paste
      const pastedCode = value.slice(0, OTP_LENGTH).split('');
      const newOtp = [...otp];
      pastedCode.forEach((char, i) => {
        if (i < OTP_LENGTH) {
          newOtp[i] = char;
        }
      });
      setOtp(newOtp);
      const lastIndex = Math.min(pastedCode.length - 1, OTP_LENGTH - 1);
      inputRefs.current[lastIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Move to next input
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpString = otp.join('');
    if (otpString.length !== OTP_LENGTH) {
      Alert.alert('Invalid OTP', 'Please enter the complete 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      const verifyParams = isEmailMode ? { email: email! } : { phone: phone! };
      const { isNewUser } = await verifyOtp(verifyParams, otpString);
      router.replace({
        pathname: '/(auth)/loading',
        params: { isNewUser: isNewUser ? '1' : '0', loginMode },
      });
    } catch (error: any) {
      Alert.alert('Verification Failed', error.message || 'Invalid or expired OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setResetLoading(true);
    try {
      if (isEmailMode) {
        await sendOtp({ email: email! });
      } else {
        await sendOtp({ phone: phone!, countryCode });
      }
      setCanResend(false);
      setResendTimer(60);
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      Alert.alert('OTP Sent', isEmailMode
        ? 'A new verification code has been sent to your email'
        : 'A new verification code has been sent via WhatsApp');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend OTP');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
            <Text style={styles.iconText}>OTP</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {isEmailMode ? 'Verify Your Email' : 'Verify Your Number'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {isEmailMode
              ? "We've sent a 6-digit verification code to"
              : "We've sent a 6-digit verification code via WhatsApp to"}
          </Text>
          <Text style={[styles.phoneDisplay, { color: colors.accent }]}>
            {isEmailMode ? email : `${countryCode} ${phone}`}
          </Text>
        </View>

        {/* OTP Inputs */}
        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={[
                styles.otpInput,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: digit ? colors.primary : colors.border,
                  color: colors.text,
                },
              ]}
              value={digit}
              onChangeText={(value) => handleOtpChange(value, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              autoFocus={index === 0}
            />
          ))}
        </View>

        {/* Timer */}
        <View style={styles.timerContainer}>
          {canResend ? (
            <Pressable onPress={handleResend} disabled={resendLoading}>
              <Text style={[styles.resendText, { color: colors.accent }]}>
                Resend Code {resendLoading ? <ActivityIndicator color={colors.accent} /> : ""}
              </Text>
            </Pressable>
          ) : (
            <Text style={[styles.timerText, { color: colors.textSecondary }]}>
              Resend code in <Text style={{ color: colors.accent }}>{resendTimer}s</Text>
            </Text>
          )}
        </View>

        {/* Verify Button */}
        <Pressable
          style={[
            styles.button,
            { backgroundColor: colors.primary },
            isLoading && styles.buttonDisabled,
          ]}
          onPress={handleVerify}
          disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Verify & Continue</Text>
          )}
        </Pressable>

        {/* Change Number/Email */}
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.textSecondary }]}>
            {isEmailMode ? 'Change email' : 'Change number'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  phoneDisplay: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  otpInput: {
    width: 50,
    height: 56,
    borderWidth: 2,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  timerText: {
    fontSize: 14,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600',
    alignItems: 'center',
    display: "flex",
    gap: 1,
  },
  button: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
    padding: 12,
  },
  backText: {
    fontSize: 14,
  },
});

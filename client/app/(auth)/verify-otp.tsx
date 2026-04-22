import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

const OTP_LENGTH = 6;
const ACCENT = '#00A884';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function VerifyOtpScreen() {
  const { phone, countryCode, email, loginMode } = useLocalSearchParams<{ phone?: string; countryCode?: string; email?: string; loginMode: 'phone' | 'email'; }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { verifyOtp, sendOtp } = useAuth();

  const isEmailMode = loginMode === 'email';

  // OTP state
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const hiddenInputRef = useRef<TextInput>(null);

  // Resend drawer state
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [resendSelected, setResendSelected] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const drawerAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  // Timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer((t) => t - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  // Auto-verify when all 6 digits entered
  useEffect(() => {
    if (otp.length === OTP_LENGTH && !isVerifying) {
      const timeout = setTimeout(() => handleVerify(otp), 500);
      return () => clearTimeout(timeout);
    }
  }, [otp]);

  const displayIdentifier = isEmailMode ? email : `${countryCode} ${phone}`;
  const handleOtpChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtp(cleaned);
  };

  const handleVerify = async (otpString: string) => {
    if (otpString.length !== OTP_LENGTH) return;
    setIsVerifying(true);
    try {
      const verifyParams = isEmailMode ? { email: email! } : { phone: phone! };
      const result = await verifyOtp(verifyParams, otpString);
      if ('twoFactorRequired' in result) {
        router.replace({
          pathname: '/(auth)/two-factor',
          params: {
            challengeToken: result.challengeToken,
            method: result.method,
            loginMode,
          },
        });
        return;
      }
      router.replace({
        pathname: '/(auth)/loading',
        params: { isNewUser: result.isNewUser ? '1' : '0', loginMode },
      });
    } catch (error: any) {
      setOtp('');
      hiddenInputRef.current?.focus();
      Alert.alert('Verification Failed', error.message || 'Invalid or expired OTP');
    } finally {
      setIsVerifying(false);
    }
  };

  const openDrawer = useCallback(() => {
    setDrawerVisible(true);
    setResendSelected(false);
    Animated.parallel([
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(drawerAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const closeDrawer = useCallback(() => {
    Animated.parallel([
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(drawerAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDrawerVisible(false);
    });
  }, []);

  const handleResendContinue = async () => {
    if (!canResend || !resendSelected) return;

    setIsResending(true);
    try {
      if (isEmailMode) {
        await sendOtp({ email: email! });
      } else {
        await sendOtp({ phone: phone!, countryCode });
      }
      setCanResend(false);
      setResendTimer(60);
      setOtp('');
      closeDrawer();
      setTimeout(() => {
        hiddenInputRef.current?.focus();
      }, 300);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend code');
    } finally {
      setIsResending(false);
    }
  };

  // Format timer
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs} seconds`;
  };

  // ─── Render OTP Slots ──────────────────────────────────────────────────────

  const renderOtpSlots = () => {
    const slots = [];
    for (let i = 0; i < OTP_LENGTH; i++) {
      // Add gap between slot 2 and 3 (3+3 grouping)
      if (i === 3) {
        slots.push(<View key="spacer" style={styles.otpSpacer} />);
      }
      const digit = otp[i];
      slots.push(
        <View key={i} style={styles.otpSlot}>
          <Text style={[styles.otpDigit, { color: colors.text }]}>
            {digit || ''}
          </Text>
          {!digit && <View style={styles.otpDash} />}
        </View>,
      );
    }
    return slots;
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Help Icon — top right */}
      <Pressable
        style={[styles.helpButton, { top: insets.top + 8 }]}
        hitSlop={12}>
        <Ionicons name="help-circle-outline" size={26} color={colors.textSecondary} />
      </Pressable>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.content, { paddingTop: insets.top + 48 }]}>
          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            {isEmailMode ? 'Verifying your email' : 'Verifying your number'}
          </Text>

          {/* Subtitle with "Wrong number?" link */}
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {isEmailMode
              ? 'Waiting to automatically detect 6-digit code sent to '
              : 'Waiting to automatically detect 6-digit code sent by SMS to '}
            <Text style={[styles.boldText, { color: colors.text }]}>
              {displayIdentifier}
            </Text>
            .{' '}
            <Text style={styles.wrongNumberLink} onPress={() => router.back()}>
              Wrong number?
            </Text>
          </Text>

          {/* OTP Input Area */}
          <Pressable
            style={styles.otpArea}
            onPress={() => hiddenInputRef.current?.focus()}>
            {/* Hidden TextInput */}
            <TextInput
              ref={hiddenInputRef}
              style={styles.hiddenInput}
              value={otp}
              onChangeText={handleOtpChange}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              autoFocus
              caretHidden
            />

            {/* Visual OTP Slots */}
            <View style={styles.otpSlotsRow}>
              {renderOtpSlots()}
            </View>

            {/* Underline */}
            <View style={[styles.otpUnderline, { backgroundColor: colors.border }]} />
          </Pressable>

          {/* Loading indicator during verification */}
          {isVerifying && (
            <View style={styles.verifyingContainer}>
              <ActivityIndicator color={ACCENT} size="small" />
            </View>
          )}

          {/* "Didn't receive code?" link */}
          <Pressable onPress={openDrawer} style={styles.didntReceiveButton}>
            <Text style={styles.didntReceiveText}>Didn't receive code?</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* ─── Resend Code Bottom Drawer ──────────────────────────────────────── */}
      <Modal visible={drawerVisible} transparent animationType="none">
        {/* Overlay */}
        <Animated.View
          style={[styles.drawerOverlay, { opacity: overlayAnim }]}>
          <Pressable style={{ flex: 1 }} onPress={closeDrawer} />
        </Animated.View>

        {/* Drawer */}
        <Animated.View
          style={[
            styles.drawer,
            {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + 16,
              transform: [{ translateY: drawerAnim }],
            },
          ]}>
          {/* Handle pill */}
          <View style={styles.drawerHandleContainer}>
            <View style={[styles.drawerHandle, { backgroundColor: colors.border }]} />
          </View>

          {/* Resend Option */}
          <Pressable
            style={[
              styles.resendOption,
              !canResend && styles.resendOptionDisabled,
            ]}
            onPress={() => canResend && setResendSelected(!resendSelected)}
            disabled={!canResend}>
            {/* SMS Icon */}
            <View style={styles.resendIconContainer}>
              <Ionicons
                name="chatbox-outline"
                size={24}
                color={canResend ? colors.textSecondary : colors.border}
              />
            </View>

            {/* Text */}
            <View style={styles.resendTextContainer}>
              <Text
                style={[
                  styles.resendOptionTitle,
                  { color: canResend ? colors.text : colors.textSecondary },
                  !canResend && styles.resendOptionTitleDisabled,
                ]}>
                {isEmailMode ? 'Receive new email' : 'Receive new SMS'}
              </Text>
              <Text
                style={[
                  styles.resendOptionSubtitle,
                  { color: colors.textSecondary },
                ]}>
                {canResend
                  ? 'Tap to select, then continue'
                  : `Try again in ${formatTimer(resendTimer)}`}
              </Text>
            </View>

            {/* Radio Button */}
            <View
              style={[
                styles.radioOuter,
                {
                  borderColor: canResend ? resendSelected ? ACCENT : colors.textSecondary : colors.border,
                },
              ]}>
              {resendSelected && canResend && (
                <View style={[styles.radioInner, { backgroundColor: ACCENT }]} />
              )}
            </View>
          </Pressable>

          {/* Continue Button */}
          <View style={styles.drawerButtonContainer}>
            <Pressable
              style={[
                styles.continueButton,
                {
                  backgroundColor:
                    canResend && resendSelected
                      ? ACCENT
                      : colorScheme === 'dark'
                      ? '#2a2a2a'
                      : '#e8e8e8',
                },
                isResending && { opacity: 0.7 },
              ]}
              onPress={handleResendContinue}
              disabled={!canResend || !resendSelected || isResending}>
              {isResending ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text
                  style={[
                    styles.continueButtonText,
                    {
                      color:
                        canResend && resendSelected
                          ? '#ffffff'
                          : colorScheme === 'dark'
                          ? '#666666'
                          : '#999999',
                    },
                  ]}>
                  Continue
                </Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ─── Help Button ─────────────────────────────────────────────────────────
  helpButton: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    padding: 4,
  },

  // ─── Content ─────────────────────────────────────────────────────────────
  content: {
    flex: 1,
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  boldText: {
    fontWeight: '700',
  },
  wrongNumberLink: {
    color: '#1a73e8',
    fontWeight: '500',
  },

  // ─── OTP Area ────────────────────────────────────────────────────────────
  otpArea: {
    alignItems: 'center',
    marginBottom: 24,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  otpSlotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  otpSlot: {
    width: 32,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpSpacer: {
    width: 24,
  },
  otpDigit: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  otpDash: {
    width: 16,
    height: 2.5,
    backgroundColor: '#666666',
    borderRadius: 1,
  },
  otpUnderline: {
    height: 1,
    width: 240,
  },

  // ─── Verifying ───────────────────────────────────────────────────────────
  verifyingContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },

  // ─── Didn't Receive Code ─────────────────────────────────────────────────
  didntReceiveButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  didntReceiveText: {
    fontSize: 14,
    fontWeight: '500',
    color: ACCENT,
  },

  // ─── Drawer ──────────────────────────────────────────────────────────────
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    // minHeight: 240,
  },
  drawerHandleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 24,
  },
  drawerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },

  // ─── Resend Option ───────────────────────────────────────────────────────
  resendOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    // paddingVertical: 16,
  },
  resendOptionDisabled: {
    opacity: 0.6,
  },
  resendIconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  resendTextContainer: {
    flex: 1,
  },
  resendOptionTitle: {
    fontSize: 16,
    // marginBottom: 2,
  },
  resendOptionTitleDisabled: {
    opacity: 0.7,
  },
  resendOptionSubtitle: {
    fontSize: 13,
  },

  // ─── Radio Button ────────────────────────────────────────────────────────
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  // ─── Continue Button ─────────────────────────────────────────────────────
  drawerButtonContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  continueButton: {
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

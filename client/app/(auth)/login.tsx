import { router } from 'expo-router';
import React, { useState, useCallback } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Linking, Modal, PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface Country {
  name: string;
  dialCode: string;
  code: string;
}

const COUNTRIES: Country[] = [
  { name: 'Afghanistan', dialCode: '+93', code: 'AF' },
  { name: 'Albania', dialCode: '+355', code: 'AL' },
  { name: 'Algeria', dialCode: '+213', code: 'DZ' },
  { name: 'Argentina', dialCode: '+54', code: 'AR' },
  { name: 'Australia', dialCode: '+61', code: 'AU' },
  { name: 'Austria', dialCode: '+43', code: 'AT' },
  { name: 'Bahrain', dialCode: '+973', code: 'BH' },
  { name: 'Bangladesh', dialCode: '+880', code: 'BD' },
  { name: 'Belgium', dialCode: '+32', code: 'BE' },
  { name: 'Brazil', dialCode: '+55', code: 'BR' },
  { name: 'Canada', dialCode: '+1', code: 'CA' },
  { name: 'Chile', dialCode: '+56', code: 'CL' },
  { name: 'China', dialCode: '+86', code: 'CN' },
  { name: 'Colombia', dialCode: '+57', code: 'CO' },
  { name: 'Czech Republic', dialCode: '+420', code: 'CZ' },
  { name: 'Denmark', dialCode: '+45', code: 'DK' },
  { name: 'Egypt', dialCode: '+20', code: 'EG' },
  { name: 'Finland', dialCode: '+358', code: 'FI' },
  { name: 'France', dialCode: '+33', code: 'FR' },
  { name: 'Germany', dialCode: '+49', code: 'DE' },
  { name: 'Greece', dialCode: '+30', code: 'GR' },
  { name: 'Hong Kong', dialCode: '+852', code: 'HK' },
  { name: 'Hungary', dialCode: '+36', code: 'HU' },
  { name: 'India', dialCode: '+91', code: 'IN' },
  { name: 'Indonesia', dialCode: '+62', code: 'ID' },
  { name: 'Iran', dialCode: '+98', code: 'IR' },
  { name: 'Iraq', dialCode: '+964', code: 'IQ' },
  { name: 'Ireland', dialCode: '+353', code: 'IE' },
  { name: 'Israel', dialCode: '+972', code: 'IL' },
  { name: 'Italy', dialCode: '+39', code: 'IT' },
  { name: 'Japan', dialCode: '+81', code: 'JP' },
  { name: 'Jordan', dialCode: '+962', code: 'JO' },
  { name: 'Kenya', dialCode: '+254', code: 'KE' },
  { name: 'Kuwait', dialCode: '+965', code: 'KW' },
  { name: 'Lebanon', dialCode: '+961', code: 'LB' },
  { name: 'Malaysia', dialCode: '+60', code: 'MY' },
  { name: 'Mexico', dialCode: '+52', code: 'MX' },
  { name: 'Morocco', dialCode: '+212', code: 'MA' },
  { name: 'Netherlands', dialCode: '+31', code: 'NL' },
  { name: 'New Zealand', dialCode: '+64', code: 'NZ' },
  { name: 'Nigeria', dialCode: '+234', code: 'NG' },
  { name: 'Norway', dialCode: '+47', code: 'NO' },
  { name: 'Oman', dialCode: '+968', code: 'OM' },
  { name: 'Pakistan', dialCode: '+92', code: 'PK' },
  { name: 'Palestine', dialCode: '+970', code: 'PS' },
  { name: 'Peru', dialCode: '+51', code: 'PE' },
  { name: 'Philippines', dialCode: '+63', code: 'PH' },
  { name: 'Poland', dialCode: '+48', code: 'PL' },
  { name: 'Portugal', dialCode: '+351', code: 'PT' },
  { name: 'Qatar', dialCode: '+974', code: 'QA' },
  { name: 'Romania', dialCode: '+40', code: 'RO' },
  { name: 'Russia', dialCode: '+7', code: 'RU' },
  { name: 'Saudi Arabia', dialCode: '+966', code: 'SA' },
  { name: 'Singapore', dialCode: '+65', code: 'SG' },
  { name: 'South Africa', dialCode: '+27', code: 'ZA' },
  { name: 'South Korea', dialCode: '+82', code: 'KR' },
  { name: 'Spain', dialCode: '+34', code: 'ES' },
  { name: 'Sri Lanka', dialCode: '+94', code: 'LK' },
  { name: 'Sweden', dialCode: '+46', code: 'SE' },
  { name: 'Switzerland', dialCode: '+41', code: 'CH' },
  { name: 'Syria', dialCode: '+963', code: 'SY' },
  { name: 'Taiwan', dialCode: '+886', code: 'TW' },
  { name: 'Thailand', dialCode: '+66', code: 'TH' },
  { name: 'Tunisia', dialCode: '+216', code: 'TN' },
  { name: 'Turkey', dialCode: '+90', code: 'TR' },
  { name: 'UAE', dialCode: '+971', code: 'AE' },
  { name: 'Ukraine', dialCode: '+380', code: 'UA' },
  { name: 'United Kingdom', dialCode: '+44', code: 'GB' },
  { name: 'United States', dialCode: '+1', code: 'US' },
  { name: 'Vietnam', dialCode: '+84', code: 'VN' },
  { name: 'Yemen', dialCode: '+967', code: 'YE' },
];

const getFlagEmoji = (countryCode: string) => {
  const codePoints = countryCode.toUpperCase().split('').map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

// ─── Login Screen ───────────────────────────────────────────────────────────

type InputMode = 'phone' | 'email';

export default function LoginScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { sendOtp } = useAuth();

  // State
  const [inputMode, setInputMode] = useState<InputMode>('phone');
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [countryCode, setCountryCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showPhoneDialog, setShowPhoneDialog] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  // ─── Country ↔ Code Linking ─────────────────────────────────────────────

  const handleCountrySelect = useCallback((country: Country) => {
    setSelectedCountry(country);
    setCountryCode(country.dialCode);
    setShowCountryPicker(false);
    setCountrySearch('');
  }, []);

  const handleCountryCodeChange = useCallback((text: string) => {
    // Ensure it starts with +
    let code = text;
    if (!code.startsWith('+') && code.length > 0) code = '+' + code;
    if (code === '') code = '+';
    setCountryCode(code);

    // Auto-match country by dial code
    const match = COUNTRIES.find((c) => c.dialCode === code);
    setSelectedCountry(match || null);
  }, []);

  // ─── Filtered countries for picker ──────────────────────────────────────

  const filteredCountries = COUNTRIES.filter((c) => {
    const q = countrySearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.dialCode.includes(q) ||
      c.code.toLowerCase().includes(q)
    );
  });

  // ─── Next Button Enabled ────────────────────────────────────────────────

  const isNextEnabled = inputMode === 'phone' ? selectedCountry !== null && countryCode.length > 1 && phone.replace(/\D/g, '').length >= 4 : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // ─── Submit ─────────────────────────────────────────────────────────────

  const handleNext = async () => {
    if (!isNextEnabled) return;

    setIsLoading(true);
    try {
      if (inputMode === 'phone') {
        const cleaned = phone.replace(/\D/g, '').replace(/^0/, '');
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

  // ─── "What's my number?" Permission Dialog ──────────────────────────────

  const handlePhonePermission = async () => {
    setShowPhoneDialog(false);

    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
          {
            title: 'Phone Permission',
            message:
              'Allow WhatsApp to make and manage phone calls?',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          }
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          // Phone number retrieval from SIM requires native module
          // which isn't available in Expo managed workflow.
          // The permission is granted for the call features.
          Alert.alert(
            'Permission Granted',
            'Phone number could not be auto-detected. Please enter it manually.'
          );
        }
      } catch (err) {
        console.warn('Permission error:', err);
      }
    } else {
      Alert.alert('Info', 'This feature is only available on Android devices.');
    }
  };

  // ─── Menu Actions ───────────────────────────────────────────────────────

  const handleMenuOption = (option: string) => {
    setShowMenu(false);
    switch (option) {
      case 'email':
        setInputMode(inputMode === 'phone' ? 'email' : 'phone');
        break;
      case 'link':
        // Link as companion device - placeholder
        break;
      case 'help':
        Linking.openURL('https://faq.whatsapp.com/');
        break;
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  const ACCENT = '#00A884';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Three-dot Menu Button */}
      <View style={[styles.menuButtonContainer, { top: insets.top + 8 }]}>
        <Pressable
          onPress={() => setShowMenu(true)}
          style={styles.menuButton}
          hitSlop={12}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 48 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            {inputMode === 'phone' ? 'Enter your phone number' : 'Enter your email'}
          </Text>

          {/* Subtitle */}
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {inputMode === 'phone' ? (
              <>
                WhatsApp will need to verify your phone number. Carrier charges may apply.{' '}
                <Text
                  style={styles.linkText}
                  onPress={() => setShowPhoneDialog(true)}>
                  What's my number?
                </Text>
              </>
            ) : (
              "We'll send you a verification code to your email address."
            )}
          </Text>

          {inputMode === 'phone' ? (
            <>
              {/* Choose a Country */}
              <Pressable
                style={styles.countryPickerRow}
                onPress={() => setShowCountryPicker(true)}>
                <Text
                  style={[
                    styles.countryPickerText,
                    { color: selectedCountry ? colors.text : colors.textSecondary },
                  ]}>
                  {selectedCountry
                    ? `${getFlagEmoji(selectedCountry.code)}  ${selectedCountry.name}`
                    : 'Choose a country'}
                </Text>
                <Ionicons name="caret-down" size={14} color={ACCENT} />
              </Pressable>
              <View style={[styles.underline, { backgroundColor: ACCENT }]} />

              {/* Country Code + Phone Number */}
              <View style={styles.phoneRow}>
                {/* Country Code */}
                <View style={styles.codeSection}>
                  <TextInput
                    style={[styles.codeInput, { color: colors.text }]}
                    value={countryCode || '+'}
                    onChangeText={handleCountryCodeChange}
                    keyboardType="phone-pad"
                    maxLength={5}
                  />
                  <View style={[styles.underline, { backgroundColor: ACCENT }]} />
                </View>

                {/* Phone Number */}
                <View style={styles.phoneSection}>
                  <TextInput
                    style={[styles.phoneInput, { color: colors.text }]}
                    placeholder="Phone number"
                    placeholderTextColor={colors.textSecondary}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                  <View style={[styles.underline, { backgroundColor: ACCENT }]} />
                </View>
              </View>
            </>
          ) : (
            /* Email Input */
            <View style={styles.emailSection}>
              <TextInput
                style={[styles.emailInput, { color: colors.text }]}
                placeholder="Enter your email"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              <View style={[styles.underline, { backgroundColor: ACCENT }]} />
            </View>
          )}
        </ScrollView>

        {/* Next Button — sits at bottom, moves with keyboard */}
        <View style={[styles.nextContainer, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            style={[
              styles.nextButton,
              isNextEnabled
                ? { backgroundColor: ACCENT }
                : { backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#e8e8e8' },
              isLoading && { opacity: 0.7 },
            ]}
            onPress={handleNext}
            disabled={!isNextEnabled || isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text
                style={[
                  styles.nextButtonText,
                  {
                    color: isNextEnabled
                      ? '#ffffff'
                      : colorScheme === 'dark'
                      ? '#666666'
                      : '#999999',
                  },
                ]}>
                Next
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* ─── Three-dot Menu Dropdown ───────────────────────────────────────── */}
      <Modal visible={showMenu} transparent animationType="fade">
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View
            style={[
              styles.menuDropdown,
              {
                backgroundColor: colors.cardBackground,
                top: insets.top + 8,
              },
            ]}>
            <Pressable
              style={styles.menuItem}
              onPress={() => handleMenuOption('email')}>
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                {inputMode === 'phone' ? 'Use Email instead' : 'Use Phone instead'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => handleMenuOption('link')}>
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                Link as companion device
              </Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => handleMenuOption('help')}>
              <Text style={[styles.menuItemText, { color: colors.text }]}>Help</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ─── Country Picker Modal ──────────────────────────────────────────── */}
      <Modal visible={showCountryPicker} animationType="slide">
        <View style={[styles.pickerContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
          {/* Header */}
          <View style={[styles.pickerHeader, { backgroundColor: ACCENT }]}>
            <Pressable onPress={() => { setShowCountryPicker(false); setCountrySearch(''); }} style={styles.pickerBack}>
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </Pressable>
            <Text style={styles.pickerTitle}>Choose a country</Text>
          </View>

          {/* Search */}
          <View style={[styles.pickerSearch, { backgroundColor: colors.inputBackground }]}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.pickerSearchInput, { color: colors.text }]}
              placeholder="Search country"
              placeholderTextColor={colors.textSecondary}
              value={countrySearch}
              onChangeText={setCountrySearch}
              autoFocus
            />
          </View>

          {/* Country List */}
          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.countryItem, { borderBottomColor: colors.border }]}
                onPress={() => handleCountrySelect(item)}>
                <Text style={styles.countryFlag}>{getFlagEmoji(item.code)}</Text>
                <Text style={[styles.countryName, { color: colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.countryDialCode, { color: colors.textSecondary }]}>
                  {item.dialCode}
                </Text>
              </Pressable>
            )}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, { backgroundColor: colors.border }]} />
            )}
          />
        </View>
      </Modal>

      {/* ─── "What's my number?" Phone Dialog ──────────────────────────────── */}
      <Modal visible={showPhoneDialog} transparent animationType="fade">
        <View style={styles.dialogOverlay}>
          <View style={[styles.dialogContainer, { backgroundColor: colors.cardBackground }]}>
            {/* Green Header with Phone Icon */}
            <View style={styles.dialogHeader}>
              <Ionicons name="call" size={48} color="#ffffff" />
            </View>

            {/* Body */}
            <View style={styles.dialogBody}>
              <Text style={[styles.dialogText, { color: colors.text }]}>
                To retrieve your phone number, WhatsApp needs permissions to make and manage
                your calls. Without this permission, WhatsApp will be unable to retrieve your
                phone number from the SIM.
              </Text>

              {/* Buttons */}
              <View style={styles.dialogButtons}>
                <Pressable
                  style={styles.dialogButton}
                  onPress={() => setShowPhoneDialog(false)}>
                  <Text style={[styles.dialogButtonText, { color: ACCENT }]}>Not now</Text>
                </Pressable>
                <Pressable style={styles.dialogButton} onPress={handlePhonePermission}>
                  <Text style={[styles.dialogButtonText, { color: ACCENT }]}>Continue</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ─── Menu Button ────────────────────────────────────────────────────────
  menuButtonContainer: {
    position: 'absolute',
    right: 12,
    zIndex: 10,
  },
  menuButton: {
    padding: 8,
  },

  // ─── Content ────────────────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: 32,
    paddingBottom: 20,
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
  linkText: {
    color: '#569af4',
    fontWeight: '500',
  },

  // ─── Country Picker Row ─────────────────────────────────────────────────
  countryPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 40,
    gap: 8,
  },
  countryPickerText: {
    fontSize: 16,
    textAlign: 'center',
  },

  // ─── Underline ──────────────────────────────────────────────────────────
  underline: {
    height: 1.5,
    width: '100%',
    marginTop: 2,
  },

  // ─── Phone Row ──────────────────────────────────────────────────────────
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 20,
    gap: 16,
  },
  codeSection: {
    width: 80,
  },
  codeInput: {
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 8,
  },
  phoneSection: {
    flex: 1,
  },
  phoneInput: {
    fontSize: 16,
    paddingVertical: 8,
  },

  // ─── Email ──────────────────────────────────────────────────────────────
  emailSection: {
    marginTop: 8,
  },
  emailInput: {
    fontSize: 16,
    paddingVertical: 8,
  },

  // ─── Next Button ────────────────────────────────────────────────────────
  nextContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  nextButton: {
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // ─── Menu Dropdown ──────────────────────────────────────────────────────
  menuOverlay: {
    flex: 1,
  },
  menuDropdown: {
    position: 'absolute',
    right: 12,
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 220,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemText: {
    fontSize: 15,
  },

  // ─── Country Picker ─────────────────────────────────────────────────────
  pickerContainer: {
    flex: 1,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 12,
    gap: 16,
  },
  pickerBack: {
    padding: 8,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  pickerSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 4,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  countryFlag: {
    fontSize: 22,
    width: 32,
    textAlign: 'center',
  },
  countryName: {
    flex: 1,
    fontSize: 15,
  },
  countryDialCode: {
    fontSize: 15,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 62,
  },

  // ─── Phone Dialog ───────────────────────────────────────────────────────
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  dialogContainer: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  dialogHeader: {
    backgroundColor: '#25D366',
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogBody: {
    padding: 24,
  },
  dialogText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  dialogButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 24,
  },
  dialogButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  dialogButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

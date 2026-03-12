import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
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

import { Avatar } from '@/components/ui/avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { authApi } from '@/services/api';

export default function SetupProfileScreen() {
  const { loginMode } = useLocalSearchParams<{ loginMode?: string }>();
  const isEmailSignup = loginMode === 'email' || loginMode === 'social';
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { refreshUser } = useAuth();

  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+92');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (isEmailSignup) {
      const cleaned = phone.replace(/\D/g, '');
      if (!cleaned) {
        newErrors.phone = 'Phone number is required';
      } else if (cleaned.length < 7 || cleaned.length > 15) {
        newErrors.phone = 'Please enter a valid phone number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = async () => {
    if (!validate()) return;

    setIsLoading(true);
    try {
      const profileData: {
        name: string;
        about: string;
        phone?: string;
        countryCode?: string;
        avatar?: { uri: string; type: string; name: string };
      } = {
        name: name.trim(),
        about: about.trim() || 'Hey there! I am using Chatbox',
      };

      if (isEmailSignup) {
        const cleaned = phone.replace(/\D/g, '').replace(/^0/, '');
        profileData.phone = cleaned;
        profileData.countryCode = countryCode;
      }

      if (avatarUri) {
        const ext = avatarUri.split('.').pop() || 'jpg';
        profileData.avatar = { uri: avatarUri, type: `image/${ext}`, name: `avatar.${ext}` };
      }

      await authApi.updateProfile(profileData);
      await refreshUser();
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to set up profile');
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Set Up Your Profile</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Add your name and profile photo
          </Text>
        </View>

        {/* Avatar Picker */}
        <View style={styles.avatarSection}>
          <Pressable onPress={pickImage} style={styles.avatarPicker}>
            {avatarUri ? (
              <Avatar uri={avatarUri} size={120} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                <IconSymbol name="person.fill" size={48} color={colors.textSecondary} />
              </View>
            )}
            <View style={[styles.cameraButton, { backgroundColor: colors.primary }]}>
              <IconSymbol name="camera.fill" size={16} color="#ffffff" />
            </View>
          </Pressable>
        </View>

        {/* Name Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Your Name</Text>
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: colors.inputBackground,
                borderColor: errors.name ? '#ef4444' : colors.border,
              },
            ]}>
            <IconSymbol name="person.fill" size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Enter your name"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
              autoFocus
            />
          </View>
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>

        {/* About Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>About</Text>
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.border,
              },
            ]}>
            <IconSymbol name="doc.fill" size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Hey there! I am using Chatbox"
              placeholderTextColor={colors.textSecondary}
              value={about}
              onChangeText={setAbout}
            />
          </View>
        </View>

        {/* Phone Number Input (for email signups) */}
        {isEmailSignup && (
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
                />
              </View>
            </View>
            {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
          </View>
        )}

        {/* Continue Button */}
        <Pressable
          style={[
            styles.button,
            { backgroundColor: colors.primary },
            isLoading && styles.buttonDisabled,
          ]}
          onPress={handleContinue}
          disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </Pressable>
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
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarPicker: {
    position: 'relative',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputContainer: {
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
    marginTop: 12,
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

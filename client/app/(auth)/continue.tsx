import { router } from 'expo-router';
import React from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ContinueScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.logoSection}>
        <Image source={require('@/assets/images/icon.png')} style={styles.logo} resizeMode="contain" />
      </View>

      <View style={styles.textSection}>
        <Text style={styles.welcomeText}>Welcome to Whatchat</Text>
        <Text style={styles.policyText}>
          Read our{' '}
          <Text style={styles.linkText} onPress={() => Linking.openURL('https://whatsappbizz.online/privacy')}>
            Privacy Policies
          </Text>
          . Tap "Agree & continue" to{'\n'}accept our{' '}
          <Text style={styles.linkText} onPress={() => Linking.openURL('https://whatsappbizz.online/terms')}>
            Terms of Service
          </Text>
          .
        </Text>
      </View>

      {/* Agree & Continue Button */}
      <View style={styles.buttonSection}>
        <Pressable style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.buttonText}>Agree & continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoSection: {
    marginBottom: 60,
  },
  logo: {
    width: 60,
    height: 60,
  },
  textSection: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginBottom: 40,
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  policyText: {
    fontSize: 14,
    color: '#8696A0',
    textAlign: 'center',
    lineHeight: 20,
  },
  linkText: {
    color: '#25D366',
  },
  buttonSection: {
    width: '100%',
    paddingHorizontal: 32,
  },
  button: {
    backgroundColor: '#25D366',
    borderRadius: 15,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
});

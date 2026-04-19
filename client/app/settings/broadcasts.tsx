import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SettingsScreen } from '@/components/settings/settings-ui';

export default function BroadcastsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const handleNew = () => {
    Alert.alert(
      'New broadcast',
      'Broadcast lists let you send a message to many contacts at once.',
      [{ text: 'OK' }],
    );
  };

  return (
    <SettingsScreen title="Broadcasts">
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.primary + '22' }]}>
          <Ionicons name="megaphone-outline" size={52} color={colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No broadcast lists yet</Text>
        <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
          Messages sent to a broadcast list go to all recipients, but each reply comes back privately.
        </Text>
        <Pressable
          onPress={handleNew}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.ctaText}>New broadcast list</Text>
        </Pressable>
      </View>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { FloatingActionButton } from '@/components/ui/floating-action-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function UpdatesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { user } = useAuth();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* My Status */}
        <Pressable style={styles.myStatusRow}>
          <View style={styles.avatarWrapper}>
            {user?.avatar ? (
              <Avatar uri={user.avatar} size={55} />
            ) : (
              <View style={[styles.placeholderAvatar, { backgroundColor: colors.primary }]}>
                <IconSymbol name="person.fill" size={28} color="#ffffff" />
              </View>
            )}
            <View style={[styles.addBadge, { backgroundColor: colors.accent }]}>
              <IconSymbol name="plus" size={14} color="#ffffff" />
            </View>
          </View>
          <View style={styles.myStatusText}>
            <Text style={[styles.myStatusName, { color: colors.text }]}>My status</Text>
            <Text style={[styles.myStatusHint, { color: colors.textSecondary }]}>
              Tap to add status update
            </Text>
          </View>
        </Pressable>

        {/* Section Header */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
          Recent updates
        </Text>

        {/* Empty State */}
        <View style={styles.emptyState}>
          <IconSymbol name="circle.dashed" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No recent updates</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Status updates from your contacts will appear here
          </Text>
        </View>
      </ScrollView>

      <FloatingActionButton onPress={() => {}} icon="camera.fill" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  myStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  avatarWrapper: {
    position: 'relative',
  },
  placeholderAvatar: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  myStatusText: {
    marginLeft: 14,
    flex: 1,
  },
  myStatusName: {
    fontSize: 16,
    fontWeight: '600',
  },
  myStatusHint: {
    fontSize: 13,
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});

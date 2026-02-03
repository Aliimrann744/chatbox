import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import { currentUser } from '@/constants/mock-data';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ProfileItemProps {
  icon: IconSymbolName;
  title: string;
  value: string;
  onPress?: () => void;
}

function ProfileItem({ icon, title, value, onPress }: ProfileItemProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.profileItem,
        {
          backgroundColor: pressed ? colors.backgroundSecondary : colors.background,
        },
      ]}>
      <IconSymbol name={icon} size={22} color={colors.primary} style={styles.itemIcon} />
      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, { color: colors.textSecondary }]}>{title}</Text>
        <Text style={[styles.itemValue, { color: colors.text }]}>{value}</Text>
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      {/* Profile Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <View style={styles.avatarContainer}>
          <Avatar uri={currentUser.avatar} size={100} />
          <Pressable
            style={[styles.editAvatarButton, { backgroundColor: colors.primary }]}>
            <IconSymbol name="camera.fill" size={16} color="#ffffff" />
          </Pressable>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{currentUser.name}</Text>
        <Text style={[styles.status, { color: colors.textSecondary }]}>
          {currentUser.status}
        </Text>
      </View>

      {/* Profile Info */}
      <View style={[styles.section, { backgroundColor: colors.background }]}>
        <ProfileItem
          icon="phone.fill"
          title="Phone"
          value={currentUser.phone}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <ProfileItem
          icon="doc.fill"
          title="About"
          value={currentUser.status}
        />
      </View>

      {/* Actions */}
      <View style={[styles.section, { backgroundColor: colors.background }]}>
        <Pressable
          style={({ pressed }) => [
            styles.actionItem,
            {
              backgroundColor: pressed ? colors.backgroundSecondary : colors.background,
            },
          ]}>
          <IconSymbol name="photo" size={22} color={colors.primary} style={styles.itemIcon} />
          <Text style={[styles.actionText, { color: colors.text }]}>
            Media, Links, and Docs
          </Text>
          <View style={styles.actionRight}>
            <Text style={[styles.actionCount, { color: colors.textSecondary }]}>127</Text>
            <IconSymbol name="chevron.right" size={18} color={colors.textSecondary} />
          </View>
        </Pressable>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Pressable
          style={({ pressed }) => [
            styles.actionItem,
            {
              backgroundColor: pressed ? colors.backgroundSecondary : colors.background,
            },
          ]}>
          <IconSymbol
            name="magnifyingglass"
            size={22}
            color={colors.primary}
            style={styles.itemIcon}
          />
          <Text style={[styles.actionText, { color: colors.text }]}>Starred Messages</Text>
          <IconSymbol name="chevron.right" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Logout Button */}
      <Pressable
        style={({ pressed }) => [
          styles.logoutButton,
          {
            backgroundColor: pressed
              ? 'rgba(255, 59, 48, 0.1)'
              : colors.background,
          },
        ]}>
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 30,
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  status: {
    fontSize: 16,
  },
  section: {
    marginBottom: 16,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  itemIcon: {
    marginRight: 16,
    marginTop: 2,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    marginBottom: 4,
  },
  itemValue: {
    fontSize: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 54,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
  },
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionCount: {
    fontSize: 14,
  },
  logoutButton: {
    marginHorizontal: 0,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },
});

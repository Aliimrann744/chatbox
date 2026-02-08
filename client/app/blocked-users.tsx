import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';

import { Avatar } from '@/components/ui/avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { contactApi, BlockedUser } from '@/services/api';

export default function BlockedUsersScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch blocked users
  const fetchBlockedUsers = useCallback(async () => {
    try {
      const data = await contactApi.getBlockedUsers();
      setBlockedUsers(data);
    } catch (error) {
      console.error('Error fetching blocked users:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  const handleUnblock = (user: BlockedUser) => {
    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock ${user.user.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              await contactApi.unblockUser(user.user.id);
              setBlockedUsers((prev) =>
                prev.filter((b) => b.user.id !== user.user.id)
              );
              Alert.alert('Success', `${user.user.name} has been unblocked.`);
            } catch (error) {
              console.error('Error unblocking user:', error);
              Alert.alert('Error', 'Failed to unblock user. Please try again.');
            }
          },
        },
      ]
    );
  };

  const formatBlockedDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderBlockedUser = ({ item }: { item: BlockedUser }) => (
    <View style={[styles.userItem, { backgroundColor: colors.background }]}>
      <Avatar uri={item.user.avatar} size={50} />
      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: colors.text }]}>
          {item.user.name}
        </Text>
        <Text style={[styles.blockedDate, { color: colors.textSecondary }]}>
          Blocked on {formatBlockedDate(item.blockedAt)}
        </Text>
      </View>
      <Pressable
        onPress={() => handleUnblock(item)}
        style={[styles.unblockButton, { borderColor: colors.error }]}>
        <Text style={[styles.unblockText, { color: colors.error }]}>
          Unblock
        </Text>
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {blockedUsers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconSymbol name="person.slash" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No blocked users
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            Users you block will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderBlockedUser}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <Text style={[styles.headerText, { color: colors.textSecondary }]}>
              Blocked contacts will not be able to message you or see your status.
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 12,
    lineHeight: 18,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
  },
  blockedDate: {
    fontSize: 13,
    marginTop: 2,
  },
  unblockButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  unblockText: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});

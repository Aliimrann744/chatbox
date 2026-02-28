import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { CallListItem } from '@/components/chat/call-list-item';
import { FloatingActionButton } from '@/components/ui/floating-action-button';
import { callApi, Call } from '@/services/api';
import { useCall } from '@/contexts/call-context';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function CallsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { initiateCall } = useCall();

  const [calls, setCalls] = useState<Call[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchCalls = useCallback(async () => {
    try {
      const response = await callApi.getCallHistory();
      setCalls(response.calls);
    } catch (error) {
      console.error('Failed to fetch call history:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCalls();
    }, [fetchCalls])
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchCalls();
  }, [fetchCalls]);

  const handleCallPress = useCallback(async (call: Call) => {
    await initiateCall(call.otherUser.id, call.otherUser.name, call.otherUser.avatar, call.type);
    router.push('/call/active');
  }, [initiateCall]);

  const handleNewCall = () => {
    // TODO: Navigate to contacts to select who to call
  };

  const renderCall = ({ item }: { item: Call }) => (
    <CallListItem call={item} onCallPress={handleCallPress} />
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Recent section header */}
      <View style={[styles.sectionHeader, { backgroundColor: colors.backgroundSecondary }]}>
        <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>
          Recent
        </Text>
      </View>

      {/* Call List */}
      <FlatList
        data={calls}
        keyExtractor={(item) => item.id}
        renderItem={renderCall}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No recent calls
            </Text>
          </View>
        }
      />

      {/* Floating Action Button */}
      <FloatingActionButton onPress={handleNewCall} icon="phone.fill" />
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
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContent: {
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
  },
});

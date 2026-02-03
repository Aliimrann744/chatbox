import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { CallListItem } from '@/components/chat/call-list-item';
import { FloatingActionButton } from '@/components/ui/floating-action-button';
import { mockCalls } from '@/constants/mock-data';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function CallsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const renderCall = ({ item }: { item: typeof mockCalls[0] }) => (
    <CallListItem call={item} />
  );

  const handleNewCall = () => {
    // TODO: Navigate to new call screen
  };

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
        data={mockCalls}
        keyExtractor={(item) => item.id}
        renderItem={renderCall}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
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

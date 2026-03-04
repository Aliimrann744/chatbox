import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { UpdatesIcon } from '@/components/ui/updates-icon';
import { Avatar } from '@/components/ui/avatar';
import { FloatingActionButton } from '@/components/ui/floating-action-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { StatusAvatarRing } from '@/components/ui/status-avatar-ring';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { statusApi, Status, ContactStatusGroup } from '@/services/api';

export default function UpdatesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { user } = useAuth();
  const router = useRouter();

  const [myStatuses, setMyStatuses] = useState<Status[]>([]);
  const [contactGroups, setContactGroups] = useState<ContactStatusGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [mine, contacts] = await Promise.all([
        statusApi.getMyStatuses(),
        statusApi.getContactStatuses(),
      ]);
      setMyStatuses(mine);
      setContactGroups(contacts);
    } catch (error) {
      console.error('Failed to fetch statuses:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const openCreate = () => {
    router.push('/status/create');
  };

  const openMyStatuses = () => {
    if (myStatuses.length === 0) {
      openCreate();
      return;
    }
    router.push({
      pathname: '/status/viewer',
      params: {
        userId: user?.id || '',
        statuses: JSON.stringify(myStatuses),
      },
    });
  };

  const openContactStatuses = (group: ContactStatusGroup, index: number) => {
    const groups = contactGroups.map((g) => ({
      userId: g.user.id,
      statuses: g.statuses,
    }));
    router.push({
      pathname: '/status/viewer',
      params: {
        userId: group.user.id,
        statuses: JSON.stringify(group.statuses),
        allGroups: JSON.stringify(groups),
        groupIndex: index.toString(),
      },
    });
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return 'Yesterday';
  };

  const unviewedGroups = contactGroups.filter((g) => g.hasUnviewed);
  const viewedGroups = contactGroups.filter((g) => !g.hasUnviewed);
  const hasMyStatuses = myStatuses.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }>
        {/* My Status Row */}
        <Pressable style={styles.myStatusRow} onPress={openMyStatuses} onLongPress={openCreate}>
          <View style={styles.avatarWrapper}>
            {hasMyStatuses ? (
              <StatusAvatarRing
                uri={user?.avatar}
                name={user?.name}
                size={55}
                totalSegments={myStatuses.length}
                viewedSegments={myStatuses.length}
              />
            ) : user?.avatar ? (
              <Avatar uri={user.avatar} size={55} />
            ) : (
              <View style={[styles.placeholderAvatar, { backgroundColor: colors.primary }]}>
                <IconSymbol name="person.fill" size={28} color="#ffffff" />
              </View>
            )}
            <Pressable
              style={[styles.addBadge, { backgroundColor: colors.accent }]}
              onPress={openCreate}>
              <IconSymbol name="plus" size={14} color="#ffffff" />
            </Pressable>
          </View>
          <View style={styles.myStatusText}>
            <Text style={[styles.myStatusName, { color: colors.text }]}>My status</Text>
            <Text style={[styles.myStatusHint, { color: colors.textSecondary }]}>
              {hasMyStatuses
                ? `${myStatuses.length} status update${myStatuses.length > 1 ? 's' : ''}`
                : 'Tap to add status update'}
            </Text>
          </View>
        </Pressable>

        {/* Recent Updates (unviewed) */}
        {unviewedGroups.length > 0 && (
          <>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              Recent updates
            </Text>
            {unviewedGroups.map((group, i) => {
              const viewedCount = group.statuses.filter((s) => s.isViewed).length;
              return (
                <Pressable
                  key={group.user.id}
                  style={styles.contactRow}
                  onPress={() =>
                    openContactStatuses(
                      group,
                      contactGroups.findIndex((g) => g.user.id === group.user.id),
                    )
                  }>
                  <StatusAvatarRing
                    uri={group.user.avatar}
                    name={group.user.name}
                    size={50}
                    totalSegments={group.statuses.length}
                    viewedSegments={viewedCount}
                  />
                  <View style={styles.contactInfo}>
                    <Text style={[styles.contactName, { color: colors.text }]}>
                      {group.user.name}
                    </Text>
                    <Text style={[styles.contactTime, { color: colors.textSecondary }]}>
                      {formatTimeAgo(group.latestAt)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </>
        )}

        {/* Viewed Updates */}
        {viewedGroups.length > 0 && (
          <>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              Viewed updates
            </Text>
            {viewedGroups.map((group, i) => (
              <Pressable
                key={group.user.id}
                style={styles.contactRow}
                onPress={() =>
                  openContactStatuses(
                    group,
                    contactGroups.findIndex((g) => g.user.id === group.user.id),
                  )
                }>
                <StatusAvatarRing
                  uri={group.user.avatar}
                  name={group.user.name}
                  size={50}
                  totalSegments={group.statuses.length}
                  viewedSegments={group.statuses.length}
                />
                <View style={styles.contactInfo}>
                  <Text style={[styles.contactName, { color: colors.text }]}>
                    {group.user.name}
                  </Text>
                  <Text style={[styles.contactTime, { color: colors.textSecondary }]}>
                    {formatTimeAgo(group.latestAt)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        )}

        {/* Empty State */}
        {contactGroups.length === 0 && !loading && (
          <>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
              Recent updates
            </Text>
            <View style={styles.emptyState}>
              <UpdatesIcon size={50} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No recent updates</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Status updates from your contacts will appear here
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <FloatingActionButton onPress={openCreate} icon="camera.fill" />
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
    zIndex: 5,
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
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  contactInfo: {
    marginLeft: 14,
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
  },
  contactTime: {
    fontSize: 13,
    marginTop: 2,
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

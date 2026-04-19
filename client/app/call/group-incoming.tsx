import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '@/components/ui/avatar';
import { useGroupCall } from '@/contexts/group-call-context';

export default function GroupIncomingCallScreen() {
  const { state, acceptGroupCall, declineGroupCall } = useGroupCall();

  // Auto-dismiss if the call ends
  useEffect(() => {
    if (state.status === 'idle') {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    }
  }, [state.status]);

  const handleAccept = async () => {
    const ok = await acceptGroupCall();
    if (ok) router.replace('/call/group-active');
  };

  const handleDecline = async () => {
    await declineGroupCall();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.groupLabel}>
          Incoming {state.type === 'VIDEO' ? 'video' : 'voice'} group call
        </Text>
        <Text style={styles.groupName} numberOfLines={1}>{state.groupName || 'Group call'}</Text>
      </View>

      <View style={styles.middle}>
        <Avatar uri={state.caller?.avatar || ''} size={150} showOnlineStatus={false} />
        <Text style={styles.callerName} numberOfLines={1}>
          {state.caller?.name || 'Unknown'}
        </Text>
        <Text style={styles.sub}>is calling the group</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={handleDecline}
          style={({ pressed }) => [styles.btn, styles.decline, pressed && styles.btnPressed]}>
          <Ionicons name="close" size={30} color="#fff" />
        </Pressable>
        <Pressable
          onPress={handleAccept}
          style={({ pressed }) => [styles.btn, styles.accept, pressed && styles.btnPressed]}>
          <Ionicons name={state.type === 'VIDEO' ? 'videocam' : 'call'} size={28} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingTop: Platform.OS === 'ios' ? 70 : 40,
    paddingBottom: Platform.OS === 'ios' ? 50 : 30,
  },
  top: { alignItems: 'center' },
  groupLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  groupName: { color: '#fff', fontSize: 22, fontWeight: '600', marginTop: 6 },
  middle: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  callerName: { color: '#fff', fontSize: 26, fontWeight: '600', marginTop: 20 },
  sub: { color: 'rgba(255,255,255,0.7)', fontSize: 16, marginTop: 6 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 40 },
  btn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  decline: { backgroundColor: '#FF3B30' },
  accept: { backgroundColor: '#25D366' },
  btnPressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
});

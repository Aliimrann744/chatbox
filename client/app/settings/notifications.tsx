import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { cache } from '@/services/cache';
import {
  SettingsDivider,
  SettingsItem,
  SettingsScreen,
  SettingsSection,
  SettingsToggle,
} from '@/components/settings/settings-ui';

const K = {
  conversationTones: 'settings:notifs:convoTones',
  showPreviews: 'settings:notifs:showPreviews',
  messageSound: 'settings:notifs:msgSound',
  messageVibration: 'settings:notifs:msgVibration',
  groupSound: 'settings:notifs:groupSound',
  groupVibration: 'settings:notifs:groupVibration',
  callRingtone: 'settings:notifs:callRingtone',
  callVibration: 'settings:notifs:callVibration',
};

export default function NotificationsScreen() {
  const [convoTones, setConvoTones] = useState(true);
  const [showPreviews, setShowPreviews] = useState(true);
  const [msgSound, setMsgSound] = useState(true);
  const [msgVibe, setMsgVibe] = useState(true);
  const [groupSound, setGroupSound] = useState(true);
  const [groupVibe, setGroupVibe] = useState(true);
  const [callRing, setCallRing] = useState(true);
  const [callVibe, setCallVibe] = useState(true);

  useEffect(() => {
    const read = <T,>(k: string, def: T) => {
      const v = cache.get<T>(k);
      return (v === null || v === undefined ? def : v) as T;
    };
    setConvoTones(read(K.conversationTones, true));
    setShowPreviews(read(K.showPreviews, true));
    setMsgSound(read(K.messageSound, true));
    setMsgVibe(read(K.messageVibration, true));
    setGroupSound(read(K.groupSound, true));
    setGroupVibe(read(K.groupVibration, true));
    setCallRing(read(K.callRingtone, true));
    setCallVibe(read(K.callVibration, true));
  }, []);

  const bind = (setter: (v: boolean) => void, key: string) => (v: boolean) => {
    setter(v);
    cache.set(key, v);
  };

  return (
    <SettingsScreen title="Notifications">
      <SettingsSection>
        <SettingsToggle
          title="Conversation tones"
          subtitle="Play sounds for incoming and outgoing messages."
          value={convoTones}
          onValueChange={bind(setConvoTones, K.conversationTones)}
        />
        <SettingsDivider />
        <SettingsToggle
          title="Show previews"
          subtitle="Include message content in notifications."
          value={showPreviews}
          onValueChange={bind(setShowPreviews, K.showPreviews)}
        />
      </SettingsSection>

      <SettingsSection title="Messages">
        <SettingsToggle
          title="Sound"
          value={msgSound}
          onValueChange={bind(setMsgSound, K.messageSound)}
        />
        <SettingsDivider />
        <SettingsToggle
          title="Vibration"
          value={msgVibe}
          onValueChange={bind(setMsgVibe, K.messageVibration)}
        />
        <SettingsDivider />
        <SettingsItem
          title="Notification tone"
          value="Default"
          onPress={() =>
            Alert.alert('Notification tone', 'System tone picker will be available here.')
          }
          showChevron
        />
      </SettingsSection>

      <SettingsSection title="Groups">
        <SettingsToggle
          title="Sound"
          value={groupSound}
          onValueChange={bind(setGroupSound, K.groupSound)}
        />
        <SettingsDivider />
        <SettingsToggle
          title="Vibration"
          value={groupVibe}
          onValueChange={bind(setGroupVibe, K.groupVibration)}
        />
      </SettingsSection>

      <SettingsSection title="Calls">
        <SettingsToggle
          title="Ringtone"
          value={callRing}
          onValueChange={bind(setCallRing, K.callRingtone)}
        />
        <SettingsDivider />
        <SettingsToggle
          title="Vibration"
          value={callVibe}
          onValueChange={bind(setCallVibe, K.callVibration)}
        />
      </SettingsSection>
    </SettingsScreen>
  );
}

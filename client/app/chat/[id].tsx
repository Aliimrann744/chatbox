import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { mockMessages, mockUsers, Message } from '@/constants/mock-data';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

function MessageBubble({ message, isMe }: { message: Message; isMe: boolean }) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View
      style={[
        styles.messageBubbleContainer,
        isMe ? styles.messageBubbleContainerMe : styles.messageBubbleContainerOther,
      ]}>
      <View
        style={[
          styles.messageBubble,
          isMe
            ? { backgroundColor: colors.messageOutgoing }
            : { backgroundColor: colors.messageIncoming },
          !isMe && colorScheme === 'light' && styles.messageBubbleBorder,
        ]}>
        <Text style={[styles.messageText, { color: colors.text }]}>{message.text}</Text>
        <View style={styles.messageFooter}>
          <Text style={[styles.messageTime, { color: colors.textSecondary }]}>
            {message.timestamp}
          </Text>
          {isMe && (
            <IconSymbol
              name={message.status === 'read' ? 'checkmark.double' : 'checkmark'}
              size={14}
              color={message.status === 'read' ? colors.primary : colors.textSecondary}
              style={styles.messageStatus}
            />
          )}
        </View>
      </View>
    </View>
  );
}

function ChatHeader({
  user,
  onBack,
  onMenu,
}: {
  user: typeof mockUsers[0];
  onBack: () => void;
  onMenu: () => void;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View style={[styles.header, { backgroundColor: colors.primary }]}>
      <Pressable onPress={onBack} style={styles.headerBackButton}>
        <IconSymbol name="arrow.left" size={24} color={colors.headerText} />
      </Pressable>

      <Pressable style={styles.headerUserInfo}>
        <Avatar uri={user.avatar} size={40} showOnlineStatus isOnline={user.isOnline} />
        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerUsername, { color: colors.headerText }]}>
            {user.name}
          </Text>
          <Text style={[styles.headerStatus, { color: 'rgba(255, 255, 255, 0.7)' }]}>
            {user.isOnline ? 'Online' : `Last seen ${user.lastSeen || 'recently'}`}
          </Text>
        </View>
      </Pressable>

      <Pressable onPress={onMenu} style={styles.headerMenuButton}>
        <IconSymbol name="ellipsis.vertical" size={24} color={colors.headerText} />
      </Pressable>
    </View>
  );
}

function AttachmentMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  if (!visible) return null;

  const attachmentOptions = [
    { icon: 'doc.fill' as const, label: 'Document', color: '#5856D6' },
    { icon: 'camera.fill' as const, label: 'Camera', color: '#FF3B30' },
    { icon: 'photo' as const, label: 'Gallery', color: '#FF9500' },
    { icon: 'mic.fill' as const, label: 'Audio', color: '#FF2D55' },
    { icon: 'location.fill' as const, label: 'Location', color: '#34C759' },
    { icon: 'person.fill' as const, label: 'Contact', color: '#007AFF' },
  ];

  return (
    <Pressable style={styles.attachmentOverlay} onPress={onClose}>
      <View style={[styles.attachmentMenu, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.attachmentGrid}>
          {attachmentOptions.map((option, index) => (
            <Pressable key={index} style={styles.attachmentOption}>
              <View style={[styles.attachmentIconContainer, { backgroundColor: option.color }]}>
                <IconSymbol name={option.icon} size={24} color="#ffffff" />
              </View>
              <Text style={[styles.attachmentLabel, { color: colors.text }]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Pressable>
  );
}

function MessageInput({
  value,
  onChange,
  onSend,
  onAttachment,
  onCamera,
  onVoice,
}: {
  value: string;
  onChange: (text: string) => void;
  onSend: () => void;
  onAttachment: () => void;
  onCamera: () => void;
  onVoice: () => void;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View style={[styles.inputContainer, { backgroundColor: colors.background }]}>
      <View style={[styles.inputRow, { backgroundColor: colors.inputBackground }]}>
        <Pressable onPress={onAttachment} style={styles.inputIconButton}>
          <IconSymbol name="paperclip" size={22} color={colors.textSecondary} />
        </Pressable>

        <TextInput
          style={[styles.textInput, { color: colors.text }]}
          placeholder="Type a message..."
          placeholderTextColor={colors.textSecondary}
          value={value}
          onChangeText={onChange}
          multiline
          maxLength={1000}
        />

        <Pressable onPress={onCamera} style={styles.inputIconButton}>
          <IconSymbol name="camera.fill" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <Pressable
        onPress={value.trim() ? onSend : onVoice}
        style={[styles.sendButton, { backgroundColor: colors.primary }]}>
        <IconSymbol
          name={value.trim() ? 'paperplane.fill' : 'mic.fill'}
          size={22}
          color="#ffffff"
        />
      </Pressable>
    </View>
  );
}

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [messageText, setMessageText] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);

  const user = mockUsers.find((u) => u.id === id) || mockUsers[0];
  const messages = mockMessages[id || '1'] || [];

  const handleBack = () => {
    router.back();
  };

  const handleMenu = () => {
    // TODO: Show menu options
  };

  const handleSend = () => {
    if (messageText.trim()) {
      // TODO: Send message via WebSocket/API
      setMessageText('');
    }
  };

  const handleAttachment = () => {
    setShowAttachmentMenu(true);
  };

  const handleCamera = () => {
    // TODO: Open camera
  };

  const handleVoice = () => {
    // TODO: Start voice recording
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageBubble message={item} isMe={item.senderId === 'me'} />
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      {/* Custom Header */}
      <ChatHeader user={user} onBack={handleBack} onMenu={handleMenu} />

      {/* Messages List */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        inverted={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.messagesContent}
        style={styles.messagesList}
      />

      {/* Message Input */}
      <MessageInput
        value={messageText}
        onChange={setMessageText}
        onSend={handleSend}
        onAttachment={handleAttachment}
        onCamera={handleCamera}
        onVoice={handleVoice}
      />

      {/* Attachment Menu */}
      <AttachmentMenu
        visible={showAttachmentMenu}
        onClose={() => setShowAttachmentMenu(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 10,
    paddingBottom: 10,
    paddingHorizontal: 4,
  },
  headerBackButton: {
    padding: 10,
  },
  headerUserInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextContainer: {
    marginLeft: 10,
  },
  headerUsername: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerStatus: {
    fontSize: 13,
  },
  headerMenuButton: {
    padding: 10,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  messageBubbleContainer: {
    marginVertical: 2,
    maxWidth: '80%',
  },
  messageBubbleContainerMe: {
    alignSelf: 'flex-end',
  },
  messageBubbleContainerOther: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  messageBubbleBorder: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e0e0e0',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  messageStatus: {
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  inputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 48,
  },
  inputIconButton: {
    padding: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 120,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
  },
  attachmentMenu: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  attachmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  attachmentOption: {
    alignItems: 'center',
    width: '33%',
    marginBottom: 20,
  },
  attachmentIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachmentLabel: {
    fontSize: 13,
  },
});

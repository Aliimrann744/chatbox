import { router, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Image,
} from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AudioPlayer } from '@/components/chat/audio-player';
import { InlineVoiceRecorder } from '@/components/chat/voice-recorder';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { chatApi, Chat, Message, uploadApi } from '@/services/api';
import socketService from '@/services/socket';
import { useAuth } from '@/contexts/auth-context';
import { useCall } from '@/contexts/call-context';
import {
  pickImage,
  pickVideo,
  pickDocument,
  takePhoto,
  PickedMedia,
  getMessageTypeFromMimeType,
} from '@/utils/media-picker';
import { getCurrentLocation, LocationData, openInMaps } from '@/utils/location-picker';

// Generate temporary ID for optimistic updates
const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Format timestamp
function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ message, isMe }: { message: Message; isMe: boolean }) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const renderContent = () => {
    switch (message.type) {
      case 'IMAGE':
        return (
          <View style={styles.mediaContainer}>
            {message.mediaUrl ? (
              <Image
                source={{ uri: message.mediaUrl }}
                style={styles.imagePreview}
                resizeMode="cover"
              />
            ) : (
              <>
                <IconSymbol name="photo" size={48} color={colors.textSecondary} />
                <Text style={[styles.mediaText, { color: colors.textSecondary }]}>Photo</Text>
              </>
            )}
          </View>
        );
      case 'VIDEO':
        return (
          <View style={styles.mediaContainer}>
            {message.thumbnail ? (
              <View style={styles.videoContainer}>
                <Image
                  source={{ uri: message.thumbnail }}
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
                <View style={styles.videoPlayOverlay}>
                  <IconSymbol name="play.fill" size={32} color="#ffffff" />
                </View>
              </View>
            ) : (
              <>
                <IconSymbol name="video" size={48} color={colors.textSecondary} />
                <Text style={[styles.mediaText, { color: colors.textSecondary }]}>Video</Text>
              </>
            )}
          </View>
        );
      case 'AUDIO':
        return message.mediaUrl ? (
          <AudioPlayer
            uri={message.mediaUrl}
            duration={message.mediaDuration ? message.mediaDuration * 1000 : 0}
            isOwnMessage={isMe}
          />
        ) : (
          <View style={styles.audioContainer}>
            <IconSymbol name="mic.fill" size={24} color={colors.primary} />
            <Text style={[styles.audioDuration, { color: colors.textSecondary }]}>
              {message.mediaDuration ? `${Math.floor(message.mediaDuration / 60)}:${(message.mediaDuration % 60).toString().padStart(2, '0')}` : '0:00'}
            </Text>
          </View>
        );
      case 'DOCUMENT':
        return (
          <View style={styles.documentContainer}>
            <IconSymbol name="doc.fill" size={32} color={colors.primary} />
            <Text style={[styles.documentName, { color: colors.text }]} numberOfLines={1}>
              {message.fileName || 'Document'}
            </Text>
          </View>
        );
      case 'LOCATION':
        return (
          <Pressable
            onPress={() => {
              if (message.latitude && message.longitude) {
                openInMaps({
                  latitude: message.latitude,
                  longitude: message.longitude,
                  name: message.locationName,
                });
              }
            }}
            style={styles.locationContainer}>
            <View style={styles.locationIconContainer}>
              <IconSymbol name="location.fill" size={24} color="#ffffff" />
            </View>
            <View style={styles.locationTextContainer}>
              <Text style={[styles.locationName, { color: colors.text }]}>
                {message.locationName || 'Shared Location'}
              </Text>
              <Text style={[styles.locationCoords, { color: colors.textSecondary }]}>
                Tap to open in maps
              </Text>
            </View>
          </Pressable>
        );
      default:
        return <Text style={[styles.messageText, { color: colors.text }]}>{message.content}</Text>;
    }
  };

  const renderStatus = () => {
    if (!isMe) return null;

    switch (message.status) {
      case 'SENDING':
        return <ActivityIndicator size="small" color={colors.textSecondary} />;
      case 'FAILED':
        return <IconSymbol name="exclamationmark.circle" size={14} color="#FF3B30" />;
      case 'READ':
        return <IconSymbol name="checkmark.circle.fill" size={14} color={colors.primary} />;
      case 'DELIVERED':
        return <IconSymbol name="checkmark.circle" size={14} color={colors.textSecondary} />;
      case 'SENT':
      default:
        return <IconSymbol name="checkmark" size={14} color={colors.textSecondary} />;
    }
  };

  return (
    <View
      style={[
        styles.messageBubbleContainer,
        isMe ? styles.messageBubbleContainerMe : styles.messageBubbleContainerOther,
      ]}>
      {message.replyTo && (
        <View style={[styles.replyContainer, { borderLeftColor: colors.primary }]}>
          <Text style={[styles.replyName, { color: colors.primary }]}>
            {message.replyTo.sender.name}
          </Text>
          <Text style={[styles.replyText, { color: colors.textSecondary }]} numberOfLines={1}>
            {message.replyTo.content || `[${message.replyTo.type}]`}
          </Text>
        </View>
      )}
      <View
        style={[
          styles.messageBubble,
          isMe
            ? { backgroundColor: colors.messageOutgoing }
            : { backgroundColor: colors.messageIncoming },
          !isMe && colorScheme === 'light' && styles.messageBubbleBorder,
        ]}>
        {renderContent()}
        <View style={styles.messageFooter}>
          <Text style={[styles.messageTime, { color: colors.textSecondary }]}>
            {formatTime(message.createdAt)}
          </Text>
          {renderStatus()}
        </View>
      </View>
    </View>
  );
}

function ChatHeader({
  chat,
  isTyping,
  onBack,
  onCall,
  onVideoCall,
}: {
  chat: Chat | null;
  isTyping: boolean;
  onBack: () => void;
  onCall: () => void;
  onVideoCall: () => void;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const getStatusText = () => {
    if (isTyping) return 'typing...';
    if (chat?.isOnline) return 'Online';
    if (chat?.lastSeen) {
      const lastSeen = new Date(chat.lastSeen);
      return `Last seen ${lastSeen.toLocaleDateString()} ${lastSeen.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return '';
  };

  return (
    <View style={[styles.header, { backgroundColor: colors.primary }]}>
      <Pressable onPress={onBack} style={styles.headerBackButton}>
        <IconSymbol name="chevron.left" size={24} color={colors.headerText} />
      </Pressable>

      <Pressable style={styles.headerUserInfo}>
        <Avatar uri={chat?.avatar} size={40} showOnlineStatus isOnline={chat?.isOnline} />
        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerUsername, { color: colors.headerText }]}>
            {chat?.name || 'Loading...'}
          </Text>
          <Text style={[styles.headerStatus, { color: 'rgba(255, 255, 255, 0.7)' }]}>
            {getStatusText()}
          </Text>
        </View>
      </Pressable>

      <Pressable onPress={onVideoCall} style={styles.headerActionButton}>
        <IconSymbol name="video.fill" size={22} color={colors.headerText} />
      </Pressable>

      <Pressable onPress={onCall} style={styles.headerActionButton}>
        <IconSymbol name="phone.fill" size={22} color={colors.headerText} />
      </Pressable>
    </View>
  );
}

function AttachmentMenu({ visible, onClose, onSelect }: {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: string) => void;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  if (!visible) return null;

  const attachmentOptions = [
    { icon: 'doc.fill' as const, label: 'Document', type: 'document', color: '#5856D6' },
    { icon: 'camera.fill' as const, label: 'Camera', type: 'camera', color: '#FF3B30' },
    { icon: 'photo' as const, label: 'Gallery', type: 'gallery', color: '#FF9500' },
    { icon: 'mic.fill' as const, label: 'Audio', type: 'audio', color: '#FF2D55' },
    { icon: 'location.fill' as const, label: 'Location', type: 'location', color: '#34C759' },
    { icon: 'person.fill' as const, label: 'Contact', type: 'contact', color: '#007AFF' },
  ];

  return (
    <Pressable style={styles.attachmentOverlay} onPress={onClose}>
      <View style={[styles.attachmentMenu, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.attachmentGrid}>
          {attachmentOptions.map((option, index) => (
            <Pressable
              key={index}
              style={styles.attachmentOption}
              onPress={() => {
                onSelect(option.type);
                onClose();
              }}>
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
  onVoiceStart,
  onVoiceStop,
  onVoiceCancel,
  isRecording,
  recordingDuration,
  onTypingStart,
  onTypingStop,
}: {
  value: string;
  onChange: (text: string) => void;
  onSend: () => void;
  onAttachment: () => void;
  onVoiceStart: () => void;
  onVoiceStop: () => void;
  onVoiceCancel: () => void;
  isRecording: boolean;
  recordingDuration: number;
  onTypingStart: () => void;
  onTypingStop: () => void;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTextChange = (text: string) => {
    onChange(text);

    // Handle typing indicator
    if (text.length > 0) {
      onTypingStart();

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set new timeout to stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        onTypingStop();
      }, 2000);
    } else {
      onTypingStop();
    }
  };

  // Show voice recorder when recording
  if (isRecording) {
    return (
      <View style={[styles.inputContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.inputRow, { backgroundColor: colors.inputBackground }]}>
          <InlineVoiceRecorder
            isRecording={isRecording}
            duration={recordingDuration}
            onStop={onVoiceStop}
            onCancel={onVoiceCancel}
          />
        </View>

        <Pressable
          onPress={onVoiceStop}
          style={[styles.sendButton, { backgroundColor: colors.primary }]}>
          <IconSymbol name="arrow.up" size={22} color="#ffffff" />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.inputContainer, { backgroundColor: colors.background }]}>
      <View style={[styles.inputRow, { backgroundColor: colors.inputBackground }]}>
        <Pressable onPress={onAttachment} style={styles.inputIconButton}>
          <IconSymbol name="plus.circle.fill" size={26} color={colors.primary} />
        </Pressable>

        <TextInput
          style={[styles.textInput, { color: colors.text }]}
          placeholder="Type a message..."
          placeholderTextColor={colors.textSecondary}
          value={value}
          onChangeText={handleTextChange}
          multiline
          maxLength={1000}
        />
      </View>

      <Pressable
        onPress={value.trim() ? onSend : onVoiceStart}
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
  const { id: chatId } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { user } = useAuth();
  const { initiateCall } = useCall();

  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // Voice recording
  const {
    recording: voiceRecording,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceRecorder();

  // Fetch chat and messages
  const fetchData = useCallback(async () => {
    if (!chatId) return;

    try {
      const [chatData, messagesData] = await Promise.all([
        chatApi.getChat(chatId),
        chatApi.getMessages(chatId, 1, 50),
      ]);

      setChat(chatData);
      setMessages(messagesData.messages);
      setHasMore(messagesData.pagination.hasMore);
      setPage(1);

      // Mark messages as read
      chatApi.markAsRead(chatId);
      socketService.markAsRead(chatId);
    } catch (error) {
      console.error('Error fetching chat data:', error);
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  // Load more messages (pagination)
  const loadMoreMessages = useCallback(async () => {
    if (!chatId || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const messagesData = await chatApi.getMessages(chatId, nextPage, 50);

      setMessages((prev) => [...messagesData.messages, ...prev]);
      setHasMore(messagesData.pagination.hasMore);
      setPage(nextPage);
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [chatId, page, loadingMore, hasMore]);

  // Initialize
  useEffect(() => {
    fetchData();

    // Join chat room
    if (chatId) {
      socketService.joinChat(chatId);
    }

    return () => {
      // Leave chat room
      if (chatId) {
        socketService.leaveChat(chatId);
      }
    };
  }, [chatId, fetchData]);

  // Socket event listeners
  useEffect(() => {
    // New message received
    const unsubscribeNewMessage = socketService.on('new_message', (message: Message) => {
      if (message.chatId === chatId) {
        setMessages((prev) => [...prev, message]);

        // Mark as delivered
        socketService.markAsDelivered(message.id);

        // Mark as read since we're viewing the chat
        socketService.markAsRead(chatId!);

        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    });

    // Message sent confirmation
    const unsubscribeMessageSent = socketService.on('message_sent', (data: { tempId: string; message: Message }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.tempId ? { ...data.message, status: 'SENT' } : msg
        )
      );
    });

    // Message error
    const unsubscribeMessageError = socketService.on('message_error', (data: { tempId: string; error: string }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.tempId ? { ...msg, status: 'FAILED' } : msg
        )
      );
    });

    // Message status updates
    const unsubscribeMessageStatus = socketService.on('message_status', (data: any) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId ? { ...msg, status: data.status } : msg
        )
      );
    });

    // Messages read
    const unsubscribeMessagesRead = socketService.on('messages_read', (data: any) => {
      if (data.chatId === chatId) {
        setMessages((prev) =>
          prev.map((msg) =>
            data.messageIds.includes(msg.id) ? { ...msg, status: 'READ' } : msg
          )
        );
      }
    });

    // Typing indicator
    const unsubscribeTyping = socketService.on('user_typing', (data: any) => {
      if (data.chatId === chatId) {
        setIsTyping(data.isTyping);
      }
    });

    // Online status
    const unsubscribeOnlineStatus = socketService.on('online_status', (data: any) => {
      setChat((prev) =>
        prev ? { ...prev, isOnline: data.isOnline, lastSeen: data.lastSeen } : prev
      );
    });

    return () => {
      unsubscribeNewMessage();
      unsubscribeMessageSent();
      unsubscribeMessageError();
      unsubscribeMessageStatus();
      unsubscribeMessagesRead();
      unsubscribeTyping();
      unsubscribeOnlineStatus();
    };
  }, [chatId]);

  const handleBack = () => {
    router.back();
  };

  const handleCall = async () => {
    if (!chat || chat.type !== 'PRIVATE') return;

    // Get the other participant
    const otherMember = chat.members?.find((m) => m.user.id !== user?.id);
    if (!otherMember) return;

    await initiateCall(
      otherMember.user.id,
      otherMember.user.name,
      otherMember.user.avatar,
      'VOICE'
    );
    router.push('/call/active');
  };

  const handleVideoCall = async () => {
    if (!chat || chat.type !== 'PRIVATE') return;

    // Get the other participant
    const otherMember = chat.members?.find((m) => m.user.id !== user?.id);
    if (!otherMember) return;

    await initiateCall(
      otherMember.user.id,
      otherMember.user.name,
      otherMember.user.avatar,
      'VIDEO'
    );
    router.push('/call/active');
  };

  const handleSend = () => {
    if (!messageText.trim() || !chatId || !user) return;

    const tempId = generateTempId();

    // Optimistic update
    const optimisticMessage: Message = {
      id: tempId,
      chatId,
      senderId: user.id,
      type: 'TEXT',
      content: messageText.trim(),
      status: 'SENDING',
      isForwarded: false,
      createdAt: new Date().toISOString(),
      sender: {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
      },
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setMessageText('');

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Send via WebSocket
    socketService.sendMessage({
      chatId,
      type: 'TEXT',
      content: messageText.trim(),
      tempId,
    });

    // Stop typing indicator
    socketService.stopTyping(chatId);
  };

  const handleAttachment = () => {
    setShowAttachmentMenu(true);
  };

  const handleAttachmentSelect = async (type: string) => {
    let media: PickedMedia | null = null;

    switch (type) {
      case 'camera':
        media = await takePhoto();
        break;
      case 'gallery':
        media = await pickImage();
        break;
      case 'video':
        media = await pickVideo();
        break;
      case 'document':
        media = await pickDocument();
        break;
      case 'location':
        const location = await getCurrentLocation();
        if (location) {
          await sendLocationMessage(location);
        }
        return;
      default:
        console.log('Attachment type not implemented:', type);
        return;
    }

    if (media) {
      await sendMediaMessage(media);
    }
  };

  const sendLocationMessage = async (location: LocationData) => {
    if (!chatId || !user) return;

    const tempId = generateTempId();

    // Create optimistic message
    const optimisticMessage: Message = {
      id: tempId,
      chatId,
      senderId: user.id,
      type: 'LOCATION',
      latitude: location.latitude,
      longitude: location.longitude,
      locationName: location.name,
      status: 'SENDING',
      isForwarded: false,
      createdAt: new Date().toISOString(),
      sender: {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
      },
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Send via WebSocket
    socketService.sendMessage({
      chatId,
      type: 'LOCATION',
      latitude: location.latitude,
      longitude: location.longitude,
      locationName: location.name,
      tempId,
    });
  };

  const sendMediaMessage = async (media: PickedMedia) => {
    if (!chatId || !user) return;

    const tempId = generateTempId();
    const messageType = getMessageTypeFromMimeType(media.mimeType);

    // Create optimistic message
    const optimisticMessage: Message = {
      id: tempId,
      chatId,
      senderId: user.id,
      type: messageType,
      content: media.type === 'document' ? media.name : undefined,
      mediaUrl: media.uri,
      mediaType: media.mimeType,
      mediaDuration: media.duration ? Math.floor(media.duration / 1000) : undefined,
      fileName: media.name,
      fileSize: media.size,
      status: 'SENDING',
      isForwarded: false,
      createdAt: new Date().toISOString(),
      sender: {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
      },
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    setIsUploading(true);

    try {
      // Upload file
      const uploadResult = await uploadApi.uploadFile(
        {
          uri: media.uri,
          type: media.mimeType,
          name: media.name,
        },
        'messages'
      );

      // Send message via WebSocket
      socketService.sendMessage({
        chatId,
        type: messageType,
        mediaUrl: uploadResult.url,
        mediaType: media.mimeType,
        mediaDuration: media.duration ? Math.floor(media.duration / 1000) : undefined,
        fileName: media.name,
        fileSize: media.size,
        tempId,
      });
    } catch (error) {
      console.error('Error uploading media:', error);
      // Mark message as failed
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId ? { ...msg, status: 'FAILED' } : msg
        )
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleVoiceStart = () => {
    startRecording();
  };

  const handleVoiceStop = async () => {
    const result = await stopRecording();
    if (result && result.uri && chatId && user) {
      // Send voice message
      const tempId = generateTempId();
      const durationSeconds = Math.floor(result.duration / 1000);

      // Create optimistic message
      const optimisticMessage: Message = {
        id: tempId,
        chatId,
        senderId: user.id,
        type: 'AUDIO',
        mediaUrl: result.uri,
        mediaType: 'audio/m4a',
        mediaDuration: durationSeconds,
        status: 'SENDING',
        isForwarded: false,
        createdAt: new Date().toISOString(),
        sender: {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
        },
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      try {
        // Upload voice file
        const uploadResult = await uploadApi.uploadFile(
          {
            uri: result.uri,
            type: 'audio/m4a',
            name: `voice_${Date.now()}.m4a`,
          },
          'voice'
        );

        // Send message via WebSocket
        socketService.sendMessage({
          chatId,
          type: 'AUDIO',
          mediaUrl: uploadResult.url,
          mediaType: 'audio/m4a',
          mediaDuration: durationSeconds,
          tempId,
        });
      } catch (error) {
        console.error('Error uploading voice message:', error);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? { ...msg, status: 'FAILED' } : msg
          )
        );
      }
    }
  };

  const handleVoiceCancel = () => {
    cancelRecording();
  };

  const handleTypingStart = () => {
    if (chatId) {
      socketService.startTyping(chatId);
    }
  };

  const handleTypingStop = () => {
    if (chatId) {
      socketService.stopTyping(chatId);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageBubble message={item} isMe={item.senderId === user?.id} />
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.backgroundSecondary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      {/* Custom Header */}
      <ChatHeader
        chat={chat}
        isTyping={isTyping}
        onBack={handleBack}
        onCall={handleCall}
        onVideoCall={handleVideoCall}
      />

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.messagesContent}
        style={styles.messagesList}
        onEndReached={loadMoreMessages}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          loadingMore ? (
            <ActivityIndicator size="small" color={colors.primary} style={styles.loadingMore} />
          ) : null
        }
        onContentSizeChange={() => {
          if (messages.length > 0 && page === 1) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
      />

      {/* Message Input */}
      <MessageInput
        value={messageText}
        onChange={setMessageText}
        onSend={handleSend}
        onAttachment={handleAttachment}
        onVoiceStart={handleVoiceStart}
        onVoiceStop={handleVoiceStop}
        onVoiceCancel={handleVoiceCancel}
        isRecording={voiceRecording.isRecording}
        recordingDuration={voiceRecording.duration}
        onTypingStart={handleTypingStart}
        onTypingStop={handleTypingStop}
      />

      {/* Attachment Menu */}
      <AttachmentMenu
        visible={showAttachmentMenu}
        onClose={() => setShowAttachmentMenu(false)}
        onSelect={handleAttachmentSelect}
      />
    </KeyboardAvoidingView>
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
    flex: 1,
  },
  headerUsername: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerStatus: {
    fontSize: 13,
  },
  headerActionButton: {
    padding: 10,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  loadingMore: {
    paddingVertical: 10,
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
  replyContainer: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginBottom: 4,
    opacity: 0.7,
  },
  replyName: {
    fontSize: 12,
    fontWeight: '600',
  },
  replyText: {
    fontSize: 12,
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
  mediaContainer: {
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  mediaText: {
    marginTop: 8,
    fontSize: 14,
  },
  imagePreview: {
    width: 220,
    height: 220,
    borderRadius: 12,
  },
  videoContainer: {
    position: 'relative',
  },
  videoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    minWidth: 150,
    gap: 8,
  },
  audioDuration: {
    fontSize: 12,
  },
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  documentName: {
    marginLeft: 12,
    fontSize: 14,
    flex: 1,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    minWidth: 180,
  },
  locationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationName: {
    fontSize: 14,
    fontWeight: '500',
  },
  locationCoords: {
    fontSize: 12,
    marginTop: 2,
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
    paddingHorizontal: 4,
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

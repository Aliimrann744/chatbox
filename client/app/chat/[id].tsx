import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Alert, Dimensions, FlatList, ImageBackground, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS, interpolate, Extrapolation, FadeIn, FadeOut } from 'react-native-reanimated';
import { Avatar } from '@/components/ui/avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AudioPlayer } from '@/components/chat/audio-player';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { chatApi, Chat, Message, uploadApi, contactApi, Contact } from '@/services/api';
import socketService from '@/services/socket';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '@/contexts/auth-context';
import { useCall } from '@/contexts/call-context';
import { pickImage, pickVideo, pickDocument, takePhoto, PickedMedia, getMessageTypeFromMimeType } from '@/utils/media-picker';
import { getCurrentLocation, LocationData, openInMaps } from '@/utils/location-picker';
import { formatTime, generateTempId, getInitials, getStatusText } from '@/utils/helpers';
import { cache, CacheKeys } from '@/services/cache';
import { useNotificationContext } from '@/contexts/notification-context';

type SenderLookupUser = { name?: string; phone?: string; countryCode?: string };

// ==================== GROUP READ RECEIPTS ====================
// For group chats we cannot rely on Message.status alone (the server flips it
// to READ as soon as the first member reads). Instead we count the number of
// distinct non-sender members who have a MessageReadReceipt for this message
// and compare it to the number of members who were in the group at the time
// the message was sent. This gives WhatsApp-style dynamic ticks that scale to
// any group size without extra server work.

type GroupReadState = 'single' | 'double_gray' | 'double_blue';
type EligibleMember = { userId: string; joinedAtMs: number; leftAtMs: number | null };

function computeGroupReadState(
  message: Message,
  eligibleMembers: EligibleMember[],
  senderId: string,
): GroupReadState {
  const sentMs = new Date(message.createdAt).getTime();

  // Denominator = members present at send time, excluding the sender.
  // A member "was present" if they joined on/before the send time and had
  // not yet left (leftAt is null or after the send time).
  const denominator = new Set<string>();
  for (const m of eligibleMembers) {
    if (m.userId === senderId) continue;
    if (m.joinedAtMs > sentMs) continue;
    if (m.leftAtMs !== null && m.leftAtMs <= sentMs) continue;
    denominator.add(m.userId);
  }

  // Edge case: sender is the only eligible participant. Treat as fully read
  // so the bubble doesn't get stuck on a single gray tick forever.
  if (denominator.size === 0) return 'double_blue';

  // Numerator = distinct receipts from users who are in the denominator set.
  // Filtering by the denominator set implicitly handles users who joined
  // after the message was sent (they don't count) and also caps S <= N.
  const seen = new Set<string>();
  const receipts = message.readReceipts || [];
  for (const r of receipts) {
    if (r.userId === senderId) continue;
    if (!denominator.has(r.userId)) continue;
    seen.add(r.userId);
  }

  if (seen.size === 0) return 'single';
  if (seen.size >= denominator.size) return 'double_blue';
  return 'double_gray';
}
function resolveSenderDisplayName(msg: Message,contactsById: Record<string, Contact>, memberUserById: Record<string, SenderLookupUser>): string {
  const contact = contactsById[msg.senderId];
  if (contact) return contact.nickname || contact.name;
  const member = memberUserById[msg.senderId];
  if (member?.phone && member?.countryCode) return `${member.countryCode}${member.phone}`;
  if (member?.phone) return member.phone;
  return member?.name || msg.sender?.name || 'Unknown';
}

function getReplyPreviewText(msg: Message | { type?: string; content?: string | null; fileName?: string | null; locationName?: string | null; isDeletedForEveryone?: boolean }): string {
  if (!msg) return '';
  if ((msg as any).isDeletedForEveryone) return 'Message deleted';
  switch (msg.type) {
    case 'TEXT':
      return msg.content || '';
    case 'IMAGE':
      return msg.content ? `📷 ${msg.content}` : '📷 Photo';
    case 'VIDEO':
      return msg.content ? `🎥 ${msg.content}` : '🎥 Video';
    case 'AUDIO':
      return '🎤 Voice message';
    case 'DOCUMENT':
      return `📄 ${(msg as any).fileName || 'Document'}`;
    case 'LOCATION':
      return `📍 ${(msg as any).locationName || 'Location'}`;
    case 'CONTACT':
      return '👤 Contact';
    case 'STICKER':
      return '🎨 Sticker';
    case 'CALL': {
      try {
        const info = JSON.parse(msg.content || '{}');
        const isVoice = info.callType === 'VOICE';
        const label = isVoice ? 'Voice call' : 'Video call';
        if (info.callStatus === 'MISSED') return `📞 ${label} • Missed`;
        if (info.callStatus === 'DECLINED') return `📞 ${label} • Declined`;
        if (info.callStatus === 'ENDED' && info.duration) {
          const m = Math.floor(info.duration / 60);
          const s = info.duration % 60;
          return `📞 ${label} • ${m}:${s.toString().padStart(2, '0')}`;
        }
        return `📞 ${label}`;
      } catch { return '📞 Call'; }
    }
    default:
      return msg.content || '';
  }
}

function SwipeToReply({ children, onReply, enabled, isMe }: { children: React.ReactNode; onReply: () => void; enabled: boolean; isMe: boolean; }) {
  const translateX = useSharedValue(0);
  const THRESHOLD = 55;
  const MAX = 80;

  const trigger = () => {
    onReply();
  };

  const pan = Gesture.Pan().enabled(enabled).activeOffsetX([-9999, 10]).failOffsetY([-12, 12]).onUpdate((e) => {
      if (e.translationX > 0) {
        translateX.value = Math.min(e.translationX, MAX);
      } else {
        translateX.value = 0;
      }
    })
    .onEnd((e) => {
      if (e.translationX > THRESHOLD) {
        runOnJS(trigger)();
      }
      translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, THRESHOLD * 0.6, THRESHOLD],
      [0, 0.6, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          translateX.value,
          [0, THRESHOLD],
          [0.5, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={{ position: 'relative' }}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 14,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'rgba(0,0,0,0.08)',
              alignSelf: 'center',
            },
            iconStyle,
          ]}
        >
          <Ionicons name="arrow-undo" size={18} color="#667781" />
        </Animated.View>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

function MessageBubble({ message, isMe, onImagePress, onVideoPress, isSelected, isSelectionMode, onSelect, onLongPress, onReply, isGroup, showSenderInfo, senderDisplayName, senderAvatar, groupReadState }: {
  message: Message; isMe: boolean;
  onImagePress?: (url: string) => void;
  onVideoPress?: (url: string) => void;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onSelect?: () => void;
  onLongPress?: () => void;
  onReply?: (msg: Message) => void;
  isGroup?: boolean;
  showSenderInfo?: boolean;
  senderDisplayName?: string;
  senderAvatar?: string;
  groupReadState?: GroupReadState;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  if (message.type === 'SYSTEM') {
    return (
      <View style={styles.systemMessageWrapper}>
        <View style={[styles.systemMessageBubble, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.systemMessageText, { color: colors.textSecondary }]}>
            {message.content || ''}
          </Text>
        </View>
      </View>
    );
  }

  if (message.isDeletedForEveryone) {
    const deletedText = isMe ? 'You deleted this message' : 'This message was deleted';
    const deletedGroupOther = !!isGroup && !isMe;
    const deletedPressable = (
      <Pressable onPress={() => { if (isSelectionMode && onSelect) onSelect(); }} onLongPress={onLongPress} delayLongPress={400}
        style={[
          styles.messageBubbleContainer,
          isMe ? styles.messageBubbleContainerMe : styles.messageBubbleContainerOther,
          deletedGroupOther && styles.messageBubbleContainerGroupOther,
          isSelectionMode && styles.messageBubbleContainerSelection,
          isSelected && styles.messageBubbleSelected,
        ]}
      >
        {isSelectionMode && (
          <View style={styles.selectionCheckbox}>
            <Ionicons
              name={isSelected ? 'checkbox' : 'square-outline'}
              size={22}
              color={isSelected ? colors.primary : colors.textSecondary}
            />
          </View>
        )}
        <View style={[
          styles.messageBubble,
          isMe ? [{ backgroundColor: colors.messageOutgoing }, styles.messageBubbleMe] :
          [{ backgroundColor: colors.messageIncoming }, styles.messageBubbleOther],
          !isMe && colorScheme === 'light' && styles.messageBubbleBorder,
          { opacity: 0.7 },
        ]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 }}>
            <Ionicons name="ban-outline" size={16} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 14, fontStyle: 'italic' }}>
              {deletedText}
            </Text>
            <Text style={[styles.messageTime, { color: colors.textSecondary }]}>
              {formatTime(message.createdAt)}
            </Text>
          </View>
        </View>
      </Pressable>
    );

    if (deletedGroupOther) {
      return (
        <View style={styles.groupMessageRow}>
          <View style={styles.groupAvatarSlot} />
          <View style={styles.groupMessageColumn}>{deletedPressable}</View>
        </View>
      );
    }
    return deletedPressable;
  }

  const isMediaMessage = message.type === 'IMAGE' || message.type === 'VIDEO';

  const renderContent = () => {
    switch (message.type) {
      case 'IMAGE':
        return (
          <View style={styles.mediaContainer}>
            {message.mediaUrl ? (
              <Pressable onPress={() => onImagePress?.(message.mediaUrl!)}>
                <Image
                  source={{ uri: message.mediaUrl }}
                  style={styles.imagePreview}
                  contentFit="cover"
                />
                <View style={styles.mediaTimeOverlay}>
                  {message.isStarred && (
                    <Ionicons name="star" size={10} color="#ffffff" />
                  )}
                  <Text style={styles.mediaTimeText}>
                    {formatTime(message.createdAt)}
                  </Text>
                  {isMe && renderStatus(true)}
                </View>
              </Pressable>
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
            <Pressable onPress={() => message.mediaUrl && onVideoPress?.(message.mediaUrl)}>
              <View style={styles.videoContainer}>
                {message.thumbnail ? (
                  <Image
                    source={{ uri: message.thumbnail }}
                    style={styles.imagePreview}
                    contentFit="cover"
                  />
                ) : message.mediaUrl ? (
                  <Video
                    source={{ uri: message.mediaUrl }}
                    style={styles.imagePreview}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={false}
                    isMuted
                  />
                ) : (
                  <View style={[styles.imagePreview, styles.videoPlaceholder]}>
                    <Ionicons name="videocam" size={40} color="rgba(255,255,255,0.7)" />
                  </View>
                )}
                <View style={styles.videoPlayOverlay}>
                  <View style={styles.videoPlayButton}>
                    <Ionicons name="play" size={28} color="#ffffff" />
                  </View>
                </View>
                {message.mediaDuration ? (
                  <View style={styles.videoDurationBadge}>
                    <Text style={styles.videoDurationText}>
                      {Math.floor(message.mediaDuration / 60)}:{(message.mediaDuration % 60).toString().padStart(2, '0')}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.mediaTimeOverlay}>
                  {message.isStarred && (
                    <Ionicons name="star" size={10} color="#ffffff" />
                  )}
                  <Text style={styles.mediaTimeText}>
                    {formatTime(message.createdAt)}
                  </Text>
                  {isMe && renderStatus(true)}
                </View>
              </View>
            </Pressable>
          </View>
        );
      case 'AUDIO':
        return message.mediaUrl ? (
          <AudioPlayer uri={message.mediaUrl} duration={message.mediaDuration ? message.mediaDuration * 1000 : 0} isOwnMessage={isMe} />
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
      case 'CALL': {
        let callInfo: { callType?: string; callStatus?: string; duration?: number | null } = {};
        try {
          callInfo = JSON.parse(message.content || '{}');
        } catch {}

        const isVoice = callInfo.callType === 'VOICE';
        const isMissed = callInfo.callStatus === 'MISSED';
        const isDeclined = callInfo.callStatus === 'DECLINED';
        const wasAnswered = callInfo.callStatus === 'ENDED' && callInfo.duration;

        const iconName = isVoice ? 'call' : 'videocam';
        const iconColor = (isMissed || isDeclined) ? '#FF3B30' : '#34C759';

        let label = '';
        if (isMissed) {
          label = isMe ? 'No answer' : 'Missed call';
        } else if (isDeclined) {
          label = isMe ? 'Cancelled' : 'Declined';
        } else if (wasAnswered) {
          const mins = Math.floor((callInfo.duration || 0) / 60);
          const secs = (callInfo.duration || 0) % 60;
          label = `${isVoice ? 'Voice' : 'Video'} call · ${mins}:${secs.toString().padStart(2, '0')}`;
        } else {
          label = `${isVoice ? 'Voice' : 'Video'} call`;
        }

        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 }}>
            <Ionicons name={iconName} size={20} color={iconColor} />
            <Text style={{ color: colors.text, fontSize: 14 }}>{label}</Text>
          </View>
        );
      }
      default:
        return null;
    }
  };

  const renderStatus = (forMedia = false) => {
    if (!isMe) return null;

    const tickColor = forMedia ? '#ffffff' : (colorScheme === 'dark' ? '#8696a0' : '#667781');
    const readColor = forMedia ? '#53bdeb' : '#53bdeb';

    // SENDING / FAILED are transport states — always take precedence.
    if (message.status === 'SENDING') {
      return <Ionicons name="time-outline" size={14} color={tickColor} />;
    }
    if (message.status === 'FAILED') {
      return <Ionicons name="alert-circle" size={14} color="#FF3B30" />;
    }

    // Group chats: use per-member read receipts (S vs N) rather than the
    // coarse Message.status enum, which cannot represent "read by some".
    if (isGroup && groupReadState) {
      switch (groupReadState) {
        case 'single':
          return <Ionicons name="checkmark" size={16} color={tickColor} />;
        case 'double_gray':
          return <Ionicons name="checkmark-done" size={16} color={tickColor} />;
        case 'double_blue':
          return <Ionicons name="checkmark-done" size={16} color={readColor} />;
      }
    }

    // Private chats: fall back to the existing status enum behavior.
    switch (message.status) {
      case 'READ':
        return <Ionicons name="checkmark-done" size={16} color={readColor} />;
      case 'DELIVERED':
        return <Ionicons name="checkmark-done" size={16} color={tickColor} />;
      case 'SENT':
      default:
        return <Ionicons name="checkmark" size={16} color={tickColor} />;
    }
  };

  const timeColor = isMe ? (colorScheme === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)') : colors.textSecondary;
  const isTextMessage = message.type === 'TEXT' || (!['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'LOCATION', 'CALL'].includes(message.type || ''));
  const isGroupOther = !!isGroup && !isMe;

  const bubblePressable = (
    <Pressable
      onPress={() => {
        if (isSelectionMode && onSelect) {
          onSelect();
        }
      }}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={[
        styles.messageBubbleContainer,
        isMe ? styles.messageBubbleContainerMe : styles.messageBubbleContainerOther,
        isGroupOther && styles.messageBubbleContainerGroupOther,
        isSelectionMode && styles.messageBubbleContainerSelection,
        isSelected && styles.messageBubbleSelected,
      ]}
    >
      {isSelectionMode && (
        <View style={styles.selectionCheckbox}>
          <Ionicons
            name={isSelected ? 'checkbox' : 'square-outline'}
            size={22}
            color={isSelected ? colors.primary : colors.textSecondary}
          />
        </View>
      )}
      <View style={[
        styles.messageBubble,
        isMe ? [{ backgroundColor: colors.messageOutgoing }, styles.messageBubbleMe] :
        [{ backgroundColor: colors.messageIncoming }, styles.messageBubbleOther],
        !isMe && colorScheme === 'light' && styles.messageBubbleBorder,
        isMediaMessage && styles.mediaBubble,
      ]}>
        {isGroupOther && showSenderInfo && !!senderDisplayName && (
          <Text style={[styles.bubbleSenderName, { color: "rgb(72, 197, 255)" }]} numberOfLines={1}>
            {senderDisplayName}
          </Text>
        )}
        {message.replyTo && (
          <View style={[styles.replyContainer, { borderLeftColor: colors.primary, backgroundColor: isMe ? 'rgba(23, 54, 195, 0.06)' : 'rgba(0,0,0,0.04)' }]}>
            <Text style={[styles.replyName, { color: colorScheme === 'dark' ? "rgb(72, 197, 255)" : colors.primary }]} numberOfLines={1}>
              {message.replyTo.sender.name}
            </Text>
            <Text style={[styles.replyText, { color: colors.textSecondary }]} numberOfLines={1}>
              {getReplyPreviewText(message.replyTo as any)}
            </Text>
          </View>
        )}
        {isTextMessage ? (
          <View style={styles.textMessageRow}>
            <Text style={[styles.messageText, { color: colorScheme === 'dark' ? '#e9edef' : '#111b21' }]}>
              {message.content}
            </Text>
            <View style={styles.inlineTimeContainer}>
              {message.isStarred && (
                <Ionicons name="star" size={10} color={timeColor} />
              )}
              <Text style={[styles.messageTime, { color: timeColor }]}>
                {formatTime(message.createdAt)}
              </Text>
              {renderStatus()}
            </View>
          </View>
        ) : (
          <>
            {renderContent()}
            {!isMediaMessage && (
              <View style={styles.messageFooter}>
                {message.isStarred && (
                  <Ionicons name="star" size={10} color={timeColor} />
                )}
                <Text style={[styles.messageTime, { color: timeColor }]}>
                  {formatTime(message.createdAt)}
                </Text>
                {renderStatus()}
              </View>
            )}
          </>
        )}
      </View>
    </Pressable>
  );

  if (isGroupOther) {
    return (
      <SwipeToReply enabled={!isSelectionMode && !!onReply} isMe={isMe} onReply={() => onReply && onReply(message)}>
        <View style={styles.groupMessageRow}>
          <View style={styles.groupAvatarSlot}>
            {showSenderInfo ? (
              senderAvatar ? (
                <Avatar uri={senderAvatar} size={28} />
              ) : (
                <View style={styles.groupAvatarFallback}>
                  <Text style={styles.groupAvatarFallbackText}>
                    {getInitials(senderDisplayName || '') || '?'}
                  </Text>
                </View>
              )
            ) : null}
          </View>
          <View style={styles.groupMessageColumn}>
            {bubblePressable}
          </View>
        </View>
      </SwipeToReply>
    );
  }

  return (
    <SwipeToReply enabled={!isSelectionMode && !!onReply} isMe={isMe} onReply={() => onReply && onReply(message)}>
      {bubblePressable}
    </SwipeToReply>
  );
}

function ChatHeader({ chat, isTyping, onBack, onCall, onVideoCall, onUserInfoPress, onMenuPress }: { chat: any; isTyping: boolean; onBack: () => void; onCall: () => void; onVideoCall: () => void; onUserInfoPress?: () => void; onMenuPress?: () => void; }) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const statusText = getStatusText(isTyping, chat);

  return (
    <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 2 }]}>
      <Pressable onPress={onBack} style={styles.headerBackButton} hitSlop={8}>
        <IconSymbol name="chevron.left" size={28} color={colors.headerText} />
      </Pressable>

      <Pressable style={styles.headerUserInfo} onPress={onUserInfoPress}>
        {chat?.avatar ? (
          <Avatar uri={chat.avatar} size={38} showOnlineStatus isOnline={chat?.isOnline} />
        ) : (
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#374151" }}>
              {getInitials(chat?.name) || "U"}
            </Text>
          </View>
        )}
        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerUsername, { color: colors.headerText }]} numberOfLines={1}>
            {chat?.name || 'User'}
          </Text>
          {statusText ? (
            <Text
              style={[
                styles.headerStatus,
                { color: isTyping ? '#25D366' : 'rgba(255, 255, 255, 0.7)' },
              ]}
              numberOfLines={1}
            >
              {statusText}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.headerActions}>
        <Pressable onPress={onVideoCall} style={styles.headerActionButton} hitSlop={8}>
          <Ionicons name="videocam" size={22} color={colors.headerText} />
        </Pressable>
        <Pressable onPress={onCall} style={styles.headerActionButton} hitSlop={8}>
          <Ionicons name="call" size={20} color={colors.headerText} />
        </Pressable>
        <Pressable onPress={onMenuPress} style={styles.headerActionButton} hitSlop={8}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.headerText} />
        </Pressable>
      </View>
    </View>
  );
}

function AttachmentMenu({ visible, onClose, onSelect }: { visible: boolean; onClose: () => void; onSelect: (type: string) => void; }) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  if (!visible) return null;

  const attachmentOptions = [
    { icon: 'doc.fill' as const, label: 'Document', type: 'document', color: '#5856D6' },
    { icon: 'camera.fill' as const, label: 'Camera', type: 'camera', color: '#FF3B30' },
    { icon: 'photo' as const, label: 'Photos', type: 'gallery', color: '#FF9500' },
    { icon: 'video.fill' as const, label: 'Video', type: 'video', color: '#AF52DE' },
    { icon: 'location.fill' as const, label: 'Location', type: 'location', color: '#34C759' },
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

function MessageInput({ value, onChange, onSend, onAttachment, onSelect, onVoiceStart, onVoiceStop, onVoiceCancel, isRecording, recordingDuration, onTypingStart, onTypingStop, replyingTo, onCancelReply, currentUserId }: {
  value: string;
  onChange: (text: string) => void;
  onSend: () => void;
  onAttachment: () => void;
  onSelect: (type: string) => void;
  onVoiceStart: () => void;
  onVoiceStop: () => void;
  onVoiceCancel: () => void;
  isRecording: boolean;
  recordingDuration: number;
  onTypingStart: () => void;
  onTypingStop: () => void;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  currentUserId?: string;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null | any>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const bottomPadding = keyboardVisible ? 6 : insets.bottom + 6;

  const replyPreview = replyingTo ? (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(120)}
      style={[styles.replyPreviewContainer, { backgroundColor: colors.backgroundSecondary }]}
    >
      <View style={[styles.replyPreviewBar, { backgroundColor: colors.primary }]} />
      <View style={styles.replyPreviewContent}>
        <Text style={[styles.replyPreviewName, { color: colors.primary }]} numberOfLines={1}>
          {replyingTo.senderId === currentUserId ? 'You' : (replyingTo.sender?.name || 'Unknown')}
        </Text>
        <Text style={[styles.replyPreviewText, { color: colors.textSecondary }]} numberOfLines={1}>
          {getReplyPreviewText(replyingTo as any)}
        </Text>
      </View>
      <Pressable onPress={onCancelReply} hitSlop={10} style={styles.replyPreviewClose}>
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </Pressable>
    </Animated.View>
  ) : null;

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

  // Show voice recorder when recording — WhatsApp style
  if (isRecording) {
    return (
      <View>
        {replyPreview}
        <View style={[styles.inputContainer, { paddingBottom: bottomPadding }]}>
          {/* Delete button */}
          <Pressable onPress={onVoiceCancel} style={styles.voiceDeleteButton}>
            <Ionicons name="trash" size={22} color="#FF3B30" />
          </Pressable>

          {/* Recording indicator */}
          <View style={[styles.voiceRecordingRow, { backgroundColor: colors.inputBackground }]}>
            <View style={styles.voiceRecordingDot} />
            <Text style={[styles.voiceRecordingTime, { color: colors.text }]}>
              {Math.floor(recordingDuration / 60000)}:{Math.floor((recordingDuration % 60000) / 1000).toString().padStart(2, '0')}
            </Text>
          </View>

          {/* Send button */}
          <Pressable onPress={onVoiceStop} style={[styles.sendButton, { backgroundColor: colors.primary }]}>
            <Ionicons name="send" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View>
      {replyPreview}
      <View style={[styles.inputContainer, { paddingBottom: bottomPadding }]}>
      <View style={[styles.inputRow, { backgroundColor: colors.inputBackground }]}>
        <TextInput
          style={[styles.textInput, { color: colors.text }]} placeholder="Type a message..."
          placeholderTextColor={colors.textSecondary} value={value} onChangeText={handleTextChange}
          multiline maxLength={1000} textAlignVertical="center"
        />

        <Pressable onPress={onAttachment} style={styles.inputIconButton}>
          <Ionicons name="attach" size={24} color={colors.textSecondary} />
        </Pressable>

        {!value.trim() && (
          <Pressable onPress={() => onSelect('camera')} style={styles.inputIconButton}>
            <Ionicons name="camera" size={22} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <Pressable onPress={value.trim() ? onSend : onVoiceStart} style={[styles.sendButton, { backgroundColor: colors.primary }]}>
        <Ionicons name={value.trim() ? "send" : "mic"} size={24} color="#fff" />
      </Pressable>
      </View>
    </View>
  );
}

function SelectionHeader({ count, onCancel, onStar, onDelete, onCopy, onForward, onReply, allStarred }: {
  count: number;
  onCancel: () => void;
  onStar: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onForward: () => void;
  onReply: () => void;
  allStarred?: boolean;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.selectionHeader, { backgroundColor: colors.primary, paddingTop: insets.top + 2 }]}>
      <Pressable onPress={onCancel} style={styles.headerBackButton} hitSlop={8}>
        <Ionicons name="arrow-back" size={24} color={colors.headerText} />
      </Pressable>
      <Text style={[styles.selectionCount, { color: colors.headerText }]}>{count}</Text>
      <View style={{ flex: 1 }} />
      {count === 1 && (
        <Pressable onPress={onReply} style={styles.selectionAction} hitSlop={8}>
          <Ionicons name="arrow-undo-outline" size={22} color={colors.headerText} />
        </Pressable>
      )}
      <Pressable onPress={onStar} style={styles.selectionAction} hitSlop={8}>
        <Ionicons name={allStarred ? "star" : "star-outline"} size={22} color={colors.headerText} />
      </Pressable>
      <Pressable onPress={onDelete} style={styles.selectionAction} hitSlop={8}>
        <Ionicons name="trash-outline" size={22} color={colors.headerText} />
      </Pressable>
      <Pressable onPress={onCopy} style={styles.selectionAction} hitSlop={8}>
        <Ionicons name="copy-outline" size={22} color={colors.headerText} />
      </Pressable>
      <Pressable onPress={onForward} style={styles.selectionAction} hitSlop={8}>
        <Ionicons name="arrow-redo-outline" size={22} color={colors.headerText} />
      </Pressable>
    </View>
  );
}

function ForwardModal({ visible, onClose, onForward }: {
  visible: boolean;
  onClose: () => void;
  onForward: (chatId: string) => void;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      chatApi.getChats().then((data) => {
        setChats(data);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [visible]);

  const filtered = chats.filter(c =>
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.forwardModal, { backgroundColor: colors.background }]}>
        <View style={[styles.forwardHeader, { backgroundColor: colors.primary }]}>
          <Pressable onPress={onClose} style={{ padding: 8 }}>
            <Ionicons name="arrow-back" size={24} color={colors.headerText} />
          </Pressable>
          <Text style={[styles.forwardTitle, { color: colors.headerText }]}>Forward to...</Text>
        </View>
        <View style={[styles.forwardSearchContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.forwardSearchInput, { color: colors.text }]}
            placeholder="Search..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onForward(item.id)}
                style={styles.forwardChatItem}
              >
                <Avatar uri={item.avatar || item.members?.[0]?.user?.avatar || ''} size={46} showOnlineStatus={false} />
                <Text style={[styles.forwardChatName, { color: colors.text }]} numberOfLines={1}>
                  {item.name || item.members?.map(m => m.user.name).join(', ') || 'Chat'}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

export default function ChatDetailScreen() {
  const { id: chatId } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { user } = useAuth();
  const { initiateCall } = useCall();
  const { setCurrentChatId } = useNotificationContext();

  const [cachedChat] = useState(() => chatId ? cache.get<Chat>(CacheKeys.chatDetail(chatId)) : null);
  const [cachedMessages] = useState(() => chatId ? cache.get<Message[]>(CacheKeys.messages(chatId)) : null);
  const hasCachedMessages = cachedMessages && cachedMessages.length > 0;
  const [chat, setChat] = useState<Chat | null>(cachedChat);
  const [messages, setMessages] = useState<Message[]>(cachedMessages || []);
  const [messageText, setMessageText] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [loading, setLoading] = useState(!hasCachedMessages);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [pendingMedia, setPendingMedia] = useState<PickedMedia | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [iBlockedThem, setIBlockedThem] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  // Get the other participant for PRIVATE chats
  const otherMember = chat?.members?.find((m) => m.user.id !== user?.id);
  const otherUser = otherMember?.user;

  // Contacts lookup for sender-name resolution in group chats
  const contactsById = useMemo(() => {
    const map: Record<string, Contact> = {};
    for (const c of contacts) map[c.contactId] = c;
    return map;
  }, [contacts]);

  const memberUserById = useMemo(() => {
    const map: Record<string, SenderLookupUser> = {};
    for (const m of chat?.members || []) {
      if (m?.user?.id) {
        map[m.user.id] = {
          name: m.user.name,
          phone: m.user.phone,
          countryCode: m.user.countryCode,
        };
      }
    }
    return map;
  }, [chat?.members]);

  // Precompute member join/leave timestamps once per chat.members update so
  // per-message read-state calculation stays O(receipts) instead of
  // O(members * receipts) during FlatList rendering. Scales to large groups.
  const eligibleMembers = useMemo<EligibleMember[]>(() => {
    const members = chat?.members || [];
    const arr: EligibleMember[] = [];
    for (const m of members) {
      const uid = m?.user?.id;
      if (!uid) continue;
      arr.push({
        userId: uid,
        joinedAtMs: m.joinedAt ? new Date(m.joinedAt).getTime() : 0,
        leftAtMs: m.leftAt ? new Date(m.leftAt).getTime() : null,
      });
    }
    return arr;
  }, [chat?.members]);

  // Load contacts once (used to display contact name vs phone number for group senders)
  useEffect(() => {
    let cancelled = false;
    contactApi.getContacts()
      .then((c) => { if (!cancelled) setContacts(c); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Check block status for private chats
  useEffect(() => {
    if (!otherUser?.id || chat?.type !== 'PRIVATE') return;
    let cancelled = false;
    contactApi.checkBlocked(otherUser.id)
      .then((result) => { if (!cancelled) setIBlockedThem(result.iBlockedThem); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [otherUser?.id, chat?.type]);

  // Voice recording
  const { recording: voiceRecording, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();

  // Fetch chat and messages
  const fetchData = useCallback(async () => {
    if (!chatId) return;

    try {
      const [chatData, messagesData] = await Promise.all([
        chatApi.getChat(chatId),
        chatApi.getMessages(chatId, 1, 50),
      ]);

      setChat(chatData);

      // Fetch starred messages and merge starred state
      let starredIds = new Set<string>();
      try {
        const starredData = await chatApi.getStarredMessages(chatId);
        starredIds = new Set(starredData.messages.map((m: any) => m.id || m.messageId));
      } catch {}

      const messagesWithStarred = messagesData.messages.map(msg => ({
        ...msg,
        isStarred: starredIds.has(msg.id),
      }));

      setMessages(messagesWithStarred);
      setHasMore(messagesData.pagination.hasMore);
      setPage(1);

      // Cache chat detail (messages are auto-cached by the useEffect sync)
      cache.set(CacheKeys.chatDetail(chatId), chatData);

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

  // Sync messages to cache whenever they change (sent, received, status updates, etc.)
  // When messages is empty (e.g. after clear chat), delete the cache entry
  // so stale data doesn't flash on next open.
  useEffect(() => {
    if (!chatId) return;
    if (messages.length > 0) {
      cache.set(CacheKeys.messages(chatId), messages);
    } else {
      cache.delete(CacheKeys.messages(chatId));
    }
  }, [chatId, messages]);

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

  // Track active chat for notification suppression
  useFocusEffect(
    useCallback(() => {
      if (chatId) {
        setCurrentChatId(chatId);
      }

      return () => {
        setCurrentChatId(null);
      };
    }, [chatId])
  );

  // Socket event listeners
  useEffect(() => {
    // New message received
    const unsubscribeNewMessage = socketService.on('new_message', (message: Message) => {
      if (message.chatId === chatId) {
        setMessages((prev) => {
          // Prevent duplicates — message may already exist from API fetch or prior socket event
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });

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

    // Messages read — append a per-user readReceipt (with dedup) so group
    // chats can transition single → double_gray → double_blue in real time.
    // Private chats continue to rely on the status = 'READ' update too.
    const unsubscribeMessagesRead = socketService.on('messages_read', (data: any) => {
      if (data.chatId !== chatId) return;
      const readerId: string | undefined = data.readBy;
      const messageIds: string[] = Array.isArray(data.messageIds) ? data.messageIds : [];
      if (messageIds.length === 0) return;
      const readAtIso = new Date().toISOString();
      const idSet = new Set(messageIds);
      setMessages((prev) =>
        prev.map((msg) => {
          if (!idSet.has(msg.id)) return msg;
          const existing = msg.readReceipts || [];
          const alreadyHasReceipt =
            !!readerId && existing.some((r) => r.userId === readerId);
          const nextReceipts =
            readerId && !alreadyHasReceipt
              ? [...existing, { userId: readerId, readAt: readAtIso }]
              : existing;
          return {
            ...msg,
            status: 'READ',
            readReceipts: nextReceipts,
          };
        })
      );
    });

    // Typing indicator
    const unsubscribeTyping = socketService.on('user_typing', (data: any) => {
      if (data.chatId === chatId) {
        setIsTyping(data.isTyping);
      }
    });

    // Message deleted for me (remove from view)
    const unsubscribeMessageDeleted = socketService.on('message_deleted', (data: any) => {
      setMessages((prev) => prev.filter((msg) => msg.id !== data.messageId));
    });

    // Message deleted for everyone (show placeholder)
    const unsubscribeMessageDeletedForEveryone = socketService.on('message_deleted_for_everyone', (data: any) => {
      if (data.chatId === chatId) {
        setMessages((prev: any) => prev?.map((msg: any) =>
          msg.id === data.messageId ? { ...msg, isDeletedForEveryone: true, content: null, mediaUrl: null } : msg
        ));
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
      unsubscribeMessageDeleted();
      unsubscribeMessageDeletedForEveryone();
      unsubscribeOnlineStatus();
    };
  }, [chatId]);

  const handleBack = () => {
    router.back();
  };

  const handleCall = async () => {
    if (!chat || chat.type !== 'PRIVATE' || !otherUser) return;

    await initiateCall(otherUser.id, otherUser.name, otherUser.avatar, 'VOICE');
    router.push('/call/active');
  };

  const handleVideoCall = async () => {
    if (!chat || chat.type !== 'PRIVATE' || !otherUser) return;

    await initiateCall(otherUser.id, otherUser.name, otherUser.avatar, 'VIDEO');
    router.push('/call/active');
  };

  const handleSend = () => {
    if (!messageText.trim() || !chatId || !user) return;

    const tempId = generateTempId();
    const replyToIdForSend = replyingTo?.id;
    const replyToForOptimistic = replyingTo
      ? {
          id: replyingTo.id,
          content: replyingTo.content,
          type: replyingTo.type,
          sender: { id: replyingTo.sender.id, name: replyingTo.sender.name },
        }
      : undefined;

    const optimisticMessage: Message = {
      id: tempId,
      chatId,
      senderId: user.id,
      type: 'TEXT',
      content: messageText.trim(),
      status: 'SENDING',
      isForwarded: false,
      createdAt: new Date().toISOString(),
      replyToId: replyToIdForSend,
      replyTo: replyToForOptimistic as any,
      sender: {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
      },
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setMessageText('');
    setReplyingTo(null);

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Prefer WebSocket, fall back to REST API
    if (socketService.isConnected) {
      socketService.sendMessage({
        chatId,
        type: 'TEXT',
        content: messageText.trim(),
        replyToId: replyToIdForSend,
        tempId,
      });
    } else {
      chatApi.sendMessage(chatId, { type: 'TEXT', content: messageText.trim(), replyToId: replyToIdForSend }).then((saved) => {
        setMessages((prev) =>
          prev.map((msg) => msg.id === tempId ? { ...saved, status: 'SENT' } : msg)
        );
      }).catch(() => {
        setMessages((prev) =>
          prev.map((msg) => msg.id === tempId ? { ...msg, status: 'FAILED' } : msg)
        );
      });
    }

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
          sendLocationMessage(location);
        }
        return;
      default:
        console.log('Attachment type not implemented:', type);
        return;
    }

    if (media) {
      setPendingMedia(media);
    }
  };

  const sendLocationMessage = async (location: LocationData) => {
    if (!chatId || !user) return;

    const tempId = generateTempId();
    const replyToIdForSend = replyingTo?.id;
    const replyToForOptimistic = replyingTo
      ? {
          id: replyingTo.id,
          content: replyingTo.content,
          type: replyingTo.type,
          sender: { id: replyingTo.sender.id, name: replyingTo.sender.name },
        }
      : undefined;

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
      replyToId: replyToIdForSend,
      replyTo: replyToForOptimistic as any,
      sender: {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
      },
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setReplyingTo(null);

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
      replyToId: replyToIdForSend,
      tempId,
    });
  };

  const sendMediaMessage = async (media: PickedMedia) => {
    if (!chatId || !user) return;

    const tempId = generateTempId();
    const messageType = getMessageTypeFromMimeType(media.mimeType);
    const replyToIdForSend = replyingTo?.id;
    const replyToForOptimistic = replyingTo
      ? {
          id: replyingTo.id,
          content: replyingTo.content,
          type: replyingTo.type,
          sender: { id: replyingTo.sender.id, name: replyingTo.sender.name },
        }
      : undefined;

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
      replyToId: replyToIdForSend,
      replyTo: replyToForOptimistic as any,
      sender: {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
      },
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setReplyingTo(null);

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

      const messagePayload = {
        type: messageType,
        mediaUrl: uploadResult.url,
        mediaType: media.mimeType,
        mediaDuration: media.duration ? Math.floor(media.duration / 1000) : undefined,
        fileName: media.name,
        fileSize: media.size,
        replyToId: replyToIdForSend,
      };

      // Prefer WebSocket, fall back to REST API if socket is disconnected
      if (socketService.isConnected) {
        socketService.sendMessage({ chatId, ...messagePayload, tempId });
      } else {
        const saved = await chatApi.sendMessage(chatId, messagePayload);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? { ...saved, status: 'SENT' } : msg
          )
        );
      }
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
      const replyToIdForSend = replyingTo?.id;
      const replyToForOptimistic = replyingTo
        ? {
            id: replyingTo.id,
            content: replyingTo.content,
            type: replyingTo.type,
            sender: { id: replyingTo.sender.id, name: replyingTo.sender.name },
          }
        : undefined;

      // Create optimistic message
      const optimisticMessage: Message = {
        id: tempId,
        chatId,
        senderId: user.id,
        type: 'AUDIO',
        mediaUrl: result.uri,
        mediaType: 'audio/mp4',
        mediaDuration: durationSeconds,
        status: 'SENDING',
        isForwarded: false,
        createdAt: new Date().toISOString(),
        replyToId: replyToIdForSend,
        replyTo: replyToForOptimistic as any,
        sender: {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
        },
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      setReplyingTo(null);

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      try {
        // Upload voice file
        const uploadResult = await uploadApi.uploadFile(
          {
            uri: result.uri,
            type: 'audio/mp4',
            name: `voice_${Date.now()}.m4a`,
          },
          'voice'
        );

        const messagePayload = {
          type: 'AUDIO' as const,
          mediaUrl: uploadResult.url,
          mediaType: 'audio/mp4',
          mediaDuration: durationSeconds,
          replyToId: replyToIdForSend,
        };

        if (socketService.isConnected) {
          socketService.sendMessage({ chatId, ...messagePayload, tempId });
        } else {
          const saved = await chatApi.sendMessage(chatId, messagePayload);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempId ? { ...saved, status: 'SENT' } : msg
            )
          );
        }
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

  // Selection mode handlers
  const handleLongPress = (messageId: string) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedMessages(new Set([messageId]));
    }
  };

  const handleSelectMessage = (messageId: string) => {
    setSelectedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
        if (next.size === 0) {
          setIsSelectionMode(false);
        }
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedMessages(new Set());
  };

  // Enter reply mode for a specific message (triggered by swipe or reply
  // icon in the selection header). Ignores deleted messages.
  const handleReply = (msg: Message) => {
    if (!msg || (msg as any).isDeletedForEveryone) return;
    setReplyingTo(msg);
    handleCancelSelection();
  };

  // Reply action from the selection header (acts on the single selected msg)
  const handleReplyFromSelection = () => {
    if (selectedMessages.size !== 1) return;
    const [id] = Array.from(selectedMessages);
    const msg = messages.find(m => m.id === id);
    if (msg) handleReply(msg);
  };

  const handleCopyMessages = async () => {
    const selected = messages.filter(m => selectedMessages.has(m.id));
    const textContent = selected
      .map(m => m.content || '')
      .filter(Boolean)
      .join('\n');
    if (textContent) {
      await Clipboard.setStringAsync(textContent);
    }
    handleCancelSelection();
  };

  const handleStarMessages = async () => {
    const ids = Array.from(selectedMessages);
    // Determine if we should star or unstar based on current state
    const allStarred = ids.every(id => {
      const msg = messages.find(m => m.id === id);
      return msg?.isStarred;
    });
    const newStarred = !allStarred;

    handleCancelSelection();
    try {
      for (const messageId of ids) {
        await socketService.starMessage(messageId, newStarred);
      }
      // Update local state
      setMessages(prev => prev.map(msg =>
        ids.includes(msg.id) ? { ...msg, isStarred: newStarred } : msg
      ));
    } catch (error) {
      console.error('Error starring messages:', error);
    }
  };

  const performDelete = async (messageIds: string[], forEveryone: boolean) => {
    try {
      if (forEveryone) {
        // "Delete for everyone" — via socket so all members get real-time notification
        if (messageIds.length === 1) {
          await socketService.deleteMessage(messageIds[0], true);
        } else {
          await socketService.deleteMessages(messageIds, true);
        }
      } else {
        // "Delete for me" — REST batch endpoint (no ownership check, just soft-deletes)
        await chatApi.deleteMessagesForMe(messageIds);
      }
    } catch (error) {
      console.error('Error deleting messages:', error);
    }

    // Update local state after deletion (cache syncs automatically via useEffect)
    if (chatId) {
      const idSet = new Set(messageIds);
      if (forEveryone) {
        setMessages(prev => prev.map(m =>
          idSet.has(m.id)
            ? { ...m, isDeletedForEveryone: true, content: undefined, mediaUrl: undefined, type: 'TEXT' as const }
            : m
        ));
      } else {
        setMessages(prev => prev.filter(m => !idSet.has(m.id)));
      }
    }
  };

  const handleDeleteMessages = () => {
    const count = selectedMessages.size;
    const selectedArray = Array.from(selectedMessages);
    const selectedSet = new Set(selectedMessages);
    const allMine = selectedArray.every(id => {
      const msg = messages.find(m => m.id === id);
      return msg?.senderId === user?.id;
    });

    const buttons: any[] = [
      { text: 'Cancel', style: 'cancel' },
    ];

    buttons.push({
      text: 'Delete for me',
      style: 'destructive',
      onPress: async () => {
        handleCancelSelection();
        // Remove from local state (only for this user)
        setMessages(prev => prev.filter(m => !selectedSet.has(m.id)));
        await performDelete(selectedArray, false);
      },
    });

    if (allMine) {
      buttons.push({
        text: 'Delete for everyone',
        style: 'destructive',
        onPress: async () => {
          handleCancelSelection();
          // Show placeholder locally for "deleted for everyone"
          setMessages((prev: any) => prev?.map((m: any) => selectedSet?.has(m.id) ? { ...m, isDeletedForEveryone: true, content: null, mediaUrl: null, type: 'TEXT' as const } : m));
          await performDelete(selectedArray, true);
        },
      });
    }

    Alert.alert(`Delete ${count} message${count > 1 ? 's' : ''}?`, '', buttons);
  };

  const handleForwardMessages = () => {
    setShowForwardModal(true);
  };

  const handleForwardTo = async (targetChatId: string) => {
    const selected = messages.filter(m => selectedMessages.has(m.id));

    for (const msg of selected) {
      const tempId = generateTempId();
      const payload: any = {
        chatId: targetChatId,
        type: msg.type,
        content: msg.content,
        mediaUrl: msg.mediaUrl,
        mediaType: msg.mediaType,
        mediaDuration: msg.mediaDuration,
        fileName: msg.fileName,
        fileSize: msg.fileSize,
        latitude: msg.latitude,
        longitude: msg.longitude,
        locationName: msg.locationName,
        isForwarded: true,
        tempId,
      };
      socketService.sendMessage(payload);
    }

    setShowForwardModal(false);
    handleCancelSelection();
  };

  // ─── Chat Menu Handlers ────────────────────────────────────────────────────

  const handleMenuViewContact = useCallback(() => {
    setShowChatMenu(false);
    if (!chatId) return;
    if (chat?.type === 'GROUP') {
      router.push({ pathname: '/group/[id]/info' as any, params: { id: chatId } });
    } else if (otherUser) {
      router.push({ pathname: '/chat/user-info' as any, params: { chatId, userId: otherUser.id } });
    } else {
      Alert.alert('Deleted Account', 'This user has deleted their account.');
    }
  }, [chatId, chat?.type, otherUser]);

  const handleMenuMediaLinks = useCallback(() => {
    setShowChatMenu(false);
    if (!chatId) return;
    if (chat?.type === 'GROUP') {
      router.push({ pathname: '/group/[id]/info' as any, params: { id: chatId } });
    } else if (otherUser) {
      router.push({ pathname: '/chat/user-info' as any, params: { chatId, userId: otherUser.id } });
    }
  }, [chatId, chat?.type, otherUser]);

  const handleMenuMute = useCallback(async () => {
    setShowChatMenu(false);
    if (!chatId || !chat) return;
    const newMuted = !chat.isMuted;
    try {
      await chatApi.muteChat(chatId, newMuted);
      setChat((prev) => prev ? { ...prev, isMuted: newMuted } : prev);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update mute');
    }
  }, [chatId, chat]);

  const handleMenuBlock = useCallback(() => {
    setShowChatMenu(false);
    if (!otherUser) {
      Alert.alert('Cannot block', 'This user has deleted their account.');
      return;
    }

    if (iBlockedThem) {
      // Unblock flow
      Alert.alert(
        'Unblock this contact?',
        `Unblock ${otherUser.name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unblock',
            onPress: async () => {
              try {
                await contactApi.unblockUser(otherUser.id);
                setIBlockedThem(false);
                // Add local-only event message
                const eventMsg: Message = {
                  id: `unblock_${Date.now()}`,
                  chatId: chatId!,
                  senderId: user!.id,
                  type: 'SYSTEM',
                  content: 'You unblocked this contact',
                  status: 'READ',
                  isForwarded: false,
                  createdAt: new Date().toISOString(),
                  sender: { id: user!.id, name: user!.name, avatar: user?.avatar },
                };
                setMessages((prev) => [...prev, eventMsg]);
              } catch (err: any) {
                Alert.alert('Error', err?.message || 'Failed to unblock user');
              }
            },
          },
        ],
      );
    } else {
      // Block flow
      Alert.alert(
        'Block user?',
        `Block ${otherUser.name}? They will no longer be able to send you messages.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async () => {
              try {
                await contactApi.blockUser(otherUser.id);
                setIBlockedThem(true);
                // Add local-only event message
                const eventMsg: Message = {
                  id: `block_${Date.now()}`,
                  chatId: chatId!,
                  senderId: user!.id,
                  type: 'SYSTEM',
                  content: 'You blocked this contact',
                  status: 'READ',
                  isForwarded: false,
                  createdAt: new Date().toISOString(),
                  sender: { id: user!.id, name: user!.name, avatar: user?.avatar },
                };
                setMessages((prev) => [...prev, eventMsg]);
              } catch (err: any) {
                Alert.alert('Error', err?.message || 'Failed to block user');
              }
            },
          },
        ],
      );
    }
  }, [otherUser, iBlockedThem, chatId, user]);

  const handleMenuClearChat = useCallback(() => {
    setShowChatMenu(false);
    if (!chatId) return;
    Alert.alert(
      'Clear this chat?',
      'All messages will be removed for you. Other participants will still see them.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear local state and cache IMMEDIATELY so no stale data flashes
              setMessages([]);
              cache.delete(CacheKeys.messages(chatId));

              // Then call the API
              await chatApi.clearChat(chatId);

              // Also update the chat list cache so the preview clears
              const cachedChats = cache.get<Chat[]>(CacheKeys.CHATS);
              if (cachedChats) {
                cache.set(
                  CacheKeys.CHATS,
                  cachedChats.map((c) =>
                    c.id === chatId ? { ...c, lastMessage: undefined, unreadCount: 0 } : c,
                  ),
                );
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to clear chat');
              // Refetch to recover
              fetchData();
            }
          },
        },
      ],
    );
  }, [chatId, fetchData]);

  const handleMenuPin = useCallback(async () => {
    setShowChatMenu(false);
    if (!chatId || !chat) return;
    const newPinned = !chat.isPinned;
    try {
      await chatApi.pinChat(chatId, newPinned);
      setChat((prev) => prev ? { ...prev, isPinned: newPinned } : prev);

      // Also update the chat list cache
      const cachedChats = cache.get<Chat[]>(CacheKeys.CHATS);
      if (cachedChats) {
        cache.set(
          CacheKeys.CHATS,
          cachedChats.map((c) => (c.id === chatId ? { ...c, isPinned: newPinned } : c)),
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update pin');
    }
  }, [chatId, chat]);

  const isGroupChat = chat?.type === 'GROUP';

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.senderId === user?.id;
    const prev = index > 0 ? messages[index - 1] : null;
    const showSenderInfo =
      isGroupChat &&
      !isMe &&
      item.type !== 'SYSTEM' &&
      (!prev || prev.senderId !== item.senderId || prev.type === 'SYSTEM');
    const senderDisplayName =
      isGroupChat && !isMe
        ? resolveSenderDisplayName(item, contactsById, memberUserById)
        : undefined;
    // Only the sender needs a read indicator, and only groups need the
    // per-receipt calculation (private chats keep using message.status).
    const groupReadState =
      isGroupChat && isMe && item.type !== 'SYSTEM' && user?.id
        ? computeGroupReadState(item, eligibleMembers, user.id)
        : undefined;
    return (
      <MessageBubble
        message={item}
        isMe={isMe}
        isGroup={isGroupChat}
        showSenderInfo={showSenderInfo}
        senderDisplayName={senderDisplayName}
        senderAvatar={item.sender?.avatar}
        groupReadState={groupReadState}
        onImagePress={isSelectionMode ? undefined : setPreviewImageUrl}
        onVideoPress={isSelectionMode ? undefined : setPreviewVideoUrl}
        isSelected={selectedMessages.has(item.id)}
        isSelectionMode={isSelectionMode}
        onSelect={() => handleSelectMessage(item.id)}
        onLongPress={() => handleLongPress(item.id)}
        onReply={handleReply}
      />
    );
  };

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
      // On Android, edge-to-edge mode swallows the default adjustResize, so we
      // pad the container ourselves to keep the message input above the keyboard.
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}>
      {/* Custom Header */}
      {isSelectionMode ? (
        <SelectionHeader
          count={selectedMessages.size}
          onCancel={handleCancelSelection}
          onStar={handleStarMessages}
          onDelete={handleDeleteMessages}
          onCopy={handleCopyMessages}
          onForward={handleForwardMessages}
          onReply={handleReplyFromSelection}
          allStarred={Array.from(selectedMessages).every(id => {
            const msg = messages.find(m => m.id === id);
            return msg?.isStarred;
          })}
        />
      ) : (
        <ChatHeader
          chat={chat?.type === 'PRIVATE' ? {
            name: otherUser?.name || 'Deleted Account',
            avatar: otherUser?.avatar,
            isOnline: otherUser?.isOnline,
            lastSeen: otherUser?.lastSeen,
          } : {
            name: chat?.name,
            avatar: chat?.avatar,
          }}
          isTyping={isTyping}
          onBack={handleBack}
          onCall={handleCall}
          onVideoCall={handleVideoCall}
          onMenuPress={() => setShowChatMenu(true)}
          onUserInfoPress={() => {
            if (!chatId) return;
            if (chat?.type === 'GROUP') {
              router.push({ pathname: '/group/[id]/info', params: { id: chatId } });
            } else {
              router.push({ pathname: '/chat/user-info', params: { chatId, userId: otherUser?.id } });
            }
          }}
        />
      )}

      {/* Messages List with WhatsApp background — wraps both messages and input */}
      <ImageBackground
        source={require('@/assets/images/chat-background.jpg')}
        style={styles.messagesList}
        resizeMode="cover"
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messagesContent}
          style={styles.messagesListInner}
          onEndReached={loadMoreMessages}
          onEndReachedThreshold={0.5}
          onContentSizeChange={() => {
            if (messages.length > 0 && page === 1) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
        />

      {iBlockedThem && chat?.type === 'PRIVATE' ? (
        <Pressable
          style={styles.blockedBanner}
          onPress={() => {
            Alert.alert(
              'Unblock this contact?',
              `Unblock ${otherUser?.name || 'this contact'} to send messages.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Unblock',
                  onPress: async () => {
                    if (!otherUser) return;
                    try {
                      await contactApi.unblockUser(otherUser.id);
                      setIBlockedThem(false);
                      const eventMsg: Message = {
                        id: `unblock_${Date.now()}`,
                        chatId: chatId!,
                        senderId: user!.id,
                        type: 'SYSTEM',
                        content: 'You unblocked this contact',
                        status: 'READ',
                        isForwarded: false,
                        createdAt: new Date().toISOString(),
                        sender: { id: user!.id, name: user!.name, avatar: user?.avatar },
                      };
                      setMessages((prev) => [...prev, eventMsg]);
                    } catch (err: any) {
                      Alert.alert('Error', err?.message || 'Failed to unblock');
                    }
                  },
                },
              ],
            );
          }}
        >
          <Ionicons name="ban-outline" size={18} color="#FF3B30" />
          <Text style={styles.blockedBannerText}>
            You blocked this contact. Tap to unblock.
          </Text>
        </Pressable>
      ) : (
        <MessageInput
          value={messageText}
          onChange={setMessageText}
          onSend={handleSend}
          onAttachment={handleAttachment}
          onSelect={handleAttachmentSelect}
          onVoiceStart={handleVoiceStart}
          onVoiceStop={handleVoiceStop}
          onVoiceCancel={handleVoiceCancel}
          isRecording={voiceRecording.isRecording}
          recordingDuration={voiceRecording.duration}
          onTypingStart={handleTypingStart}
          onTypingStop={handleTypingStop}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          currentUserId={user?.id}
        />
      )}
      </ImageBackground>

      {/* Attachment Menu */}
      <AttachmentMenu
        visible={showAttachmentMenu}
        onClose={() => setShowAttachmentMenu(false)}
        onSelect={handleAttachmentSelect}
      />

      {/* Image Preview Modal */}
      {previewImageUrl && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPreviewImageUrl(null)}>
          <View style={styles.imagePreviewOverlay}>
            <Pressable style={styles.imagePreviewClose} onPress={() => setPreviewImageUrl(null)}>
              <Ionicons name="close" size={28} color="#ffffff" />
            </Pressable>
            <Image
              source={{ uri: previewImageUrl }}
              style={styles.imagePreviewFull}
              contentFit="contain"
            />
          </View>
        </Modal>
      )}

      {/* Video Player Modal */}
      {previewVideoUrl && (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPreviewVideoUrl(null)}>
          <View style={styles.videoPlayerOverlay}>
            <Video
              source={{ uri: previewVideoUrl }}
              style={styles.videoPlayerFull}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
            />
            <View style={styles.videoPlayerHeader}>
              <Pressable onPress={() => setPreviewVideoUrl(null)} style={styles.videoPlayerCloseBtn}>
                <Ionicons name="close" size={28} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {/* Media Preview Modal (before sending) */}
      {pendingMedia && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setPendingMedia(null)}>
          <View style={styles.mediaPreviewOverlay}>
            <Pressable style={styles.mediaPreviewClose} onPress={() => setPendingMedia(null)}>
              <Ionicons name="close" size={28} color="#ffffff" />
            </Pressable>
            <Image
              source={{ uri: pendingMedia.uri }}
              style={styles.mediaPreviewImage}
              contentFit="contain"
            />
            <View style={styles.mediaPreviewFooter}>
              <Text style={styles.mediaPreviewRecipient} numberOfLines={1}>
                {otherUser?.name || chat?.name || 'Recipient'}
              </Text>
              <Pressable
                style={[styles.mediaPreviewSendBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  sendMediaMessage(pendingMedia);
                  setPendingMedia(null);
                }}>
                <Ionicons name="send" size={22} color="#fff" />
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {/* Forward Modal */}
      <ForwardModal
        visible={showForwardModal}
        onClose={() => { setShowForwardModal(false); }}
        onForward={handleForwardTo}
      />

      {/* ─── Chat Detail Menu (3-dot) ──────────────────────────────────────── */}
      <Modal visible={showChatMenu} transparent animationType="fade">
        <Pressable style={styles.chatMenuOverlay} onPress={() => setShowChatMenu(false)}>
          <View style={[styles.chatMenuDropdown, { backgroundColor: colors.cardBackground }]}>
            <Pressable style={styles.chatMenuItem} onPress={handleMenuViewContact}>
              <Ionicons name="person-outline" size={20} color={colors.text} style={styles.chatMenuIcon} />
              <Text style={[styles.chatMenuItemText, { color: colors.text }]}>
                {chat?.type === 'GROUP' ? 'Group info' : 'View contact'}
              </Text>
            </Pressable>
            <Pressable style={styles.chatMenuItem} onPress={handleMenuMediaLinks}>
              <Ionicons name="images-outline" size={20} color={colors.text} style={styles.chatMenuIcon} />
              <Text style={[styles.chatMenuItemText, { color: colors.text }]}>Media & links</Text>
            </Pressable>
            <Pressable style={styles.chatMenuItem} onPress={handleMenuMute}>
              <Ionicons name={chat?.isMuted ? 'volume-high-outline' : 'volume-mute-outline'} size={20} color={colors.text} style={styles.chatMenuIcon} />
              <Text style={[styles.chatMenuItemText, { color: colors.text }]}>
                {chat?.isMuted ? 'Unmute notifications' : 'Mute notifications'}
              </Text>
            </Pressable>
            <Pressable style={styles.chatMenuItem} onPress={handleMenuClearChat}>
              <Ionicons name="chatbox-outline" size={20} color={colors.text} style={styles.chatMenuIcon} />
              <Text style={[styles.chatMenuItemText, { color: colors.text }]}>Clear chat</Text>
            </Pressable>
            <Pressable style={styles.chatMenuItem} onPress={handleMenuPin}>
              <Ionicons name={chat?.isPinned ? 'pin-outline' : 'pin'} size={20} color={colors.text} style={styles.chatMenuIcon} />
              <Text style={[styles.chatMenuItemText, { color: colors.text }]}>
                {chat?.isPinned ? 'Unpin chat' : 'Pin chat'}
              </Text>
            </Pressable>
            {chat?.type === 'PRIVATE' && (
              <Pressable style={styles.chatMenuItem} onPress={handleMenuBlock}>
                <Ionicons name={iBlockedThem ? 'ban' : 'ban-outline'} size={20} color={iBlockedThem ? colors.primary : '#e74c3c'} style={styles.chatMenuIcon} />
                <Text style={[styles.chatMenuItemText, { color: iBlockedThem ? colors.primary : '#e74c3c' }]}>
                  {iBlockedThem ? 'Unblock' : 'Block'}
                </Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>
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
    paddingBottom: 6,
    paddingHorizontal: 2,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  headerBackButton: {
    padding: 2,
  },
  headerUserInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 0,
  },
  headerTextContainer: {
    marginLeft: 8,
    flex: 1,
  },
  headerUsername: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerStatus: {
    fontSize: 12,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 4,
  },
  headerActionButton: {
    padding: 8,
  },
  messagesList: {
    flex: 1,
  },
  messagesListInner: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  loadingMore: {
    paddingVertical: 10,
  },
  systemMessageWrapper: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 24,
  },
  systemMessageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    maxWidth: '85%',
  },
  systemMessageText: {
    fontSize: 12.5,
    textAlign: 'center',
    fontWeight: '500',
  },
  messageBubbleContainer: {
    marginVertical: 1,
    maxWidth: '80%',
    paddingHorizontal: 0,
    minWidth: 0,
  },
  messageBubbleContainerMe: {
    alignSelf: 'flex-end',
  },
  messageBubbleContainerOther: {
    alignSelf: 'flex-start',
  },
  messageBubbleContainerGroupOther: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  groupMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    alignSelf: 'flex-start',
    maxWidth: '85%',
    marginVertical: 1,
  },
  groupAvatarSlot: {
    width: 28,
    marginRight: 6,
    marginBottom: 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  groupAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupAvatarFallbackText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  groupMessageColumn: {
    flexShrink: 1,
    minWidth: 0,
    alignItems: 'flex-start',
  },
  bubbleSenderName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  messageBubbleContainerSelection: {
    flexDirection: 'row',
    maxWidth: '90%',
  },
  messageBubbleSelected: {
    backgroundColor: 'rgba(0, 128, 105, 0.15)',
  },
  selectionCheckbox: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginLeft: 4,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
    paddingHorizontal: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  selectionCount: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 16,
  },
  selectionAction: {
    padding: 10,
  },
  replyContainer: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 4,
    marginBottom: 4,
    borderRadius: 4,
  },
  replyName: {
    fontSize: 12,
    fontWeight: '600',
  },
  replyText: {
    fontSize: 12,
  },
  messageBubble: {
    paddingHorizontal: 7,
    paddingTop: 5,
    paddingBottom: 5,
    borderRadius: 7.5,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
  },
  mediaBubble: {
    paddingHorizontal: 3,
    paddingTop: 3,
    paddingBottom: 3,
    overflow: 'hidden',
  },
  messageBubbleMe: {
    borderTopRightRadius: 2,
  },
  messageBubbleOther: {
    borderTopLeftRadius: 2,
  },
  messageBubbleBorder: {
    borderWidth: 0.5,
    borderColor: '#d4d4d4',
  },
  textMessageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  messageText: {
    fontSize: 15.5,
    lineHeight: 20,
    flexShrink: 1,
  },
  inlineTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginLeft: 'auto',
    paddingLeft: 6,
    marginBottom: 1,
    gap: 3,
    flexShrink: 0,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 1,
    gap: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  mediaContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  mediaText: {
    marginTop: 8,
    fontSize: 14,
  },
  imagePreview: {
    width: 240,
    height: 240,
    borderRadius: 6,
  },
  videoContainer: {
    position: 'relative',
    width: 240,
    height: 240,
    borderRadius: 6,
    overflow: 'hidden',
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
    borderRadius: 6,
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
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
  replyPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: 8,
    marginTop: 6,
    borderRadius: 10,
    overflow: 'hidden',
    paddingVertical: 6,
    paddingLeft: 0,
    paddingRight: 6,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  replyPreviewBar: {
    width: 4,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    marginRight: 8,
  },
  replyPreviewContent: {
    flex: 1,
    justifyContent: 'center',
  },
  replyPreviewName: {
    fontSize: 13,
    fontWeight: '600',
  },
  replyPreviewText: {
    fontSize: 13,
    marginTop: 1,
  },
  replyPreviewClose: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 6,
  },
  inputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 25,
    paddingHorizontal: 4,
    paddingVertical: 4,
    minHeight: 48,
  },
  inputIconButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    minHeight: 40,
    maxHeight: 144,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  attachmentOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
    zIndex: 100,
    elevation: 100,
  },
  attachmentMenu: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  attachmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  attachmentOption: {
    alignItems: 'center',
    width: '20%',
    marginBottom: 6,
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
  videoPlayButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  imagePreviewFull: {
    width: Dimensions.get('window').width - 32,
    height: Dimensions.get('window').height - 160,
  },
  videoPlaceholder: {
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoDurationBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  videoDurationText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  mediaTimeOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 5,
  },
  mediaTimeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '400',
  },
  videoPlayerOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayerHeader: {
    position: 'absolute',
    top: 40,
    right: 16,
    zIndex: 10,
  },
  videoPlayerCloseBtn: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  videoPlayerFull: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height - 120,
  },
  voiceDeleteButton: {
    width: 46,
    height: 46,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceRecordingRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 6,
  },
  voiceRecordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    marginRight: 10,
  },
  voiceRecordingTime: {
    fontSize: 16,
    fontWeight: '500',
  },
  mediaPreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaPreviewClose: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    padding: 8,
  },
  mediaPreviewImage: {
    width: Dimensions.get('window').width - 32,
    height: Dimensions.get('window').height - 200,
  },
  mediaPreviewFooter: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mediaPreviewRecipient: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  mediaPreviewSendBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  forwardModal: {
    flex: 1,
  },
  forwardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 8,
    gap: 12,
  },
  forwardTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  forwardSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  forwardSearchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  forwardChatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  forwardChatName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },

  // ─── Blocked Banner ────────────────────────────────────────────────────────
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  blockedBannerText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '500',
  },

  // ─── Chat Detail Menu (3-dot) ──────────────────────────────────────────────
  chatMenuOverlay: {
    flex: 1,
  },
  chatMenuDropdown: {
    position: 'absolute',
    top: 90,
    right: 12,
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 220,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  chatMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  chatMenuIcon: {
    marginRight: 14,
  },
  chatMenuItemText: {
    fontSize: 15,
  },
});

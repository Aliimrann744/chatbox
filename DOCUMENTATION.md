# Chatbox - WhatsApp Clone Documentation

## Table of Contents
1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Database Design](#database-design)
4. [Authentication Flow](#authentication-flow)
5. [WebSocket Architecture](#websocket-architecture)
6. [Real-time Messaging](#real-time-messaging)
7. [Online/Offline Status](#onlineoffline-status)
8. [Media Uploads](#media-uploads)
9. [Voice Messages](#voice-messages)
10. [Voice & Video Calls](#voice--video-calls)
11. [Group Chats](#group-chats)
12. [Contact Syncing](#contact-syncing)
13. [Push Notifications](#push-notifications)
14. [Privacy Settings](#privacy-settings)
15. [API Endpoints](#api-endpoints)
16. [Required Packages](#required-packages)

---

## Overview

Chatbox is a WhatsApp-like messaging application with the following features:
- User registration with phone/email verification
- Real-time 1-on-1 messaging
- Group chats
- Voice and video calls
- Media sharing (images, videos, documents)
- Voice messages
- Online/offline status
- Read receipts
- Push notifications
- Contact syncing

---

## Tech Stack

### Backend
- **Framework**: NestJS (Node.js)
- **Database**: MySQL with Prisma ORM
- **WebSocket**: Socket.IO with @nestjs/websockets
- **Authentication**: JWT (Access + Refresh tokens)
- **File Storage**: Local/AWS S3/Cloudinary
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **Voice/Video Calls**: WebRTC + Socket.IO signaling

### Frontend (React Native)
- **Framework**: React Native (Expo or CLI)
- **State Management**: Redux Toolkit / Zustand
- **WebSocket Client**: socket.io-client
- **Navigation**: React Navigation
- **Camera**: expo-camera / react-native-camera
- **Audio**: expo-av / react-native-audio-recorder-player
- **Video Calls**: react-native-webrtc
- **Push Notifications**: @react-native-firebase/messaging

---

## Database Design

### Required Tables (MySQL with Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// ==================== USER ====================
model User {
  id              String    @id @default(uuid())
  email           String?   @unique
  phone           String    @unique
  countryCode     String    @default("+1")
  password        String
  name            String
  about           String    @default("Hey there! I am using Chatbox")
  avatar          String?

  // Verification
  isVerified      Boolean   @default(false)
  otp             String?
  otpExpiry       DateTime?

  // Online Status
  isOnline        Boolean   @default(false)
  lastSeen        DateTime  @default(now())

  // Tokens
  refreshToken    String?   @db.Text
  fcmToken        String?   // For push notifications

  // Privacy Settings
  lastSeenPrivacy     PrivacySetting @default(EVERYONE)
  avatarPrivacy       PrivacySetting @default(EVERYONE)
  aboutPrivacy        PrivacySetting @default(EVERYONE)
  readReceiptsEnabled Boolean        @default(true)

  // Timestamps
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  contacts        Contact[]       @relation("UserContacts")
  contactOf       Contact[]       @relation("ContactUser")
  chatMembers     ChatMember[]
  messages        Message[]       @relation("SentMessages")
  calls           Call[]          @relation("Caller")
  receivedCalls   Call[]          @relation("Receiver")
  blockedUsers    BlockedUser[]   @relation("Blocker")
  blockedBy       BlockedUser[]   @relation("Blocked")
  groupsCreated   Chat[]          @relation("GroupCreator")
}

enum PrivacySetting {
  EVERYONE
  CONTACTS
  NOBODY
}

// ==================== CONTACTS ====================
model Contact {
  id          String   @id @default(uuid())
  userId      String
  contactId   String
  nickname    String?  // Custom name for contact

  user        User     @relation("UserContacts", fields: [userId], references: [id], onDelete: Cascade)
  contact     User     @relation("ContactUser", fields: [contactId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now())

  @@unique([userId, contactId])
  @@index([userId])
  @@index([contactId])
}

// ==================== BLOCKED USERS ====================
model BlockedUser {
  id          String   @id @default(uuid())
  blockerId   String
  blockedId   String

  blocker     User     @relation("Blocker", fields: [blockerId], references: [id], onDelete: Cascade)
  blocked     User     @relation("Blocked", fields: [blockedId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now())

  @@unique([blockerId, blockedId])
}

// ==================== CHAT ====================
model Chat {
  id          String     @id @default(uuid())
  type        ChatType   @default(PRIVATE)

  // Group specific fields
  name        String?    // Group name
  description String?    // Group description
  avatar      String?    // Group avatar
  creatorId   String?    // Group creator
  creator     User?      @relation("GroupCreator", fields: [creatorId], references: [id])

  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  // Relations
  members     ChatMember[]
  messages    Message[]

  @@index([type])
}

enum ChatType {
  PRIVATE   // 1-on-1 chat
  GROUP     // Group chat
}

// ==================== CHAT MEMBER ====================
model ChatMember {
  id          String         @id @default(uuid())
  chatId      String
  userId      String
  role        MemberRole     @default(MEMBER)

  // For tracking unread messages
  lastReadAt  DateTime       @default(now())

  // Notifications
  isMuted     Boolean        @default(false)
  muteUntil   DateTime?

  joinedAt    DateTime       @default(now())
  leftAt      DateTime?

  chat        Chat           @relation(fields: [chatId], references: [id], onDelete: Cascade)
  user        User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([chatId, userId])
  @@index([chatId])
  @@index([userId])
}

enum MemberRole {
  ADMIN
  MEMBER
}

// ==================== MESSAGE ====================
model Message {
  id          String        @id @default(uuid())
  chatId      String
  senderId    String

  // Content
  type        MessageType   @default(TEXT)
  content     String?       @db.Text      // Text content
  mediaUrl    String?                      // URL for media
  mediaType   String?                      // MIME type
  mediaDuration Int?                       // Duration for audio/video in seconds
  thumbnail   String?                      // Thumbnail for video
  fileName    String?                      // Original filename
  fileSize    Int?                         // File size in bytes

  // Location (for location messages)
  latitude    Float?
  longitude   Float?
  locationName String?

  // Reply
  replyToId   String?
  replyTo     Message?      @relation("Replies", fields: [replyToId], references: [id])
  replies     Message[]     @relation("Replies")

  // Forward
  isForwarded Boolean       @default(false)
  forwardCount Int          @default(0)

  // Status
  status      MessageStatus @default(SENT)

  // Timestamps
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  deletedAt   DateTime?     // Soft delete

  // Relations
  chat        Chat          @relation(fields: [chatId], references: [id], onDelete: Cascade)
  sender      User          @relation("SentMessages", fields: [senderId], references: [id])
  readReceipts MessageReadReceipt[]

  @@index([chatId])
  @@index([senderId])
  @@index([createdAt])
}

enum MessageType {
  TEXT
  IMAGE
  VIDEO
  AUDIO       // Voice message
  DOCUMENT
  LOCATION
  CONTACT
  STICKER
}

enum MessageStatus {
  SENDING     // Message is being sent
  SENT        // Server received (single tick)
  DELIVERED   // Recipient received (double tick)
  READ        // Recipient read (blue tick)
  FAILED      // Failed to send
}

// ==================== MESSAGE READ RECEIPT ====================
model MessageReadReceipt {
  id          String   @id @default(uuid())
  messageId   String
  userId      String
  readAt      DateTime @default(now())

  message     Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@unique([messageId, userId])
  @@index([messageId])
}

// ==================== CALL ====================
model Call {
  id          String     @id @default(uuid())
  callerId    String
  receiverId  String
  chatId      String?    // Optional: for group calls

  type        CallType
  status      CallStatus @default(RINGING)

  startedAt   DateTime   @default(now())
  answeredAt  DateTime?
  endedAt     DateTime?
  duration    Int?       // Duration in seconds

  caller      User       @relation("Caller", fields: [callerId], references: [id])
  receiver    User       @relation("Receiver", fields: [receiverId], references: [id])

  @@index([callerId])
  @@index([receiverId])
}

enum CallType {
  VOICE
  VIDEO
}

enum CallStatus {
  RINGING
  ANSWERED
  MISSED
  DECLINED
  BUSY
  ENDED
}
```

---

## Authentication Flow

### 1. User Registration

```
┌─────────────────────────────────────────────────────────────┐
│                    REGISTRATION FLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User enters phone number                                │
│           ↓                                                  │
│  2. Server sends OTP via SMS (Twilio/Firebase)              │
│           ↓                                                  │
│  3. User enters OTP                                          │
│           ↓                                                  │
│  4. Server verifies OTP                                      │
│           ↓                                                  │
│  5. User sets name & profile picture                         │
│           ↓                                                  │
│  6. Server creates account & returns JWT tokens              │
│           ↓                                                  │
│  7. App stores tokens & connects to WebSocket                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Registration API Flow

```typescript
// Step 1: Send OTP
POST /api/auth/send-otp
Body: { phone: "+1234567890", countryCode: "+1" }
Response: { message: "OTP sent", sessionId: "xxx" }

// Step 2: Verify OTP
POST /api/auth/verify-otp
Body: { phone: "+1234567890", otp: "123456", sessionId: "xxx" }
Response: { verified: true, tempToken: "xxx" }

// Step 3: Complete Registration
POST /api/auth/register
Headers: { Authorization: "Bearer tempToken" }
Body: { name: "John Doe", avatar: "base64..." }
Response: {
  accessToken: "xxx",
  refreshToken: "xxx",
  user: { id, name, phone, avatar }
}
```

---

## WebSocket Architecture

### How WebSocket Works (Two-Way Communication)

```
┌──────────────────────────────────────────────────────────────────┐
│                    WEBSOCKET ARCHITECTURE                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────┐                              ┌─────────┐           │
│   │ User A  │                              │ User B  │           │
│   │ (Phone) │                              │ (Phone) │           │
│   └────┬────┘                              └────┬────┘           │
│        │                                        │                 │
│        │ WebSocket Connection                   │                 │
│        ▼                                        ▼                 │
│   ┌─────────────────────────────────────────────────┐            │
│   │              NESTJS SERVER                       │            │
│   │         (Socket.IO Gateway)                      │            │
│   │                                                  │            │
│   │  ┌─────────────────────────────────────────┐    │            │
│   │  │     Connected Users Map                  │    │            │
│   │  │  {                                       │    │            │
│   │  │    "user_a_id": socket_a,               │    │            │
│   │  │    "user_b_id": socket_b,               │    │            │
│   │  │  }                                       │    │            │
│   │  └─────────────────────────────────────────┘    │            │
│   │                                                  │            │
│   └─────────────────────────────────────────────────┘            │
│                          │                                        │
│                          ▼                                        │
│                    ┌──────────┐                                  │
│                    │  MySQL   │                                  │
│                    │ Database │                                  │
│                    └──────────┘                                  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Message Flow (User A sends to User B)

```
┌────────────────────────────────────────────────────────────────────┐
│                      MESSAGE FLOW                                   │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  USER A                    SERVER                      USER B       │
│    │                         │                           │          │
│    │  1. emit('send_message')│                           │          │
│    │  ─────────────────────► │                           │          │
│    │                         │                           │          │
│    │                         │ 2. Save to Database       │          │
│    │                         │    (status: SENT)         │          │
│    │                         │                           │          │
│    │  3. emit('message_sent')│                           │          │
│    │  ◄───────────────────── │                           │          │
│    │     (single tick ✓)     │                           │          │
│    │                         │                           │          │
│    │                         │ 4. emit('new_message')    │          │
│    │                         │ ─────────────────────────►│          │
│    │                         │                           │          │
│    │                         │ 5. emit('message_delivered')         │
│    │                         │ ◄─────────────────────────│          │
│    │                         │                           │          │
│    │  6. emit('message_status')                          │          │
│    │  ◄───────────────────── │                           │          │
│    │     (double tick ✓✓)    │                           │          │
│    │                         │                           │          │
│    │                         │ 7. User B reads message   │          │
│    │                         │    emit('message_read')   │          │
│    │                         │ ◄─────────────────────────│          │
│    │                         │                           │          │
│    │  8. emit('message_status')                          │          │
│    │  ◄───────────────────── │                           │          │
│    │     (blue tick ✓✓)      │                           │          │
│    │                         │                           │          │
└────────────────────────────────────────────────────────────────────┘
```

### WebSocket Events Table

| Event Name | Direction | Description |
|------------|-----------|-------------|
| `connection` | Client → Server | User connects |
| `disconnect` | Client → Server | User disconnects |
| `send_message` | Client → Server | Send a new message |
| `message_sent` | Server → Client | Message saved (single tick) |
| `new_message` | Server → Client | Receive new message |
| `message_delivered` | Client → Server | Confirm message received |
| `message_read` | Client → Server | Mark message as read |
| `message_status` | Server → Client | Update message status |
| `typing_start` | Client → Server | User started typing |
| `typing_stop` | Client → Server | User stopped typing |
| `user_typing` | Server → Client | Someone is typing |
| `online_status` | Server → Client | User online/offline |
| `call_initiate` | Client → Server | Start a call |
| `call_offer` | Server → Client | WebRTC offer |
| `call_answer` | Client → Server | WebRTC answer |
| `call_ice_candidate` | Both | ICE candidates |
| `call_end` | Both | End call |

---

## Real-time Messaging

### NestJS WebSocket Gateway Implementation

```typescript
// src/chat/chat.gateway.ts

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Store connected users: Map<userId, socketId>
  private connectedUsers = new Map<string, string>();

  constructor(
    private jwtService: JwtService,
    private chatService: ChatService,
  ) {}

  // ==================== CONNECTION ====================
  async handleConnection(client: Socket) {
    try {
      // Extract token from handshake
      const token = client.handshake.auth.token;
      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      // Store connection
      this.connectedUsers.set(userId, client.id);
      client.data.userId = userId;

      // Join user's personal room
      client.join(`user_${userId}`);

      // Update online status in database
      await this.chatService.setUserOnline(userId, true);

      // Notify contacts that user is online
      this.broadcastOnlineStatus(userId, true);

      console.log(`User ${userId} connected`);
    } catch (error) {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.connectedUsers.delete(userId);

      // Update offline status
      await this.chatService.setUserOnline(userId, false);

      // Notify contacts
      this.broadcastOnlineStatus(userId, false);

      console.log(`User ${userId} disconnected`);
    }
  }

  // ==================== MESSAGING ====================
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      chatId: string;
      content: string;
      type: string;
      mediaUrl?: string;
      replyToId?: string;
    },
  ) {
    const senderId = client.data.userId;

    // Save message to database
    const message = await this.chatService.createMessage({
      chatId: data.chatId,
      senderId,
      content: data.content,
      type: data.type,
      mediaUrl: data.mediaUrl,
      replyToId: data.replyToId,
    });

    // Send confirmation to sender (single tick)
    client.emit('message_sent', {
      tempId: data.tempId,
      message,
    });

    // Get chat members
    const members = await this.chatService.getChatMembers(data.chatId);

    // Send message to all other members
    for (const member of members) {
      if (member.userId !== senderId) {
        const recipientSocketId = this.connectedUsers.get(member.userId);

        if (recipientSocketId) {
          // User is online - send via WebSocket
          this.server.to(recipientSocketId).emit('new_message', message);
        } else {
          // User is offline - send push notification
          await this.chatService.sendPushNotification(member.userId, message);
        }
      }
    }

    return message;
  }

  @SubscribeMessage('message_delivered')
  async handleMessageDelivered(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string },
  ) {
    const userId = client.data.userId;

    // Update message status
    const message = await this.chatService.updateMessageStatus(
      data.messageId,
      'DELIVERED',
    );

    // Notify sender
    const senderSocketId = this.connectedUsers.get(message.senderId);
    if (senderSocketId) {
      this.server.to(senderSocketId).emit('message_status', {
        messageId: data.messageId,
        status: 'DELIVERED',
      });
    }
  }

  @SubscribeMessage('message_read')
  async handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string; messageIds: string[] },
  ) {
    const userId = client.data.userId;

    // Update read receipts
    await this.chatService.markMessagesAsRead(data.chatId, userId, data.messageIds);

    // Notify senders
    for (const messageId of data.messageIds) {
      const message = await this.chatService.getMessage(messageId);
      const senderSocketId = this.connectedUsers.get(message.senderId);

      if (senderSocketId) {
        this.server.to(senderSocketId).emit('message_status', {
          messageId,
          status: 'READ',
          readBy: userId,
        });
      }
    }
  }

  // ==================== TYPING INDICATOR ====================
  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    const userId = client.data.userId;

    // Broadcast to chat room except sender
    client.to(`chat_${data.chatId}`).emit('user_typing', {
      chatId: data.chatId,
      userId,
      isTyping: true,
    });
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    const userId = client.data.userId;

    client.to(`chat_${data.chatId}`).emit('user_typing', {
      chatId: data.chatId,
      userId,
      isTyping: false,
    });
  }

  // ==================== ONLINE STATUS ====================
  private async broadcastOnlineStatus(userId: string, isOnline: boolean) {
    // Get user's contacts
    const contacts = await this.chatService.getUserContacts(userId);

    for (const contact of contacts) {
      const socketId = this.connectedUsers.get(contact.contactId);
      if (socketId) {
        this.server.to(socketId).emit('online_status', {
          userId,
          isOnline,
          lastSeen: isOnline ? null : new Date(),
        });
      }
    }
  }

  // ==================== JOIN CHAT ROOMS ====================
  @SubscribeMessage('join_chat')
  async handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    client.join(`chat_${data.chatId}`);
  }

  @SubscribeMessage('leave_chat')
  async handleLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    client.leave(`chat_${data.chatId}`);
  }
}
```

---

## Online/Offline Status

### How It Works

```
┌────────────────────────────────────────────────────────────────┐
│                  ONLINE/OFFLINE STATUS FLOW                     │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. USER CONNECTS                                               │
│     ┌──────────┐     WebSocket      ┌──────────┐               │
│     │  User A  │ ─────────────────► │  Server  │               │
│     └──────────┘                    └────┬─────┘               │
│                                          │                      │
│     Server updates:                      │                      │
│     - connectedUsers.set(userId, socketId)                     │
│     - UPDATE users SET isOnline=true WHERE id=userId           │
│                                          │                      │
│     Server broadcasts to A's contacts:   │                      │
│     emit('online_status', { userId: A, isOnline: true })       │
│                                          │                      │
│  2. USER DISCONNECTS                     │                      │
│     ┌──────────┐     disconnect     ┌────┴─────┐               │
│     │  User A  │ ─────────────────► │  Server  │               │
│     └──────────┘                    └────┬─────┘               │
│                                          │                      │
│     Server updates:                      │                      │
│     - connectedUsers.delete(userId)                            │
│     - UPDATE users SET isOnline=false, lastSeen=NOW()          │
│                                          │                      │
│     Server broadcasts to A's contacts:   │                      │
│     emit('online_status', { userId: A, isOnline: false,        │
│                             lastSeen: '2024-...' })            │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Privacy Considerations

```typescript
// Only send lastSeen based on privacy settings
async getLastSeenForUser(requesterId: string, targetUserId: string) {
  const target = await this.prisma.user.findUnique({
    where: { id: targetUserId },
    select: { lastSeenPrivacy: true, lastSeen: true, isOnline: true }
  });

  const isContact = await this.isContact(requesterId, targetUserId);

  switch (target.lastSeenPrivacy) {
    case 'EVERYONE':
      return { isOnline: target.isOnline, lastSeen: target.lastSeen };
    case 'CONTACTS':
      if (isContact) {
        return { isOnline: target.isOnline, lastSeen: target.lastSeen };
      }
      return { isOnline: null, lastSeen: null };
    case 'NOBODY':
      return { isOnline: null, lastSeen: null };
  }
}
```

---

## Media Uploads

### Upload Flow

```
┌────────────────────────────────────────────────────────────────┐
│                     MEDIA UPLOAD FLOW                           │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  REACT NATIVE APP                           SERVER              │
│       │                                        │                │
│  1. User selects image/video                   │                │
│       │                                        │                │
│  2. Compress media (if needed)                 │                │
│       │                                        │                │
│  3. POST /api/upload                           │                │
│     (multipart/form-data)                      │                │
│       │ ─────────────────────────────────────► │                │
│       │                                        │                │
│       │                              4. Validate file           │
│       │                              5. Store file              │
│       │                                 - Local: /uploads/      │
│       │                                 - S3: bucket            │
│       │                              6. Generate thumbnail      │
│       │                                 (for videos)            │
│       │                                        │                │
│       │  { url, thumbnail, fileSize }          │                │
│       │ ◄───────────────────────────────────── │                │
│       │                                        │                │
│  7. Send message via WebSocket                 │                │
│     with mediaUrl                              │                │
│       │ ─────────────────────────────────────► │                │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### React Native Media Picker

```typescript
// React Native - Media Selection

import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

// Pick Image from Gallery
const pickImage = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.8,
  });

  if (!result.canceled) {
    await uploadMedia(result.assets[0].uri, 'image');
  }
};

// Take Photo with Camera
const takePhoto = async () => {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    alert('Camera permission required');
    return;
  }

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.8,
  });

  if (!result.canceled) {
    await uploadMedia(result.assets[0].uri, 'image');
  }
};

// Pick Video
const pickVideo = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    videoMaxDuration: 60, // 60 seconds max
  });

  if (!result.canceled) {
    await uploadMedia(result.assets[0].uri, 'video');
  }
};

// Pick Document
const pickDocument = async () => {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'application/msword', '*/*'],
  });

  if (result.type === 'success') {
    await uploadMedia(result.uri, 'document');
  }
};

// Upload to Server
const uploadMedia = async (uri: string, type: string) => {
  const formData = new FormData();
  formData.append('file', {
    uri,
    type: `${type}/*`,
    name: `${Date.now()}.${type === 'image' ? 'jpg' : 'mp4'}`,
  });
  formData.append('folder', type === 'image' ? 'images' : 'videos');

  const response = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'multipart/form-data',
    },
    body: formData,
  });

  const { url, thumbnail } = await response.json();

  // Send message with media
  socket.emit('send_message', {
    chatId,
    type: type.toUpperCase(),
    mediaUrl: url,
    thumbnail,
  });
};
```

---

## Voice Messages

### Recording Flow

```
┌────────────────────────────────────────────────────────────────┐
│                   VOICE MESSAGE FLOW                            │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User HOLDS record button                                    │
│       │                                                         │
│  2. Start recording audio                                       │
│     - Request microphone permission                             │
│     - Initialize audio recorder                                 │
│     - Start recording (max 60 seconds)                          │
│       │                                                         │
│  3. Show recording UI                                           │
│     - Waveform animation                                        │
│     - Duration timer                                            │
│     - Slide to cancel                                           │
│       │                                                         │
│  4. User RELEASES button                                        │
│       │                                                         │
│  5. Stop recording                                              │
│       │                                                         │
│  6. Upload audio file                                           │
│     POST /api/upload/voice                                      │
│       │                                                         │
│  7. Send message via WebSocket                                  │
│     { type: 'AUDIO', mediaUrl, duration }                       │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### React Native Voice Recording

```typescript
// React Native - Voice Recording

import { Audio } from 'expo-av';

const VoiceRecorder = () => {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [duration, setDuration] = useState(0);

  const startRecording = async () => {
    try {
      // Request permission
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Microphone permission required');
        return;
      }

      // Configure audio
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);

      // Track duration
      recording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording) {
          setDuration(Math.floor(status.durationMillis / 1000));
        }
      });
    } catch (error) {
      console.error('Failed to start recording', error);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);

    if (uri && duration > 0) {
      // Upload voice message
      await uploadVoiceMessage(uri, duration);
    }
  };

  const uploadVoiceMessage = async (uri: string, duration: number) => {
    const formData = new FormData();
    formData.append('file', {
      uri,
      type: 'audio/m4a',
      name: `voice_${Date.now()}.m4a`,
    });

    const response = await fetch(`${API_URL}/api/upload/voice`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });

    const { url } = await response.json();

    // Send via WebSocket
    socket.emit('send_message', {
      chatId,
      type: 'AUDIO',
      mediaUrl: url,
      mediaDuration: duration,
    });
  };

  return (
    <Pressable
      onPressIn={startRecording}
      onPressOut={stopRecording}
    >
      <MicrophoneIcon />
      {recording && <Text>{duration}s</Text>}
    </Pressable>
  );
};
```

---

## Voice & Video Calls

### WebRTC Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    WEBRTC CALL FLOW                             │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│   CALLER (User A)              SERVER              RECEIVER (B) │
│        │                         │                      │       │
│  1. Initiate Call                │                      │       │
│     emit('call_initiate')        │                      │       │
│        │ ────────────────────► │                      │       │
│        │                         │                      │       │
│        │                         │ 2. emit('incoming_call')     │
│        │                         │ ──────────────────► │       │
│        │                         │                      │       │
│        │                         │ 3. emit('call_accepted')     │
│        │                         │ ◄────────────────── │       │
│        │                         │                      │       │
│  4. Create RTCPeerConnection     │                      │       │
│     Create Offer                 │                      │       │
│     emit('call_offer')           │                      │       │
│        │ ────────────────────► │                      │       │
│        │                         │ 5. Forward offer     │       │
│        │                         │ ──────────────────► │       │
│        │                         │                      │       │
│        │                         │ 6. Create Answer     │       │
│        │                         │    emit('call_answer')       │
│        │                         │ ◄────────────────── │       │
│        │ 7. Forward answer       │                      │       │
│        │ ◄────────────────────── │                      │       │
│        │                         │                      │       │
│  8. Exchange ICE Candidates (both ways)                 │       │
│        │ ◄─────────────────────────────────────────────►│       │
│        │                         │                      │       │
│  9. P2P Connection Established                          │       │
│        │ ◄═══════════════════════════════════════════►│       │
│        │         (Audio/Video Stream)                   │       │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Required Packages for Calls

```bash
# React Native
npm install react-native-webrtc
npm install @notifee/react-native  # For call notifications

# NestJS (already has socket.io)
# No additional packages needed - signaling via WebSocket
```

### Call Gateway Implementation

```typescript
// src/call/call.gateway.ts

@WebSocketGateway({ namespace: '/call' })
export class CallGateway {
  @WebSocketServer()
  server: Server;

  private activeCalls = new Map<string, CallSession>();

  @SubscribeMessage('call_initiate')
  async handleCallInitiate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { receiverId: string; type: 'VOICE' | 'VIDEO' },
  ) {
    const callerId = client.data.userId;

    // Create call record
    const call = await this.callService.createCall({
      callerId,
      receiverId: data.receiverId,
      type: data.type,
    });

    // Check if receiver is online
    const receiverSocketId = this.connectedUsers.get(data.receiverId);

    if (receiverSocketId) {
      // Send incoming call notification
      this.server.to(receiverSocketId).emit('incoming_call', {
        callId: call.id,
        caller: await this.userService.getUser(callerId),
        type: data.type,
      });
    } else {
      // Send push notification for call
      await this.notificationService.sendCallNotification(data.receiverId, call);
    }

    return { callId: call.id };
  }

  @SubscribeMessage('call_accept')
  async handleCallAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    const call = await this.callService.acceptCall(data.callId);

    // Notify caller
    const callerSocketId = this.connectedUsers.get(call.callerId);
    if (callerSocketId) {
      this.server.to(callerSocketId).emit('call_accepted', { callId: data.callId });
    }
  }

  @SubscribeMessage('call_offer')
  async handleCallOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string; offer: RTCSessionDescriptionInit },
  ) {
    const call = await this.callService.getCall(data.callId);
    const receiverSocketId = this.connectedUsers.get(call.receiverId);

    if (receiverSocketId) {
      this.server.to(receiverSocketId).emit('call_offer', {
        callId: data.callId,
        offer: data.offer,
      });
    }
  }

  @SubscribeMessage('call_answer')
  async handleCallAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string; answer: RTCSessionDescriptionInit },
  ) {
    const call = await this.callService.getCall(data.callId);
    const callerSocketId = this.connectedUsers.get(call.callerId);

    if (callerSocketId) {
      this.server.to(callerSocketId).emit('call_answer', {
        callId: data.callId,
        answer: data.answer,
      });
    }
  }

  @SubscribeMessage('call_ice_candidate')
  async handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string; candidate: RTCIceCandidateInit },
  ) {
    const call = await this.callService.getCall(data.callId);
    const userId = client.data.userId;
    const targetId = userId === call.callerId ? call.receiverId : call.callerId;
    const targetSocketId = this.connectedUsers.get(targetId);

    if (targetSocketId) {
      this.server.to(targetSocketId).emit('call_ice_candidate', {
        callId: data.callId,
        candidate: data.candidate,
      });
    }
  }

  @SubscribeMessage('call_end')
  async handleCallEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    const call = await this.callService.endCall(data.callId);
    const userId = client.data.userId;
    const targetId = userId === call.callerId ? call.receiverId : call.callerId;
    const targetSocketId = this.connectedUsers.get(targetId);

    if (targetSocketId) {
      this.server.to(targetSocketId).emit('call_ended', {
        callId: data.callId,
        duration: call.duration,
      });
    }
  }
}
```

---

## Group Chats

### Group Creation Flow

```
┌────────────────────────────────────────────────────────────────┐
│                    GROUP CHAT FLOW                              │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. CREATE GROUP                                                │
│     POST /api/groups                                            │
│     {                                                           │
│       name: "Family Group",                                     │
│       members: ["user_id_1", "user_id_2", "user_id_3"],        │
│       avatar: "base64..."                                       │
│     }                                                           │
│                                                                 │
│  2. SERVER CREATES:                                             │
│     - Chat record (type: GROUP)                                 │
│     - ChatMember records for each member                        │
│     - Creator gets ADMIN role                                   │
│                                                                 │
│  3. NOTIFY ALL MEMBERS                                          │
│     emit('group_created', { group })                            │
│                                                                 │
│  4. MESSAGING IN GROUP                                          │
│     Same as private chat, but message goes to ALL members       │
│                                                                 │
│  5. GROUP MANAGEMENT                                            │
│     - Add members (admin only)                                  │
│     - Remove members (admin only)                               │
│     - Leave group                                               │
│     - Make admin                                                │
│     - Update group info                                         │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Group Message Distribution

```typescript
// When sending message to group
async sendGroupMessage(chatId: string, senderId: string, message: Message) {
  // Get all group members
  const members = await this.prisma.chatMember.findMany({
    where: {
      chatId,
      leftAt: null, // Not left the group
    },
    include: { user: true },
  });

  // Send to each member except sender
  for (const member of members) {
    if (member.userId !== senderId) {
      const socketId = this.connectedUsers.get(member.userId);

      if (socketId) {
        // Online - send via WebSocket
        this.server.to(socketId).emit('new_message', message);
      } else if (!member.isMuted) {
        // Offline & not muted - send push notification
        await this.sendPushNotification(member.userId, message);
      }
    }
  }
}
```

---

## Contact Syncing

### How WhatsApp-style Contact Sync Works

```
┌────────────────────────────────────────────────────────────────┐
│                   CONTACT SYNC FLOW                             │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  REACT NATIVE APP                           SERVER              │
│        │                                       │                │
│  1. Request contacts permission                │                │
│        │                                       │                │
│  2. Read phone contacts                        │                │
│     [                                          │                │
│       { name: "Mom", phone: "+1234567890" },  │                │
│       { name: "Dad", phone: "+0987654321" },  │                │
│     ]                                          │                │
│        │                                       │                │
│  3. POST /api/contacts/sync                    │                │
│     { phoneNumbers: ["+1234...", "+0987..."] } │                │
│        │ ────────────────────────────────────► │                │
│        │                                       │                │
│        │                             4. Query DB:               │
│        │                                SELECT * FROM users     │
│        │                                WHERE phone IN (...)    │
│        │                                       │                │
│        │  5. Return registered users           │                │
│        │     [                                 │                │
│        │       { phone: "+1234...",           │                │
│        │         id: "user_123",              │                │
│        │         name: "Mom",                  │                │
│        │         avatar: "..." }              │                │
│        │     ]                                 │                │
│        │ ◄──────────────────────────────────── │                │
│        │                                       │                │
│  6. Display contacts who have Chatbox          │                │
│     with their profile info                    │                │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Contact Sync Implementation

```typescript
// React Native - Read Contacts
import * as Contacts from 'expo-contacts';

const syncContacts = async () => {
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') {
    alert('Contacts permission required');
    return;
  }

  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers],
  });

  // Extract phone numbers
  const phoneNumbers = data
    .filter(contact => contact.phoneNumbers?.length > 0)
    .flatMap(contact =>
      contact.phoneNumbers.map(p => normalizePhoneNumber(p.number))
    );

  // Sync with server
  const response = await fetch(`${API_URL}/api/contacts/sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ phoneNumbers }),
  });

  const registeredContacts = await response.json();
  // Store in local state/database
};

// Normalize phone number
const normalizePhoneNumber = (phone: string) => {
  return phone.replace(/[\s\-\(\)]/g, '');
};
```

```typescript
// NestJS - Contact Sync Endpoint

@Controller('contacts')
export class ContactsController {
  @Post('sync')
  async syncContacts(
    @CurrentUser() user: User,
    @Body() dto: SyncContactsDto,
  ) {
    const { phoneNumbers } = dto;

    // Find registered users with these phone numbers
    const registeredUsers = await this.prisma.user.findMany({
      where: {
        phone: { in: phoneNumbers },
        isVerified: true,
        id: { not: user.id }, // Exclude self
      },
      select: {
        id: true,
        phone: true,
        name: true,
        avatar: true,
        about: true,
        isOnline: true,
        lastSeen: true,
      },
    });

    // Apply privacy settings
    const filteredUsers = await Promise.all(
      registeredUsers.map(async (u) => {
        const isBlocked = await this.isBlocked(user.id, u.id);
        if (isBlocked) return null;

        return {
          ...u,
          lastSeen: await this.getLastSeenWithPrivacy(user.id, u),
        };
      })
    );

    return filteredUsers.filter(Boolean);
  }
}
```

---

## Push Notifications

### Firebase Cloud Messaging Setup

```
┌────────────────────────────────────────────────────────────────┐
│                PUSH NOTIFICATION FLOW                           │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. APP STARTUP                                                 │
│     - Initialize Firebase                                       │
│     - Get FCM token                                            │
│     - Send token to server                                     │
│                                                                 │
│  2. WHEN MESSAGE ARRIVES (recipient offline)                   │
│     Server ──► Firebase ──► Device                             │
│                                                                 │
│  3. NOTIFICATION TYPES                                          │
│     - New message                                              │
│     - Incoming call                                            │
│     - Missed call                                              │
│     - Group added                                              │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### React Native FCM Setup

```typescript
// React Native - Firebase Setup
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';

// Request permission
async function requestPermission() {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    const token = await messaging().getToken();
    // Send token to server
    await sendFcmTokenToServer(token);
  }
}

// Handle foreground messages
messaging().onMessage(async (remoteMessage) => {
  // Display local notification
  await notifee.displayNotification({
    title: remoteMessage.notification?.title,
    body: remoteMessage.notification?.body,
    android: {
      channelId: 'messages',
      pressAction: { id: 'default' },
    },
  });
});

// Handle background messages
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('Background message:', remoteMessage);
});

// Handle notification tap
notifee.onForegroundEvent(({ type, detail }) => {
  if (type === EventType.PRESS) {
    // Navigate to chat
    navigation.navigate('Chat', { chatId: detail.notification?.data?.chatId });
  }
});
```

### NestJS Push Notification Service

```typescript
// src/notification/notification.service.ts
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationService {
  constructor() {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY,
      }),
    });
  }

  async sendMessageNotification(userId: string, message: Message) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    if (!user?.fcmToken) return;

    const sender = await this.prisma.user.findUnique({
      where: { id: message.senderId },
    });

    await admin.messaging().send({
      token: user.fcmToken,
      notification: {
        title: sender.name,
        body: this.getMessagePreview(message),
      },
      data: {
        type: 'MESSAGE',
        chatId: message.chatId,
        messageId: message.id,
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'messages',
          icon: 'ic_notification',
        },
      },
      apns: {
        payload: {
          aps: {
            badge: 1,
            sound: 'default',
          },
        },
      },
    });
  }

  async sendCallNotification(userId: string, call: Call) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    if (!user?.fcmToken) return;

    const caller = await this.prisma.user.findUnique({
      where: { id: call.callerId },
    });

    await admin.messaging().send({
      token: user.fcmToken,
      data: {
        type: 'CALL',
        callId: call.id,
        callerId: call.callerId,
        callerName: caller.name,
        callerAvatar: caller.avatar || '',
        callType: call.type,
      },
      android: {
        priority: 'high',
        ttl: 30000, // 30 seconds
      },
      apns: {
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'voip',
        },
      },
    });
  }

  private getMessagePreview(message: Message): string {
    switch (message.type) {
      case 'TEXT':
        return message.content.substring(0, 100);
      case 'IMAGE':
        return '📷 Photo';
      case 'VIDEO':
        return '🎥 Video';
      case 'AUDIO':
        return '🎤 Voice message';
      case 'DOCUMENT':
        return '📄 Document';
      case 'LOCATION':
        return '📍 Location';
      default:
        return 'New message';
    }
  }
}
```

---

## Privacy Settings

### Privacy Features

| Setting | Options | Description |
|---------|---------|-------------|
| Last Seen | Everyone / Contacts / Nobody | Who can see when you were last online |
| Profile Photo | Everyone / Contacts / Nobody | Who can see your profile photo |
| About | Everyone / Contacts / Nobody | Who can see your about/status |
| Read Receipts | On / Off | Show blue ticks when you read messages |
| Blocked Users | List | Users who can't contact you |

### Privacy Check Implementation

```typescript
// Check if user can see target's info based on privacy
async canViewUserInfo(
  viewerId: string,
  targetId: string,
  infoType: 'lastSeen' | 'avatar' | 'about',
): Promise<boolean> {
  // Check if blocked
  const isBlocked = await this.prisma.blockedUser.findFirst({
    where: {
      OR: [
        { blockerId: targetId, blockedId: viewerId },
        { blockerId: viewerId, blockedId: targetId },
      ],
    },
  });
  if (isBlocked) return false;

  // Get target's privacy settings
  const target = await this.prisma.user.findUnique({
    where: { id: targetId },
  });

  const privacySetting = {
    lastSeen: target.lastSeenPrivacy,
    avatar: target.avatarPrivacy,
    about: target.aboutPrivacy,
  }[infoType];

  switch (privacySetting) {
    case 'EVERYONE':
      return true;
    case 'CONTACTS':
      return await this.areContacts(viewerId, targetId);
    case 'NOBODY':
      return false;
    default:
      return false;
  }
}

async areContacts(userId1: string, userId2: string): Promise<boolean> {
  const contact = await this.prisma.contact.findFirst({
    where: {
      OR: [
        { userId: userId1, contactId: userId2 },
        { userId: userId2, contactId: userId1 },
      ],
    },
  });
  return !!contact;
}
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/send-otp` | Send OTP to phone |
| POST | `/api/auth/verify-otp` | Verify OTP |
| POST | `/api/auth/register` | Complete registration |
| POST | `/api/auth/login` | Login with phone + password |
| POST | `/api/auth/refresh-token` | Refresh access token |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/profile` | Get current user profile |
| PUT | `/api/auth/profile` | Update profile |

### Contacts

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/contacts/sync` | Sync phone contacts |
| GET | `/api/contacts` | Get user's contacts |
| POST | `/api/contacts/block` | Block a user |
| DELETE | `/api/contacts/block/:userId` | Unblock a user |
| GET | `/api/contacts/blocked` | Get blocked users |

### Chats

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chats` | Get user's chats |
| POST | `/api/chats` | Create/get private chat |
| GET | `/api/chats/:id` | Get chat details |
| DELETE | `/api/chats/:id` | Delete chat |
| GET | `/api/chats/:id/messages` | Get messages (paginated) |

### Groups

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/groups` | Create group |
| GET | `/api/groups/:id` | Get group details |
| PUT | `/api/groups/:id` | Update group info |
| DELETE | `/api/groups/:id` | Delete group (admin) |
| POST | `/api/groups/:id/members` | Add members |
| DELETE | `/api/groups/:id/members/:userId` | Remove member |
| POST | `/api/groups/:id/leave` | Leave group |
| POST | `/api/groups/:id/admins` | Make admin |

### Upload

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload file |
| POST | `/api/upload/avatar` | Upload avatar |
| POST | `/api/upload/voice` | Upload voice message |

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings/privacy` | Get privacy settings |
| PUT | `/api/settings/privacy` | Update privacy settings |
| PUT | `/api/settings/fcm-token` | Update FCM token |

---

## Required Packages

### NestJS Backend

```json
{
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/config": "^3.1.1",
    "@nestjs/core": "^10.0.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/platform-socket.io": "^10.0.0",
    "@nestjs/websockets": "^10.0.0",
    "@prisma/client": "^5.7.1",
    "bcrypt": "^5.1.1",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.0",
    "firebase-admin": "^11.11.0",
    "multer": "^1.4.5-lts.1",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "socket.io": "^4.6.1",
    "twilio": "^4.19.0"
  },
  "devDependencies": {
    "@types/multer": "^1.4.11",
    "prisma": "^5.7.1"
  }
}
```

### React Native Frontend

```json
{
  "dependencies": {
    "@react-native-firebase/app": "^18.6.1",
    "@react-native-firebase/messaging": "^18.6.1",
    "@notifee/react-native": "^7.8.0",
    "@react-navigation/native": "^6.1.9",
    "@react-navigation/native-stack": "^6.9.17",
    "expo": "~49.0.0",
    "expo-av": "~13.4.1",
    "expo-camera": "~13.4.4",
    "expo-contacts": "~12.3.0",
    "expo-document-picker": "~11.5.4",
    "expo-image-picker": "~14.3.2",
    "react-native-webrtc": "^111.0.3",
    "socket.io-client": "^4.6.1",
    "zustand": "^4.4.7"
  }
}
```

---

## Project Structure

```
chatbox/
├── server/                          # NestJS Backend
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── auth/                    # Authentication
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/
│   │   │   ├── guards/
│   │   │   └── dto/
│   │   ├── chat/                    # Messaging
│   │   │   ├── chat.module.ts
│   │   │   ├── chat.controller.ts
│   │   │   ├── chat.service.ts
│   │   │   └── chat.gateway.ts      # WebSocket
│   │   ├── call/                    # Voice/Video Calls
│   │   │   ├── call.module.ts
│   │   │   ├── call.service.ts
│   │   │   └── call.gateway.ts      # WebRTC Signaling
│   │   ├── group/                   # Group Chats
│   │   │   ├── group.module.ts
│   │   │   ├── group.controller.ts
│   │   │   └── group.service.ts
│   │   ├── contact/                 # Contacts
│   │   │   ├── contact.module.ts
│   │   │   ├── contact.controller.ts
│   │   │   └── contact.service.ts
│   │   ├── upload/                  # File Upload
│   │   │   ├── upload.module.ts
│   │   │   ├── upload.controller.ts
│   │   │   └── upload.service.ts
│   │   ├── notification/            # Push Notifications
│   │   │   ├── notification.module.ts
│   │   │   └── notification.service.ts
│   │   └── prisma/                  # Database
│   │       ├── prisma.module.ts
│   │       └── prisma.service.ts
│   └── prisma/
│       └── schema.prisma
│
├── mobile/                          # React Native App
│   ├── src/
│   │   ├── screens/
│   │   │   ├── Auth/
│   │   │   ├── Chats/
│   │   │   ├── Chat/
│   │   │   ├── Contacts/
│   │   │   ├── Groups/
│   │   │   ├── Calls/
│   │   │   ├── Settings/
│   │   │   └── Profile/
│   │   ├── components/
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   ├── socket.ts
│   │   │   └── webrtc.ts
│   │   ├── store/
│   │   └── utils/
│   └── App.tsx
│
└── DOCUMENTATION.md
```

---

## Next Steps

1. **Set up Prisma schema** - Run `npx prisma migrate dev`
2. **Create WebSocket gateway** - Implement `chat.gateway.ts`
3. **Implement contact sync** - Create contact module
4. **Add push notifications** - Set up Firebase
5. **Implement voice/video calls** - WebRTC + signaling
6. **Build React Native app** - Follow the structure above

---

## Summary

| Feature | Technology | Complexity |
|---------|------------|------------|
| Auth | JWT + OTP | Medium |
| Messaging | Socket.IO | Medium |
| Online Status | WebSocket | Low |
| Media Upload | Multer + S3 | Medium |
| Voice Messages | expo-av | Medium |
| Voice/Video Calls | WebRTC | High |
| Group Chats | Database relations | Medium |
| Contact Sync | Phone contacts API | Medium |
| Push Notifications | Firebase FCM | Medium |
| Privacy | Database flags | Low |

**Total WebSocket Namespaces Needed:** 2
- `/chat` - Messaging, typing, online status
- `/call` - Voice/video call signaling

**Database:** 1 MySQL database with 10 tables

This documentation covers the complete architecture for building a WhatsApp-like application. Follow the flows and implement each module step by step.

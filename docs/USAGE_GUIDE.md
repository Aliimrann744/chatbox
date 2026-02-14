# Chatbox App - Usage Guide & Flow Documentation

## Table of Contents
1. [Getting Started](#getting-started)
2. [User Flow Overview](#user-flow-overview)
3. [Adding Contacts](#adding-contacts)
4. [Starting a Chat](#starting-a-chat)
5. [Sending Messages](#sending-messages)
6. [API Endpoints Reference](#api-endpoints-reference)
7. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites
1. **Server Running**: Make sure the NestJS server is running on `http://localhost:4000`
2. **Database**: MySQL database should be running with the schema synced
3. **Client**: React Native app should be running via Expo

### Starting the App
```bash
# Terminal 1 - Start Server
cd server
npm run start:dev

# Terminal 2 - Start Client
cd client
npm start
```

---

## User Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        APP FLOW                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. REGISTER/LOGIN                                               │
│     └── User registers with email/phone/password                 │
│     └── User verifies OTP (sent to email)                        │
│     └── User logs in                                             │
│                                                                  │
│  2. ADD CONTACTS (Two Ways)                                      │
│     └── Option A: Sync device contacts (finds users on Chatbox) │
│     └── Option B: Search users by name/phone and add them        │
│                                                                  │
│  3. START A CHAT                                                 │
│     └── Go to Contacts tab → Tap on a contact → Chat opens       │
│     └── OR: Tap FAB on Chats tab → Select contact → Chat opens   │
│                                                                  │
│  4. SEND MESSAGES                                                │
│     └── Type message → Tap send button                           │
│     └── Tap + for attachments (photo, video, document, location) │
│     └── Hold mic button for voice message                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Adding Contacts

### Method 1: Sync Device Contacts
1. Go to **Contacts** tab
2. Tap the **sync button** (circular arrow icon) in the top right
3. Grant contacts permission when prompted
4. App will find which of your phone contacts are using Chatbox
5. Found contacts are automatically added to your list

### Method 2: Search and Add Users
1. Go to **Contacts** tab
2. Type a name or phone number in the **search bar**
3. Search results will show matching users
4. Tap the **+ button** next to a user to add them as a contact

### API Flow for Adding Contacts
```
POST /api/contacts
Body: { "contactId": "user_id_to_add" }

Response: {
  "id": "contact_record_id",
  "userId": "your_user_id",
  "contactId": "added_user_id",
  "contact": { "id", "name", "phone", "avatar" }
}
```

---

## Starting a Chat

### From Contacts Tab
1. Go to **Contacts** tab
2. Tap on any contact
3. This creates a private chat (if not exists) and opens it

### From Chats Tab (New Chat)
1. Go to **Chats** tab
2. Tap the **floating action button** (message icon) at bottom right
3. This opens the **New Chat** screen (`/new-chat`)
4. Select a contact from the list
5. Chat is created and opened

### API Flow for Creating a Chat
```
POST /api/chats
Body: { "participantId": "other_user_id" }

Response: {
  "id": "chat_id",
  "type": "PRIVATE",
  "members": [...],
  "createdAt": "..."
}
```

**Note**: The API automatically checks if a private chat already exists between the two users. If it does, it returns the existing chat instead of creating a new one.

---

## Sending Messages

### Text Messages
1. Open a chat
2. Type your message in the input field
3. Tap the **send button** (paper plane icon)

### Media Messages (Photos, Videos, Documents)
1. Open a chat
2. Tap the **+ button** on the left of the input
3. Choose attachment type:
   - **Camera**: Take a new photo
   - **Gallery**: Select existing photo
   - **Video**: Select or record video
   - **Document**: Select a file
   - **Location**: Share current location
4. Selected media is uploaded and sent

### Voice Messages
1. Open a chat
2. When input is empty, tap the **mic button**
3. Recording starts automatically
4. Tap **stop** to finish and send
5. Tap **trash** to cancel

### API Flow for Sending Messages

#### Via REST API:
```
POST /api/chats/:chatId/messages
Body: {
  "type": "TEXT",        // TEXT, IMAGE, VIDEO, AUDIO, DOCUMENT, LOCATION
  "content": "Hello!",   // For text messages
  "mediaUrl": "...",     // For media messages (after upload)
  "mediaType": "...",    // MIME type
  "latitude": 0.0,       // For location
  "longitude": 0.0
}
```

#### Via WebSocket (Real-time):
```javascript
// Connect to socket
socketService.connect();

// Send message
socketService.sendMessage({
  chatId: "chat_id",
  type: "TEXT",
  content: "Hello!",
  tempId: "temp_123"  // For optimistic updates
});

// Listen for confirmation
socketService.on('message_sent', (data) => {
  // data.tempId - matches your tempId
  // data.message - the saved message from server
});
```

---

## API Endpoints Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/verify-otp` | Verify email OTP |
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get current user |

### Contacts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contacts` | Get all contacts |
| POST | `/api/contacts` | Add a contact |
| DELETE | `/api/contacts/:id` | Remove a contact |
| POST | `/api/contacts/sync` | Sync device contacts |
| GET | `/api/contacts/search?q=` | Search users |
| POST | `/api/contacts/block` | Block a user |
| DELETE | `/api/contacts/block/:id` | Unblock a user |

### Chats
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chats` | Get all chats |
| POST | `/api/chats` | Create private chat |
| GET | `/api/chats/:id` | Get chat details |
| GET | `/api/chats/:id/messages` | Get messages (paginated) |
| POST | `/api/chats/:id/messages` | Send message |
| POST | `/api/chats/:id/read` | Mark as read |
| PATCH | `/api/chats/:id/pin` | Pin/unpin chat |
| PATCH | `/api/chats/:id/mute` | Mute/unmute chat |

### Groups
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/groups` | Create group |
| GET | `/api/groups/:id` | Get group details |
| PUT | `/api/groups/:id` | Update group |
| DELETE | `/api/groups/:id` | Delete group |
| POST | `/api/groups/:id/members` | Add members |
| DELETE | `/api/groups/:id/members/:userId` | Remove member |
| POST | `/api/groups/:id/leave` | Leave group |

### WebSocket Events

#### Emitting (Client → Server)
| Event | Data | Description |
|-------|------|-------------|
| `send_message` | `{chatId, type, content, tempId}` | Send a message |
| `typing_start` | `{chatId}` | Start typing indicator |
| `typing_stop` | `{chatId}` | Stop typing indicator |
| `message_read` | `{chatId}` | Mark messages as read |
| `join_chat` | `{chatId}` | Join chat room |
| `leave_chat` | `{chatId}` | Leave chat room |

#### Listening (Server → Client)
| Event | Data | Description |
|-------|------|-------------|
| `new_message` | `Message` | New message received |
| `message_sent` | `{tempId, message}` | Message send confirmed |
| `message_error` | `{tempId, error}` | Message send failed |
| `user_typing` | `{chatId, userId, isTyping}` | Typing indicator |
| `online_status` | `{userId, isOnline}` | User online status |
| `message_status` | `{messageId, status}` | Message delivered/read |

---

## Troubleshooting

### "Nothing happens when I click buttons"

**Possible causes:**

1. **Server not running**
   - Check if server is running on port 4000
   - Check terminal for errors

2. **API URL mismatch**
   - Check `client/services/api.ts` - API_BASE_URL should be `http://localhost:4000/api`
   - For physical device, use your computer's IP instead of localhost

3. **Not authenticated**
   - Make sure you're logged in
   - Check if token is stored (AsyncStorage/SecureStore)

4. **No contacts added**
   - You need contacts before you can start chats
   - Add contacts first via search or sync

5. **WebSocket not connected**
   - Check console for "Chat socket connected" message
   - Socket connects automatically after login

### "Chat list is empty"

1. You haven't started any chats yet
2. Create a chat by:
   - Going to Contacts → Tap a contact
   - Or tap FAB on Chats tab → Select contact

### "Messages not sending"

1. Check WebSocket connection
2. Check if chat was created successfully
3. Look at server logs for errors

### "Can't find users to add"

1. Other users must be registered in the app
2. Search by exact phone number or name
3. Make sure the user verified their account

---

## Testing the Flow (Step by Step)

### Step 1: Create Two Test Users
```bash
# User 1
POST /api/auth/register
{
  "name": "Test User 1",
  "email": "test1@example.com",
  "phone": "+1234567890",
  "password": "password123"
}

# User 2
POST /api/auth/register
{
  "name": "Test User 2",
  "email": "test2@example.com",
  "phone": "+0987654321",
  "password": "password123"
}
```

### Step 2: Login as User 1
```bash
POST /api/auth/login
{
  "email": "test1@example.com",
  "password": "password123"
}
# Save the accessToken
```

### Step 3: Search for User 2
```bash
GET /api/contacts/search?q=Test User 2
Authorization: Bearer <token>
# Get User 2's ID from response
```

### Step 4: Add User 2 as Contact
```bash
POST /api/contacts
Authorization: Bearer <token>
{
  "contactId": "<user2_id>"
}
```

### Step 5: Create Chat with User 2
```bash
POST /api/chats
Authorization: Bearer <token>
{
  "participantId": "<user2_id>"
}
# Save the chat ID
```

### Step 6: Send a Message
```bash
POST /api/chats/<chat_id>/messages
Authorization: Bearer <token>
{
  "type": "TEXT",
  "content": "Hello from User 1!"
}
```

### Step 7: Check Chat List
```bash
GET /api/chats
Authorization: Bearer <token>
# Should show the chat with last message
```

---

## File Structure Reference

```
client/
├── app/
│   ├── (auth)/           # Login, Register, OTP screens
│   ├── (tabs)/           # Main tabs (Chats, Contacts, Calls, Settings, Profile)
│   ├── chat/[id].tsx     # Chat detail screen
│   ├── call/             # Call screens
│   └── new-chat.tsx      # New chat screen
├── components/
│   ├── chat/             # Chat components
│   ├── call/             # Call components
│   └── ui/               # Reusable UI components
├── contexts/
│   ├── auth-context.tsx  # Authentication state
│   ├── call-context.tsx  # Call state
│   └── notification-context.tsx
├── services/
│   ├── api.ts            # REST API client
│   ├── socket.ts         # WebSocket client
│   └── notifications.ts  # Push notifications
└── hooks/                # Custom hooks

server/
├── src/
│   ├── auth/             # Authentication module
│   ├── chat/             # Chat module (REST + WebSocket)
│   ├── contact/          # Contacts module
│   ├── group/            # Groups module
│   ├── call/             # Calls module
│   └── settings/         # Settings module
└── prisma/
    └── schema.prisma     # Database schema
```

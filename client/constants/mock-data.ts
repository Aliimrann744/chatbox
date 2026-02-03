/**
 * Mock data for the chat application
 * This will be replaced with real API data later
 */

export interface User {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  status: string;
  isOnline: boolean;
  lastSeen?: string;
}

export interface Message {
  id: string;
  text: string;
  timestamp: string;
  senderId: string;
  status: 'sent' | 'delivered' | 'read';
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
}

export interface Chat {
  id: string;
  user: User;
  lastMessage: Message;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
}

export interface Call {
  id: string;
  user: User;
  type: 'incoming' | 'outgoing' | 'missed';
  callType: 'voice' | 'video';
  timestamp: string;
  duration?: string;
}

// Mock Users
export const mockUsers: User[] = [
  {
    id: '1',
    name: 'Alice Johnson',
    avatar: 'https://i.pravatar.cc/150?img=1',
    phone: '+1 234 567 8901',
    status: 'Hey there! I am using Chatbox',
    isOnline: true,
  },
  {
    id: '2',
    name: 'Bob Smith',
    avatar: 'https://i.pravatar.cc/150?img=2',
    phone: '+1 234 567 8902',
    status: 'Available',
    isOnline: false,
    lastSeen: '10:30 AM',
  },
  {
    id: '3',
    name: 'Carol Williams',
    avatar: 'https://i.pravatar.cc/150?img=3',
    phone: '+1 234 567 8903',
    status: 'At work',
    isOnline: true,
  },
  {
    id: '4',
    name: 'David Brown',
    avatar: 'https://i.pravatar.cc/150?img=4',
    phone: '+1 234 567 8904',
    status: 'Busy',
    isOnline: false,
    lastSeen: 'Yesterday',
  },
  {
    id: '5',
    name: 'Emma Davis',
    avatar: 'https://i.pravatar.cc/150?img=5',
    phone: '+1 234 567 8905',
    status: 'In a meeting',
    isOnline: false,
    lastSeen: '2:45 PM',
  },
  {
    id: '6',
    name: 'Frank Miller',
    avatar: 'https://i.pravatar.cc/150?img=6',
    phone: '+1 234 567 8906',
    status: 'On vacation',
    isOnline: false,
    lastSeen: '3 days ago',
  },
  {
    id: '7',
    name: 'Grace Wilson',
    avatar: 'https://i.pravatar.cc/150?img=7',
    phone: '+1 234 567 8907',
    status: 'Happy to chat!',
    isOnline: true,
  },
  {
    id: '8',
    name: 'Henry Taylor',
    avatar: 'https://i.pravatar.cc/150?img=8',
    phone: '+1 234 567 8908',
    status: 'Working from home',
    isOnline: false,
    lastSeen: '5:00 PM',
  },
];

// Mock Chats
export const mockChats: Chat[] = [
  {
    id: '1',
    user: mockUsers[0],
    lastMessage: {
      id: 'm1',
      text: 'Hey! How are you doing today?',
      timestamp: '11:42 AM',
      senderId: '1',
      status: 'read',
      type: 'text',
    },
    unreadCount: 0,
    isPinned: true,
    isMuted: false,
  },
  {
    id: '2',
    user: mockUsers[1],
    lastMessage: {
      id: 'm2',
      text: 'Can we meet tomorrow?',
      timestamp: '10:30 AM',
      senderId: '2',
      status: 'delivered',
      type: 'text',
    },
    unreadCount: 2,
    isPinned: false,
    isMuted: false,
  },
  {
    id: '3',
    user: mockUsers[2],
    lastMessage: {
      id: 'm3',
      text: 'Thanks for your help!',
      timestamp: 'Yesterday',
      senderId: 'me',
      status: 'read',
      type: 'text',
    },
    unreadCount: 0,
    isPinned: true,
    isMuted: false,
  },
  {
    id: '4',
    user: mockUsers[3],
    lastMessage: {
      id: 'm4',
      text: 'See you at the meeting',
      timestamp: 'Yesterday',
      senderId: '4',
      status: 'read',
      type: 'text',
    },
    unreadCount: 0,
    isPinned: false,
    isMuted: true,
  },
  {
    id: '5',
    user: mockUsers[4],
    lastMessage: {
      id: 'm5',
      text: 'The project looks great!',
      timestamp: 'Monday',
      senderId: '5',
      status: 'read',
      type: 'text',
    },
    unreadCount: 5,
    isPinned: false,
    isMuted: false,
  },
  {
    id: '6',
    user: mockUsers[5],
    lastMessage: {
      id: 'm6',
      text: 'I will be back next week',
      timestamp: 'Dec 28',
      senderId: '6',
      status: 'read',
      type: 'text',
    },
    unreadCount: 0,
    isPinned: false,
    isMuted: false,
  },
  {
    id: '7',
    user: mockUsers[6],
    lastMessage: {
      id: 'm7',
      text: 'Photo',
      timestamp: '9:15 AM',
      senderId: '7',
      status: 'delivered',
      type: 'image',
    },
    unreadCount: 1,
    isPinned: false,
    isMuted: false,
  },
  {
    id: '8',
    user: mockUsers[7],
    lastMessage: {
      id: 'm8',
      text: 'Voice message',
      timestamp: 'Dec 25',
      senderId: 'me',
      status: 'read',
      type: 'audio',
    },
    unreadCount: 0,
    isPinned: false,
    isMuted: false,
  },
];

// Mock Calls
export const mockCalls: Call[] = [
  {
    id: 'c1',
    user: mockUsers[0],
    type: 'incoming',
    callType: 'voice',
    timestamp: 'Today, 11:30 AM',
    duration: '5:23',
  },
  {
    id: 'c2',
    user: mockUsers[1],
    type: 'missed',
    callType: 'voice',
    timestamp: 'Today, 10:15 AM',
  },
  {
    id: 'c3',
    user: mockUsers[2],
    type: 'outgoing',
    callType: 'video',
    timestamp: 'Yesterday, 3:45 PM',
    duration: '12:07',
  },
  {
    id: 'c4',
    user: mockUsers[3],
    type: 'incoming',
    callType: 'voice',
    timestamp: 'Yesterday, 9:00 AM',
    duration: '2:15',
  },
  {
    id: 'c5',
    user: mockUsers[4],
    type: 'missed',
    callType: 'video',
    timestamp: 'Monday, 2:30 PM',
  },
  {
    id: 'c6',
    user: mockUsers[6],
    type: 'outgoing',
    callType: 'voice',
    timestamp: 'Dec 28, 4:00 PM',
    duration: '8:45',
  },
];

// Mock Messages for a conversation
export const mockMessages: Record<string, Message[]> = {
  '1': [
    {
      id: 'msg1',
      text: 'Hi there!',
      timestamp: '11:30 AM',
      senderId: '1',
      status: 'read',
      type: 'text',
    },
    {
      id: 'msg2',
      text: 'Hello! How are you?',
      timestamp: '11:32 AM',
      senderId: 'me',
      status: 'read',
      type: 'text',
    },
    {
      id: 'msg3',
      text: "I'm doing great, thanks for asking! How about you?",
      timestamp: '11:35 AM',
      senderId: '1',
      status: 'read',
      type: 'text',
    },
    {
      id: 'msg4',
      text: "I'm good too! Just working on some projects.",
      timestamp: '11:37 AM',
      senderId: 'me',
      status: 'read',
      type: 'text',
    },
    {
      id: 'msg5',
      text: 'That sounds interesting! What kind of projects?',
      timestamp: '11:38 AM',
      senderId: '1',
      status: 'read',
      type: 'text',
    },
    {
      id: 'msg6',
      text: "Building a chat application actually. It's coming along nicely!",
      timestamp: '11:40 AM',
      senderId: 'me',
      status: 'read',
      type: 'text',
    },
    {
      id: 'msg7',
      text: 'Hey! How are you doing today?',
      timestamp: '11:42 AM',
      senderId: '1',
      status: 'read',
      type: 'text',
    },
  ],
  '2': [
    {
      id: 'msg1',
      text: 'Hey Bob!',
      timestamp: '10:00 AM',
      senderId: 'me',
      status: 'read',
      type: 'text',
    },
    {
      id: 'msg2',
      text: 'Hi! What\'s up?',
      timestamp: '10:15 AM',
      senderId: '2',
      status: 'read',
      type: 'text',
    },
    {
      id: 'msg3',
      text: 'Not much, just wanted to check in',
      timestamp: '10:20 AM',
      senderId: 'me',
      status: 'delivered',
      type: 'text',
    },
    {
      id: 'msg4',
      text: 'Can we meet tomorrow?',
      timestamp: '10:30 AM',
      senderId: '2',
      status: 'delivered',
      type: 'text',
    },
  ],
  '3': [
    {
      id: 'msg1',
      text: 'Carol, can you help me with something?',
      timestamp: 'Yesterday, 2:00 PM',
      senderId: 'me',
      status: 'read',
      type: 'text',
    },
    {
      id: 'msg2',
      text: 'Sure, what do you need?',
      timestamp: 'Yesterday, 2:05 PM',
      senderId: '3',
      status: 'read',
      type: 'text',
    },
    {
      id: 'msg3',
      text: 'I need help with the presentation for Friday',
      timestamp: 'Yesterday, 2:10 PM',
      senderId: 'me',
      status: 'read',
      type: 'text',
    },
    {
      id: 'msg4',
      text: 'No problem! I can look at it this evening',
      timestamp: 'Yesterday, 2:15 PM',
      senderId: '3',
      status: 'read',
      type: 'text',
    },
    {
      id: 'msg5',
      text: 'Thanks for your help!',
      timestamp: 'Yesterday, 2:20 PM',
      senderId: 'me',
      status: 'read',
      type: 'text',
    },
  ],
};

// Current user (logged in user)
export const currentUser: User = {
  id: 'me',
  name: 'John Doe',
  avatar: 'https://i.pravatar.cc/150?img=12',
  phone: '+1 234 567 8900',
  status: 'Available',
  isOnline: true,
};

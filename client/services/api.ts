import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_BASE_URL = 'http://localhost:4000/api';
const TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

// API response types
interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  error?: string;
  statusCode?: number;
}

// Request helper
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await storage.getItem(TOKEN_KEY);

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    // Handle token expiration
    if (response.status === 401 && accessToken) {
      const refreshed = await refreshToken();
      if (refreshed) {
        // Retry the request with new token
        return request(endpoint, options);
      }
    }

    throw {
      message: data.message || 'An error occurred',
      statusCode: response.status,
      ...data,
    };
  }

  return data;
}

// Refresh token
async function refreshToken(): Promise<boolean> {
  try {
    const refresh = await storage.getItem(REFRESH_TOKEN_KEY);
    if (!refresh) return false;

    const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });

    if (!response.ok) {
      await storage.removeItem(TOKEN_KEY);
      await storage.removeItem(REFRESH_TOKEN_KEY);
      return false;
    }

    const data = await response.json();
    await storage.setItem(TOKEN_KEY, data.accessToken);
    await storage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

// Auth API
export const authApi = {
  async register(data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) {
    return request<{
      message: string;
      user: User;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async login(data: { email: string; password: string }) {
    const response = await request<{
      message: string;
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    // Store tokens
    await storage.setItem(TOKEN_KEY, response.accessToken);
    await storage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);

    return response;
  },

  async verifyOtp(data: { email: string; otp: string }) {
    const response = await request<{
      message: string;
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    // Store tokens
    await storage.setItem(TOKEN_KEY, response.accessToken);
    await storage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);

    return response;
  },

  async resendOtp(email: string) {
    return request<{ message: string }>('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async forgotPassword(email: string) {
    return request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(data: { email: string; otp: string; newPassword: string }) {
    return request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async logout() {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      await storage.removeItem(TOKEN_KEY);
      await storage.removeItem(REFRESH_TOKEN_KEY);
    }
  },

  async getMe() {
    return request<User>('/auth/me');
  },

  async getToken() {
    return storage.getItem(TOKEN_KEY);
  },

  async isAuthenticated() {
    const token = await storage.getItem(TOKEN_KEY);
    return !!token;
  },
};

// Chat API
export const chatApi = {
  async getChats() {
    return request<Chat[]>('/chats');
  },

  async createChat(participantId: string) {
    return request<Chat>('/chats', {
      method: 'POST',
      body: JSON.stringify({ participantId }),
    });
  },

  async getChat(chatId: string) {
    return request<Chat>(`/chats/${chatId}`);
  },

  async getMessages(chatId: string, page = 1, limit = 50) {
    return request<MessagesResponse>(`/chats/${chatId}/messages?page=${page}&limit=${limit}`);
  },

  async sendMessage(chatId: string, data: SendMessageData) {
    return request<Message>(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async markAsRead(chatId: string) {
    return request(`/chats/${chatId}/read`, { method: 'POST' });
  },

  async deleteMessage(messageId: string) {
    return request(`/chats/messages/${messageId}`, { method: 'DELETE' });
  },

  async pinChat(chatId: string, isPinned: boolean) {
    return request(`/chats/${chatId}/pin`, {
      method: 'PATCH',
      body: JSON.stringify({ isPinned }),
    });
  },

  async muteChat(chatId: string, isMuted: boolean, muteUntil?: string) {
    return request(`/chats/${chatId}/mute`, {
      method: 'PATCH',
      body: JSON.stringify({ isMuted, muteUntil }),
    });
  },
};

// Contact API
export const contactApi = {
  async getContacts() {
    return request<Contact[]>('/contacts');
  },

  async syncContacts(phoneNumbers: string[]) {
    return request<SyncedContact[]>('/contacts/sync', {
      method: 'POST',
      body: JSON.stringify({ phoneNumbers }),
    });
  },

  async addContact(contactId: string, nickname?: string) {
    return request<Contact>('/contacts', {
      method: 'POST',
      body: JSON.stringify({ contactId, nickname }),
    });
  },

  async removeContact(contactId: string) {
    return request(`/contacts/${contactId}`, { method: 'DELETE' });
  },

  async blockUser(userId: string) {
    return request('/contacts/block', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  async unblockUser(userId: string) {
    return request(`/contacts/block/${userId}`, { method: 'DELETE' });
  },

  async getBlockedUsers() {
    return request<BlockedUser[]>('/contacts/blocked');
  },

  async searchUsers(query: string) {
    return request<User[]>(`/contacts/search?q=${encodeURIComponent(query)}`);
  },
};

// Group API
export const groupApi = {
  async createGroup(data: { name: string; memberIds: string[]; description?: string; avatar?: string }) {
    return request<Chat>('/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getGroup(groupId: string) {
    return request<Chat>(`/groups/${groupId}`);
  },

  async updateGroup(groupId: string, data: { name?: string; description?: string; avatar?: string }) {
    return request<Chat>(`/groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteGroup(groupId: string) {
    return request(`/groups/${groupId}`, { method: 'DELETE' });
  },

  async addMembers(groupId: string, memberIds: string[]) {
    return request(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ memberIds }),
    });
  },

  async removeMember(groupId: string, memberId: string) {
    return request(`/groups/${groupId}/members/${memberId}`, { method: 'DELETE' });
  },

  async leaveGroup(groupId: string) {
    return request(`/groups/${groupId}/leave`, { method: 'POST' });
  },

  async makeAdmin(groupId: string, memberId: string) {
    return request(`/groups/${groupId}/admins`, {
      method: 'POST',
      body: JSON.stringify({ memberId }),
    });
  },
};

// Call API
export const callApi = {
  async getCallHistory(page = 1, limit = 50) {
    return request<CallHistoryResponse>(`/calls?page=${page}&limit=${limit}`);
  },

  async getCall(callId: string) {
    return request<Call>(`/calls/${callId}`);
  },

  async deleteCall(callId: string) {
    return request(`/calls/${callId}`, { method: 'DELETE' });
  },
};

// Settings API
export const settingsApi = {
  async getPrivacySettings() {
    return request<PrivacySettings>('/settings/privacy');
  },

  async updatePrivacySettings(data: Partial<PrivacySettings>) {
    return request<PrivacySettings>('/settings/privacy', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async updateProfile(data: { name?: string; about?: string; avatar?: string }) {
    return request<User>('/settings/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async updateFcmToken(fcmToken: string) {
    return request('/settings/fcm-token', {
      method: 'PUT',
      body: JSON.stringify({ fcmToken }),
    });
  },

  async deleteAccount() {
    return request('/settings/account', { method: 'DELETE' });
  },
};

// Upload API
export const uploadApi = {
  async uploadFile(file: { uri: string; type: string; name: string }, folder?: string) {
    const token = await storage.getItem(TOKEN_KEY);
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type,
      name: file.name,
    } as any);
    if (folder) {
      formData.append('folder', folder);
    }

    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    return response.json() as Promise<{ url: string; filename: string }>;
  },

  async uploadAvatar(file: { uri: string; type: string; name: string }) {
    const token = await storage.getItem(TOKEN_KEY);
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type,
      name: file.name,
    } as any);

    const response = await fetch(`${API_BASE_URL}/upload/avatar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    return response.json() as Promise<{ url: string; filename: string }>;
  },
};

// Types
export interface User {
  id: string;
  name: string;
  email?: string;
  phone: string;
  avatar?: string;
  about?: string;
  isOnline?: boolean;
  lastSeen?: string;
  isVerified?: boolean;
  createdAt?: string;
}

export interface Chat {
  id: string;
  type: 'PRIVATE' | 'GROUP';
  name?: string;
  avatar?: string;
  description?: string;
  lastMessage?: Message;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  isOnline?: boolean;
  lastSeen?: string;
  members: ChatMember[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMember {
  id: string;
  userId: string;
  role: 'ADMIN' | 'MEMBER';
  user: {
    id: string;
    name: string;
    avatar?: string;
    isOnline?: boolean;
    lastSeen?: string;
  };
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'LOCATION' | 'CONTACT' | 'STICKER';
  content?: string;
  mediaUrl?: string;
  mediaType?: string;
  mediaDuration?: number;
  thumbnail?: string;
  fileName?: string;
  fileSize?: number;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  replyToId?: string;
  replyTo?: {
    id: string;
    content?: string;
    type: string;
    sender: { id: string; name: string };
  };
  isForwarded: boolean;
  status: 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  createdAt: string;
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface SendMessageData {
  type?: string;
  content?: string;
  mediaUrl?: string;
  mediaType?: string;
  mediaDuration?: number;
  thumbnail?: string;
  fileName?: string;
  fileSize?: number;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  replyToId?: string;
  isForwarded?: boolean;
}

export interface MessagesResponse {
  messages: Message[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface Contact {
  id: string;
  contactId: string;
  nickname?: string;
  name: string;
  phone: string;
  avatar?: string;
  about?: string;
  isOnline?: boolean;
  lastSeen?: string;
}

export interface SyncedContact {
  id: string;
  phone: string;
  name: string;
  avatar?: string;
  about?: string;
  isOnline?: boolean;
  lastSeen?: string;
  isContact: boolean;
}

export interface BlockedUser {
  id: string;
  blockedAt: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
    phone: string;
  };
}

export interface Call {
  id: string;
  callerId: string;
  receiverId: string;
  type: 'VOICE' | 'VIDEO';
  status: 'RINGING' | 'ANSWERED' | 'MISSED' | 'DECLINED' | 'BUSY' | 'ENDED';
  duration?: number;
  startedAt: string;
  answeredAt?: string;
  endedAt?: string;
  direction: 'incoming' | 'outgoing';
  otherUser: {
    id: string;
    name: string;
    avatar?: string;
  };
  caller: {
    id: string;
    name: string;
    avatar?: string;
  };
  receiver: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface CallHistoryResponse {
  calls: Call[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface PrivacySettings {
  lastSeenPrivacy: 'EVERYONE' | 'CONTACTS' | 'NOBODY';
  avatarPrivacy: 'EVERYONE' | 'CONTACTS' | 'NOBODY';
  aboutPrivacy: 'EVERYONE' | 'CONTACTS' | 'NOBODY';
  readReceiptsEnabled: boolean;
}

export { storage, API_BASE_URL };
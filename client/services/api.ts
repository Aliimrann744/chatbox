import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api';
// const API_BASE_URL = 'https://6af7-144-48-133-159.ngrok-free.app/api';
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

// Token refresh mutex - prevents concurrent refresh calls
let isRefreshing = false;
let refreshSubscribers: ((success: boolean) => void)[] = [];

// Auth failure callback - called when refresh token is definitively invalid
let authFailureCallback: (() => void) | null = null;

export function setOnAuthFailure(callback: (() => void) | null) {
  authFailureCallback = callback;
}

function onRefreshComplete(success: boolean) {
  refreshSubscribers.forEach(cb => cb(success));
  refreshSubscribers = [];
}

function waitForRefresh(): Promise<boolean> {
  return new Promise(resolve => {
    refreshSubscribers.push(resolve);
  });
}

// Request helper with retry protection
async function request<T>(endpoint: string, options: RequestInit = {}, _isRetry = false): Promise<T> {
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
    // Handle token expiration - only retry once to prevent infinite loops
    if (response.status === 401 && accessToken && !_isRetry) {
      const refreshed = await refreshToken();
      if (refreshed) {
        return request(endpoint, options, true);
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

// Exposed for socket service to refresh token on connect_error
export async function ensureFreshToken(): Promise<boolean> {
  return refreshToken();
}

// Refresh token with mutex
async function refreshToken(): Promise<boolean> {
  // If already refreshing, wait for the result instead of making a duplicate call
  if (isRefreshing) {
    return waitForRefresh();
  }

  isRefreshing = true;

  try {
    const refresh = await storage.getItem(REFRESH_TOKEN_KEY);
    if (!refresh) {
      onRefreshComplete(false);
      isRefreshing = false;
      return false;
    }

    const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });

    if (!response.ok) {
      // Only clear tokens when server definitively rejects the refresh token (401/403)
      if (response.status === 401 || response.status === 403) {
        await storage.removeItem(TOKEN_KEY);
        await storage.removeItem(REFRESH_TOKEN_KEY);
        authFailureCallback?.();
      }
      // For other errors (500, network issues), keep tokens for retry later
      onRefreshComplete(false);
      isRefreshing = false;
      return false;
    }

    const data = await response.json();
    await storage.setItem(TOKEN_KEY, data.accessToken);
    if (data.refreshToken) {
      await storage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    }
    onRefreshComplete(true);
    isRefreshing = false;
    return true;
  } catch {
    // Network error - don't clear tokens, user stays logged in
    onRefreshComplete(false);
    isRefreshing = false;
    return false;
  }
}

// Auth API
export const authApi = {
  async sendOtp(data: { phone?: string; countryCode?: string; email?: string }) {
    return request<{ message: string; otp?: string; }>('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async verifyOtp(data: { phone?: string; email?: string; otp: string }) {
    const response = await request<{
      message: string;
      user: User;
      accessToken: string;
      refreshToken: string;
      isNewUser: boolean;
    }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    // Store tokens
    await storage.setItem(TOKEN_KEY, response.accessToken);
    await storage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);

    return response;
  },

  async logout() {
    // Save token before clearing so we can still notify the server
    const token = await storage.getItem(TOKEN_KEY);

    // Always clear tokens first — this guarantees local cleanup
    await storage.removeItem(TOKEN_KEY);
    await storage.removeItem(REFRESH_TOKEN_KEY);

    // Notify the server (best effort — don't use request() to avoid 401 retry loops)
    try {
      if (token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch {
      // Ignore server errors — tokens are already cleared locally
    }
  },

  async getMe() {
    return request<User>('/auth/profile');
  },

  async getToken() {
    return storage.getItem(TOKEN_KEY);
  },

  async isAuthenticated() {
    const token = await storage.getItem(TOKEN_KEY);
    return !!token;
  },

  async updateProfile(data: { name?: string; about?: string; phone?: string; countryCode?: string; avatar?: { uri: string; type: string; name: string } }) {
    const token = await storage.getItem(TOKEN_KEY);
    const formData = new FormData();

    if (data.name !== undefined) formData.append('name', data.name);
    if (data.about !== undefined) formData.append('about', data.about);
    if (data.phone !== undefined) formData.append('phone', data.phone);
    if (data.countryCode !== undefined) formData.append('countryCode', data.countryCode);
    if (data.avatar) {
      await appendFileToFormData(formData, 'avatar', data.avatar);
    }

    const response = await fetch(`${API_BASE_URL}/auth/update-profile`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const result = await response.json();
    if (!response.ok) {
      throw { message: result.message || 'Failed to update profile', ...result };
    }
    return result as User;
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

  async syncContacts(contacts: { phone: string; name: string }[]) {
    return request<Contact[]>('/contacts/sync', {
      method: 'POST',
      body: JSON.stringify({ contacts }),
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

// Helper to append file to FormData (handles web vs native)
async function appendFileToFormData(formData: FormData, fieldName: string, file: { uri: string; type: string; name: string }) {
  if (Platform.OS === 'web') {
    const response = await fetch(file.uri);
    const blob = await response.blob();
    formData.append(fieldName, blob, file.name);
  } else {
    formData.append(fieldName, {
      uri: file.uri,
      type: file.type,
      name: file.name,
    } as any);
  }
}

// Helper: authenticated FormData upload with automatic 401 retry
async function authenticatedUpload(
  url: string,
  buildFormData: () => Promise<FormData>,
): Promise<{ url: string; filename: string }> {
  let token = await storage.getItem(TOKEN_KEY);

  let response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: await buildFormData(),
  });

  // Retry once after refreshing token
  if (response.status === 401) {
    const refreshed = await refreshToken();
    if (refreshed) {
      token = await storage.getItem(TOKEN_KEY);
      response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: await buildFormData(),
      });
    }
  }

  if (!response.ok) {
    throw new Error('Upload failed');
  }

  return response.json() as Promise<{ url: string; filename: string }>;
}

// Upload API
export const uploadApi = {
  async uploadFile(file: { uri: string; type: string; name: string }, folder?: string) {
    return authenticatedUpload(`${API_BASE_URL}/upload`, async () => {
      const formData = new FormData();
      await appendFileToFormData(formData, 'file', file);
      if (folder) formData.append('folder', folder);
      return formData;
    });
  },

  async uploadAvatar(file: { uri: string; type: string; name: string }) {
    return authenticatedUpload(`${API_BASE_URL}/upload/avatar`, async () => {
      const formData = new FormData();
      await appendFileToFormData(formData, 'file', file);
      return formData;
    });
  },
};

// Types
export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
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

export interface Status {
  id: string;
  userId: string;
  type: 'IMAGE' | 'VIDEO';
  mediaUrl: string;
  thumbnail?: string;
  caption?: string;
  expiresAt: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  viewCount: number;
  views?: StatusViewInfo[];
  isViewed?: boolean;
}

export interface StatusViewInfo {
  id: string;
  viewerId: string;
  viewedAt: string;
  viewer: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface ContactStatusGroup {
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  statuses: Status[];
  hasUnviewed: boolean;
  latestAt: string;
}

// Status API
export const statusApi = {
  async createStatus(data: { type: string; mediaUrl: string; thumbnail?: string; caption?: string }) {
    return request<Status>('/status', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getMyStatuses() {
    return request<Status[]>('/status/me');
  },

  async getContactStatuses() {
    return request<ContactStatusGroup[]>('/status/contacts');
  },

  async viewStatus(statusId: string) {
    return request<{ viewCount: number }>(`/status/${statusId}/view`, { method: 'POST' });
  },

  async deleteStatus(statusId: string) {
    return request(`/status/${statusId}`, { method: 'DELETE' });
  },
};

export { storage, API_BASE_URL };
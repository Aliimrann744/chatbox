import { API_BASE_URL, REFRESH_TOKEN_KEY, TOKEN_KEY } from '@/constants/constant';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

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
    'ngrok-skip-browser-warning': '1',
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
      authProvider: data.authProvider || undefined,
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
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
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
  async sendOtp(data: { phone?: string; countryCode?: string; email?: string; fcmToken?: string }) {
    return request<{ message: string; otp?: string; }>('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async verifyOtp(data: { phone?: string; email?: string; otp: string }) {
    const response = await request<VerifyOtpResponse>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    // If 2FA is required, don't store tokens — caller must complete challenge first
    if ((response as TwoFactorChallenge).twoFactorRequired) return response;

    const ok = response as AuthSuccess;
    await storage.setItem(TOKEN_KEY, ok.accessToken);
    await storage.setItem(REFRESH_TOKEN_KEY, ok.refreshToken);
    return response;
  },

  async verifyTwoFactor(data: {
    challengeToken: string;
    code: string;
    method: 'totp' | 'email' | 'backup';
  }) {
    const response = await request<AuthSuccess>('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    await storage.setItem(TOKEN_KEY, response.accessToken);
    await storage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
    return response;
  },

  async resendTwoFactorEmail(challengeToken: string) {
    return request<{ message: string }>('/auth/2fa/resend-email', {
      method: 'POST',
      body: JSON.stringify({ challengeToken }),
    });
  },

  async googleLogin(data: { idToken: string }) {
    const response = await request<VerifyOtpResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if ((response as TwoFactorChallenge).twoFactorRequired) return response;

    const ok = response as AuthSuccess;
    await storage.setItem(TOKEN_KEY, ok.accessToken);
    await storage.setItem(REFRESH_TOKEN_KEY, ok.refreshToken);
    return response;
  },

  async facebookLogin(data: { accessToken: string }) {
    const response = await request<VerifyOtpResponse>('/auth/facebook', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if ((response as TwoFactorChallenge).twoFactorRequired) return response;

    const ok = response as AuthSuccess;
    await storage.setItem(TOKEN_KEY, ok.accessToken);
    await storage.setItem(REFRESH_TOKEN_KEY, ok.refreshToken);
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
            'ngrok-skip-browser-warning': '1',
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
        'ngrok-skip-browser-warning': '1',
      },
      body: formData,
    });

    const result = await response.json();
    if (!response.ok) {
      throw { message: result.message || 'Failed to update profile', ...result };
    }
    return result as User;
  },

  async removeAvatar() {
    return request<User>('/auth/avatar', { method: 'DELETE' });
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

  async markAsDelivered(chatId: string) {
    return request(`/chats/${chatId}/deliver`, { method: 'POST' });
  },

  async deleteMessage(messageId: string) {
    return request(`/chats/messages/${messageId}`, { method: 'DELETE' });
  },

  async deleteMessagesForMe(messageIds: string[]) {
    return request<{ success: boolean }>('/chats/messages/delete-for-me', {
      method: 'POST',
      body: JSON.stringify({ messageIds }),
    });
  },

  async deleteMessageForEveryone(messageId: string) {
    return request<{ messageId: string; chatId: string }>('/chats/messages/delete-for-everyone', {
      method: 'POST',
      body: JSON.stringify({ messageId }),
    });
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

  async clearChat(chatId: string) {
    return request<{ success: boolean }>(`/chats/${chatId}/clear`, { method: 'DELETE' });
  },

  async archiveChat(chatId: string, isArchived: boolean) {
    return request(`/chats/${chatId}/archive`, {
      method: 'PATCH',
      body: JSON.stringify({ isArchived }),
    });
  },

  async favoriteChat(chatId: string, isFavorite: boolean) {
    return request(`/chats/${chatId}/favorite`, {
      method: 'PATCH',
      body: JSON.stringify({ isFavorite }),
    });
  },

  async setMediaVisibility(chatId: string, mediaVisibility: boolean) {
    return request<{ success: boolean; mediaVisibility: boolean }>(
      `/chats/${chatId}/media-visibility`,
      {
        method: 'PATCH',
        body: JSON.stringify({ mediaVisibility }),
      },
    );
  },

  async editMessage(messageId: string, content: string) {
    return request<Message>(`/chats/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    });
  },

  async markChatUnread(chatId: string) {
    return request(`/chats/${chatId}/mark-unread`, { method: 'PATCH' });
  },

  async deleteChat(chatId: string) {
    return request<{ success: boolean }>(`/chats/${chatId}`, { method: 'DELETE' });
  },

  async getSharedMedia(chatId: string, type?: string, page = 1, limit = 50) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (type) params.append('type', type);
    return request<SharedMediaResponse>(`/chats/${chatId}/media?${params}`);
  },

  async getStarredMessages(chatId: string) {
    return request<{ messages: Message[] }>(`/chats/${chatId}/starred`);
  },

  // All starred (shared) messages across every chat for the current user.
  // Used by the Shared screen. Each message is enriched with its owning chat.
  async getAllStarredMessages() {
    return request<{ messages: SharedMessage[] }>('/chats/starred/all');
  },

  // Mark every unread message in every chat as read. Used by "Read all".
  async markAllChatsAsRead() {
    return request<{ affected: { messageId: string; senderId: string; chatId: string }[] }>(
      '/chats/mark-all-read',
      { method: 'POST' },
    );
  },
};

// Shape returned by GET /chats/starred/all — a message plus a lightweight
// chat descriptor (id/type/name/avatar) resolved server-side so the
// Shared screen doesn't need to cross-reference the chat list.
export interface SharedMessage extends Message {
  starredAt: string;
  chat: {
    id: string;
    type: 'PRIVATE' | 'GROUP';
    name?: string | null;
    avatar?: string | null;
  };
}

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

  async checkBlocked(userId: string) {
    return request<{ isBlocked: boolean; iBlockedThem: boolean }>(`/contacts/blocked/check/${userId}`);
  },

  async searchUsers(query: string) {
    return request<User[]>(`/contacts/search?q=${encodeURIComponent(query)}`);
  },
};

// Group API
export const groupApi = {
  async createGroup(data: {
    name: string;
    memberIds: string[];
    description?: string;
    avatar?: string;
    permissions?: GroupPermissions;
  }) {
    return request<GroupChat>('/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getGroup(groupId: string) {
    return request<GroupChat>(`/groups/${groupId}`);
  },

  async updateGroup(
    groupId: string,
    data: { name?: string; description?: string; avatar?: string },
  ) {
    return request<GroupChat>(`/groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async updatePermissions(groupId: string, permissions: GroupPermissions) {
    return request<GroupChat>(`/groups/${groupId}/permissions`, {
      method: 'PATCH',
      body: JSON.stringify(permissions),
    });
  },

  async deleteGroup(groupId: string) {
    return request(`/groups/${groupId}`, { method: 'DELETE' });
  },

  async addMembers(groupId: string, memberIds: string[]) {
    return request<{ success: boolean; addedMembers: string[] }>(
      `/groups/${groupId}/members`,
      {
        method: 'POST',
        body: JSON.stringify({ memberIds }),
      },
    );
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

  async removeAdmin(groupId: string, memberId: string) {
    return request(`/groups/${groupId}/admins/${memberId}`, {
      method: 'DELETE',
    });
  },
};

// Group permission roles — mirror server enum.
export type GroupPermissionRole = 'ADMINS' | 'ALL_MEMBERS';

export interface GroupPermissions {
  editInfoRole?: GroupPermissionRole;
  sendMessagesRole?: GroupPermissionRole;
  addMembersRole?: GroupPermissionRole;
  approveMembersRole?: GroupPermissionRole;
}

// Rich group-chat response from /groups/:id — includes full member list and
// permission settings (unlike the lean Chat returned by /chats).
export interface GroupChat {
  id: string;
  type: 'GROUP';
  name: string;
  description?: string;
  avatar?: string;
  creatorId: string;
  creator?: { id: string; name: string; avatar?: string };
  editInfoRole: GroupPermissionRole;
  sendMessagesRole: GroupPermissionRole;
  addMembersRole: GroupPermissionRole;
  approveMembersRole: GroupPermissionRole;
  members: GroupMember[];
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  id: string;
  userId: string;
  role: 'ADMIN' | 'MEMBER';
  joinedAt: string;
  user: {
    id: string;
    name: string;
    phone?: string;
    countryCode?: string;
    avatar?: string;
    about?: string;
    isOnline?: boolean;
    lastSeen?: string;
  };
}

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

  async setLanguage(language: string) {
    return request<{ success: boolean; language: string }>('/settings/language', {
      method: 'PUT',
      body: JSON.stringify({ language }),
    });
  },

  async setSecurityNotifications(enabled: boolean) {
    return request<{ success: boolean; enabled: boolean }>('/settings/security-notifications', {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
  },

  async getLoginEvents(limit = 20) {
    return request<{ events: LoginEvent[] }>(`/settings/login-events?limit=${limit}`);
  },

  async requestEmailChange(email: string) {
    return request<{ message: string; otp?: string }>('/settings/change-email/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async verifyEmailChange(code: string) {
    return request<{ success: boolean; email: string }>('/settings/change-email/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async deactivateAccount() {
    return request<{ success: boolean }>('/settings/account/deactivate', { method: 'POST' });
  },

  async reactivateAccount() {
    return request<{ success: boolean }>('/settings/account/reactivate', { method: 'POST' });
  },

  async scheduleDeletion() {
    return request<{ success: boolean; scheduledDeletionAt: string }>(
      '/settings/account/schedule-deletion',
      { method: 'POST' },
    );
  },

  async cancelDeletion() {
    return request<{ success: boolean }>('/settings/account/cancel-deletion', { method: 'POST' });
  },

  async requestDataExport() {
    return request<{
      success: boolean;
      alreadyQueued: boolean;
      requestId: string;
      status: DataExportStatus;
    }>('/settings/request-data', { method: 'POST' });
  },

  async listDataExports(limit = 10) {
    return request<{ requests: DataExportRequest[] }>(`/settings/data-exports?limit=${limit}`);
  },
};

// Two-Factor API
export const twoFactorApi = {
  async getStatus() {
    return request<TwoFactorStatus>('/2fa/status');
  },

  async setupTotp() {
    return request<{ secret: string; otpauth: string; qrDataUrl: string }>('/2fa/setup/totp', {
      method: 'POST',
    });
  },

  async verifyTotpSetup(code: string) {
    return request<{ enabled: boolean; method: string; backupCodes: string[] }>(
      '/2fa/setup/totp/verify',
      { method: 'POST', body: JSON.stringify({ code }) },
    );
  },

  async enableEmailOtp() {
    return request<{ enabled: boolean; method: string; backupCodes: string[] }>(
      '/2fa/setup/email',
      { method: 'POST' },
    );
  },

  async requestDisable() {
    return request<{ message: string; otp?: string }>('/2fa/disable/request', { method: 'POST' });
  },

  async confirmDisable(code: string) {
    return request<{ disabled: boolean }>('/2fa/disable/confirm', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async regenerateBackupCodes() {
    return request<{ backupCodes: string[] }>('/2fa/backup-codes/regenerate', { method: 'POST' });
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
    headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': '1' },
    body: await buildFormData(),
  });

  // Retry once after refreshing token
  if (response.status === 401) {
    const refreshed = await refreshToken();
    if (refreshed) {
      token = await storage.getItem(TOKEN_KEY);
      response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': '1' },
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

// Auth response types
export interface AuthSuccess {
  message: string;
  user: User;
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
}

export interface TwoFactorChallenge {
  message: string;
  twoFactorRequired: true;
  method: 'NONE' | 'EMAIL' | 'TOTP';
  challengeToken: string;
}

export type VerifyOtpResponse = AuthSuccess | TwoFactorChallenge;

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
  isArchived: boolean;
  isFavorite: boolean;
  isMarkedUnread: boolean;
  mediaVisibility?: boolean;
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
  joinedAt?: string;
  leftAt?: string | null;
  user: {
    id: string;
    name: string;
    avatar?: string;
    isOnline?: boolean;
    lastSeen?: string;
    phone?: string;
    countryCode?: string;
  };
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'LOCATION' | 'CONTACT' | 'STICKER' | 'CALL' | 'SYSTEM';
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
  isStarred?: boolean;
  isDeletedForEveryone?: boolean;
  isEdited?: boolean;
  editedAt?: string;
  status: 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  createdAt: string;
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
  // Per-user read receipts (populated by GET /chats/:id/messages and
  // appended client-side when a `messages_read` socket event arrives).
  // Used to compute WhatsApp-style group read ticks.
  readReceipts?: { userId: string; readAt: string }[];
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

export interface SharedMedia {
  id: string;
  type: string;
  mediaUrl: string;
  mediaType?: string;
  thumbnail?: string;
  fileName?: string;
  fileSize?: number;
  createdAt: string;
  sender: { id: string; name: string };
}

export interface SharedMediaResponse {
  media: SharedMedia[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
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

export interface TwoFactorStatus {
  enabled: boolean;
  method: 'NONE' | 'EMAIL' | 'TOTP';
  backupCodesRemaining: number;
}

export type DataExportStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface DataExportRequest {
  id: string;
  status: DataExportStatus;
  bytes?: number | null;
  error?: string | null;
  requestedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  sentTo?: string | null;
}

export interface LoginEvent {
  id: string;
  method: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  device?: string | null;
  location?: string | null;
  isNewDevice: boolean;
  createdAt: string;
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
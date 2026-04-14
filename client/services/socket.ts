import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_BASE_URL, ensureFreshToken } from '@/services/api';
import { TOKEN_KEY } from '@/constants/constant';

// Strip /api suffix for socket connections — Socket.IO namespaces don't use the REST prefix
const SOCKET_URL = (API_BASE_URL || '').replace(/\/api\/?$/, '');

// Types for socket events
export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'LOCATION' | 'CONTACT' | 'STICKER' | 'CALL';
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

export interface TypingEvent {
  chatId: string;
  userId: string;
  isTyping: boolean;
}

export interface OnlineStatusEvent {
  userId: string;
  isOnline: boolean;
  lastSeen?: string;
}

export interface MessageStatusEvent {
  messageId: string;
  status: 'DELIVERED' | 'READ';
  readBy?: string;
}

export interface MessagesReadEvent {
  chatId: string;
  messageIds: string[];
  readBy: string;
}

// Socket service class
class SocketService {
  private chatSocket: Socket | null = null;
  private callSocket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private isRefreshingToken = false;

  // ==================== CONNECTION ====================

  async connect() {
    // Prevent double connection
    if (this.chatSocket?.connected && this.callSocket?.connected) return;

    const token = await this.getToken();
    if (!token) {
      console.log('No token available, cannot connect to socket');
      return;
    }

    const socketOpts = {
      auth: (cb: any) => {
        this.getToken().then(t => cb({ token: t }));
      },
      transports: ['websocket', 'polling'] as any,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    };

    // Connect chat namespace if not already connected
    if (!this.chatSocket?.connected) {
      if (this.chatSocket) this.chatSocket.disconnect();
      this.chatSocket = io(`${SOCKET_URL}/chat`, socketOpts);
      this.setupChatListeners();
    }

    // Connect call namespace if not already connected
    if (!this.callSocket?.connected) {
      if (this.callSocket) this.callSocket.disconnect();
      this.callSocket = io(`${SOCKET_URL}/call`, socketOpts);
      this.setupCallListeners();
    }
  }

  async reconnect() {
    this.disconnect();
    await this.connect();
  }

  disconnect() {
    if (this.chatSocket) {
      this.chatSocket.disconnect();
      this.chatSocket = null;
    }
    if (this.callSocket) {
      this.callSocket.disconnect();
      this.callSocket = null;
    }
    // Note: Do NOT clear listeners here. They are managed by subscribers
    // (CallProvider, etc.) via the unsubscribe functions returned by on().
    // Clearing them here would permanently lose listeners after any
    // disconnect/reconnect cycle (e.g., token refresh, auth state change).
  }

  private async getToken(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(TOKEN_KEY);
    }
    return SecureStore.getItemAsync(TOKEN_KEY);
  }

  // ==================== CHAT SOCKET LISTENERS ====================

  private setupChatListeners() {
    if (!this.chatSocket) return;

    this.chatSocket.on('connect', () => {
      console.log('Chat socket connected');
      this.emit('chat_connected', null);
    });

    this.chatSocket.on('disconnect', () => {
      console.log('Chat socket disconnected');
      this.emit('chat_disconnected', null);
    });

    this.chatSocket.on('connect_error', async () => {
      // Refresh token once so the next reconnection attempt uses a fresh token
      if (!this.isRefreshingToken) {
        this.isRefreshingToken = true;
        try { await ensureFreshToken(); } catch {}
        this.isRefreshingToken = false;
      }
    });

    this.chatSocket.on('connected', (data) => {
      console.log('Chat authenticated:', data);
    });

    // Message events
    this.chatSocket.on('new_message', (message: Message) => {
      this.emit('new_message', message);
    });

    this.chatSocket.on('message_sent', (data: { tempId: string; message: Message }) => {
      this.emit('message_sent', data);
    });

    this.chatSocket.on('message_error', (data: { tempId: string; error: string }) => {
      this.emit('message_error', data);
    });

    this.chatSocket.on('message_status', (data: MessageStatusEvent) => {
      this.emit('message_status', data);
    });

    this.chatSocket.on('messages_read', (data: MessagesReadEvent) => {
      this.emit('messages_read', data);
    });

    // Typing events
    this.chatSocket.on('user_typing', (data: TypingEvent) => {
      this.emit('user_typing', data);
    });

    // Online status events
    this.chatSocket.on('online_status', (data: OnlineStatusEvent) => {
      this.emit('online_status', data);
    });

    // Message deleted events
    this.chatSocket.on('message_deleted', (data: any) => {
      this.emit('message_deleted', data);
    });

    this.chatSocket.on('message_deleted_for_everyone', (data: any) => {
      this.emit('message_deleted_for_everyone', data);
    });
  }

  // ==================== CALL SOCKET LISTENERS ====================

  private setupCallListeners() {
    if (!this.callSocket) return;

    this.callSocket.on('connect', () => {
      console.log('Call socket connected');
      this.emit('call_connected', null);
    });

    this.callSocket.on('disconnect', (reason) => {
      console.log('Call socket disconnected:', reason);
    });

    this.callSocket.on('connect_error', async (err) => {
      console.warn('Call socket connect_error:', err.message);
      if (!this.isRefreshingToken) {
        this.isRefreshingToken = true;
        try { await ensureFreshToken(); } catch {}
        this.isRefreshingToken = false;
      }
    });

    this.callSocket.on('incoming_call', (data) => {
      this.emit('incoming_call', data);
    });

    this.callSocket.on('call_accepted', (data) => {
      this.emit('call_accepted', data);
    });

    this.callSocket.on('call_declined', (data) => {
      this.emit('call_declined', data);
    });

    this.callSocket.on('call_busy', (data) => {
      this.emit('call_busy', data);
    });

    this.callSocket.on('call_offer', (data) => {
      this.emit('call_offer', data);
    });

    this.callSocket.on('call_answer', (data) => {
      this.emit('call_answer', data);
    });

    this.callSocket.on('call_ice_candidate', (data) => {
      this.emit('call_ice_candidate', data);
    });

    this.callSocket.on('call_ended', (data) => {
      this.emit('call_ended', data);
    });

    this.callSocket.on('call_missed', (data) => {
      this.emit('call_missed', data);
    });
  }

  // ==================== CHAT ACTIONS ====================

  sendMessage(data: {
    chatId: string;
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
    tempId: string;
  }) {
    if (!this.chatSocket) {
      console.warn('Socket not initialized, cannot send message');
      this.emit('message_error', { tempId: data.tempId, error: 'Socket not connected' });
      return;
    }
    // If disconnected, trigger reconnect — socket.io will buffer & send when connected
    if (!this.chatSocket.connected) {
      this.chatSocket.connect();
    }
    this.chatSocket.emit('send_message', data);
  }

  markAsDelivered(messageId: string) {
    if (!this.chatSocket) return;
    this.chatSocket.emit('message_delivered', { messageId });
  }

  markAsRead(chatId: string) {
    if (!this.chatSocket) return;
    this.chatSocket.emit('message_read', { chatId });
  }

  startTyping(chatId: string) {
    if (!this.chatSocket) return;
    this.chatSocket.emit('typing_start', { chatId });
  }

  stopTyping(chatId: string) {
    if (!this.chatSocket) return;
    this.chatSocket.emit('typing_stop', { chatId });
  }

  joinChat(chatId: string) {
    if (!this.chatSocket) return;
    this.chatSocket.emit('join_chat', { chatId });
  }

  leaveChat(chatId: string) {
    if (!this.chatSocket) return;
    this.chatSocket.emit('leave_chat', { chatId });
  }

  deleteMessage(messageId: string, forEveryone: boolean): Promise<any> {
    return new Promise((resolve) => {
      if (!this.chatSocket) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }
      this.chatSocket.emit('delete_message', { messageId, forEveryone }, resolve);
    });
  }

  deleteMessages(messageIds: string[], forEveryone: boolean): Promise<any> {
    return new Promise((resolve) => {
      if (!this.chatSocket) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }
      this.chatSocket.emit('delete_messages', { messageIds, forEveryone }, resolve);
    });
  }

  markAllRead(): Promise<{ success: boolean; count?: number; error?: string }> {
    return new Promise((resolve) => {
      if (!this.chatSocket) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }
      this.chatSocket.emit('mark_all_read', {}, resolve);
    });
  }

  starMessage(messageId: string, starred: boolean): Promise<any> {
    return new Promise((resolve) => {
      if (!this.chatSocket) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }
      this.chatSocket.emit('star_message', { messageId, starred }, resolve);
    });
  }

  getOnlineStatus(userIds: string[]): Promise<{ statuses: { userId: string; isOnline: boolean }[] }> {
    return new Promise((resolve) => {
      if (!this.chatSocket) {
        resolve({ statuses: [] });
        return;
      }
      this.chatSocket.emit('get_online_status', { userIds }, resolve);
    });
  }

  // ==================== CALL ACTIONS ====================

  initiateCall(receiverId: string, type: 'VOICE' | 'VIDEO'): Promise<any> {
    return new Promise((resolve) => {
      if (!this.callSocket?.connected) {
        console.warn('Call socket not connected, attempting reconnect...');
        this.callSocket?.connect();
        // Wait briefly for reconnection
        setTimeout(() => {
          if (!this.callSocket?.connected) {
            resolve({ success: false, error: 'Call socket not connected' });
            return;
          }
          this.callSocket.emit('call_initiate', { receiverId, type }, resolve);
        }, 1500);
        return;
      }
      this.callSocket.emit('call_initiate', { receiverId, type }, resolve);
    });
  }

  acceptCall(callId: string): Promise<any> {
    return new Promise((resolve) => {
      if (!this.callSocket) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }
      this.callSocket.emit('call_accept', { callId }, resolve);
    });
  }

  declineCall(callId: string): Promise<any> {
    return new Promise((resolve) => {
      if (!this.callSocket?.connected) {
        console.warn('Call socket not connected for decline');
        this.callSocket?.connect();
        // Wait briefly then try
        setTimeout(() => {
          if (this.callSocket?.connected) {
            this.callSocket.emit('call_decline', { callId }, resolve);
          } else {
            resolve({ success: false, error: 'Call socket not connected' });
          }
        }, 1500);
        return;
      }
      this.callSocket.emit('call_decline', { callId }, resolve);
    });
  }

  endCall(callId: string): Promise<any> {
    return new Promise((resolve) => {
      if (!this.callSocket?.connected) {
        console.warn('Call socket not connected for end');
        this.callSocket?.connect();
        setTimeout(() => {
          if (this.callSocket?.connected) {
            this.callSocket.emit('call_end', { callId }, resolve);
          } else {
            resolve({ success: false, error: 'Call socket not connected' });
          }
        }, 1500);
        return;
      }
      this.callSocket.emit('call_end', { callId }, resolve);
    });
  }

  sendCallOffer(callId: string, offer: any) {
    if (!this.callSocket) return;
    this.callSocket.emit('call_offer', { callId, offer });
  }

  sendCallAnswer(callId: string, answer: any) {
    if (!this.callSocket) return;
    this.callSocket.emit('call_answer', { callId, answer });
  }

  sendIceCandidate(callId: string, candidate: any) {
    if (!this.callSocket) return;
    this.callSocket.emit('call_ice_candidate', { callId, candidate });
  }

  // ==================== EVENT EMITTER ====================

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in socket listener for ${event}:`, error);
      }
    });
  }

  // ==================== STATUS ====================

  get isConnected(): boolean {
    return this.chatSocket?.connected ?? false;
  }

  get isCallConnected(): boolean {
    return this.callSocket?.connected ?? false;
  }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;

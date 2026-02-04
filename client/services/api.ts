import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
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

// Types
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  status: string;
  isOnline?: boolean;
  lastSeen?: string;
  isVerified: boolean;
  createdAt?: string;
}

export { storage, API_BASE_URL };
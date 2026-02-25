import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, User, setOnAuthFailure } from '@/services/api';
import socketService from '@/services/socket';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  sendOtp: (params: { phone?: string; countryCode?: string; email?: string }) => Promise<void>;
  verifyOtp: (params: { phone?: string; email?: string }, otp: string) => Promise<{ isNewUser: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, isLoading: true, isAuthenticated: false });

  // Register auth failure callback — fires when refresh token is definitively rejected (401/403)
  // This is the ONLY path that forces the user back to login
  useEffect(() => {
    setOnAuthFailure(() => {
      socketService.disconnect();
      setState({ user: null, isLoading: false, isAuthenticated: false });
    });
    return () => setOnAuthFailure(null);
  }, []);

  // Auto-connect/disconnect WebSocket based on auth state
  useEffect(() => {
    if (state.isAuthenticated && !state.isLoading) {
      socketService.connect();
    } else if (!state.isAuthenticated && !state.isLoading) {
      socketService.disconnect();
    }
  }, [state.isAuthenticated, state.isLoading]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const hasToken = await authApi.isAuthenticated();
      if (!hasToken) {
        setState({ user: null, isLoading: false, isAuthenticated: false });
        return;
      }

      // Token exists — try to load user profile
      // If access token is expired, request() will auto-refresh it
      try {
        const user = await authApi.getMe();
        setState({ user, isLoading: false, isAuthenticated: true });
      } catch (error: any) {
        // Check if tokens were cleared by a definitive refresh failure
        const stillHasToken = await authApi.isAuthenticated();
        if (stillHasToken) {
          // Network error or temporary server issue — stay authenticated
          // User profile will load when connectivity returns
          setState({ user: null, isLoading: false, isAuthenticated: true });
        } else {
          // Refresh token was rejected — tokens were cleared, need fresh login
          setState({ user: null, isLoading: false, isAuthenticated: false });
        }
      }
    } catch (error) {
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  };

  const sendOtp = useCallback(async (params: { phone?: string; countryCode?: string; email?: string }) => {
    await authApi.sendOtp(params);
  }, []);

  const verifyOtp = useCallback(async (params: { phone?: string; email?: string }, otp: string) => {
    const response = await authApi.verifyOtp({ ...params, otp });
    setState({ user: response.user, isLoading: false, isAuthenticated: true });
    return { isNewUser: response.isNewUser };
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Ignore server errors — tokens are already cleared by authApi.logout's finally block
    }
    socketService.disconnect();
    setState({ user: null, isLoading: false, isAuthenticated: false });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const user = await authApi.getMe();
      setState((prev) => ({ ...prev, user }));
    } catch (error) {
      // Don't immediately logout — request() already attempted token refresh.
      // Only mark unauthenticated if tokens were cleared (refresh definitively failed)
      const hasToken = await authApi.isAuthenticated();
      if (!hasToken) {
        socketService.disconnect();
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
      // Otherwise silently fail — profile will refresh when network returns
    }
  }, []);

  const value: AuthContextType = {
    ...state,
    sendOtp,
    verifyOtp,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, User, setOnAuthFailure } from '@/services/api';
import socketService from '@/services/socket';
import { cache, CacheKeys } from '@/services/cache';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  sendOtp: (params: { phone?: string; countryCode?: string; email?: string }) => Promise<void>;
  verifyOtp: (params: { phone?: string; email?: string }, otp: string) => Promise<{ isNewUser: boolean }>;
  googleLogin: () => Promise<{ isNewUser: boolean }>;
  facebookLogin: () => Promise<{ isNewUser: boolean }>;
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

      // Load cached user immediately so UI doesn't flash empty
      const cachedUser = cache.get<User>(CacheKeys.USER_PROFILE);
      if (cachedUser) {
        setState({ user: cachedUser, isLoading: false, isAuthenticated: true });
      }

      // Token exists — try to load user profile
      // If access token is expired, request() will auto-refresh it
      try {
        const user = await authApi.getMe();
        cache.set(CacheKeys.USER_PROFILE, user);
        setState({ user, isLoading: false, isAuthenticated: true });
      } catch (error: any) {
        // Check if tokens were cleared by a definitive refresh failure
        const stillHasToken = await authApi.isAuthenticated();
        if (stillHasToken) {
          // Network error or temporary server issue — stay authenticated
          // Use cached user if available, otherwise null
          setState({ user: cachedUser, isLoading: false, isAuthenticated: true });
        } else {
          // Refresh token was rejected — tokens were cleared, need fresh login
          cache.delete(CacheKeys.USER_PROFILE);
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
    cache.set(CacheKeys.USER_PROFILE, response.user);
    setState({ user: response.user, isLoading: false, isAuthenticated: true });
    return { isNewUser: response.isNewUser };
  }, []);

  const googleLogin = useCallback(async () => {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    });
    const signInResult = await GoogleSignin.signIn();
    const idToken = signInResult?.data?.idToken;
    if (!idToken) throw new Error('Google sign-in failed: no ID token');
    const response = await authApi.googleLogin({ idToken });
    cache.set(CacheKeys.USER_PROFILE, response.user);
    setState({ user: response.user, isLoading: false, isAuthenticated: true });
    return { isNewUser: response.isNewUser };
  }, []);

  const facebookLogin = useCallback(async () => {
    const { LoginManager, AccessToken } = require('react-native-fbsdk-next');
    const result = await LoginManager.logInWithPermissions(['public_profile', 'email']);
    if (result.isCancelled) throw new Error('Facebook login cancelled');
    const tokenData = await AccessToken.getCurrentAccessToken();
    if (!tokenData?.accessToken) throw new Error('Facebook login failed: no access token');
    const response = await authApi.facebookLogin({ accessToken: tokenData.accessToken });
    cache.set(CacheKeys.USER_PROFILE, response.user);
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
    cache.clearAll();
    setState({ user: null, isLoading: false, isAuthenticated: false });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const user = await authApi.getMe();
      cache.set(CacheKeys.USER_PROFILE, user);
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
    googleLogin,
    facebookLogin,
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

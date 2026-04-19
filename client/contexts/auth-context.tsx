import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
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
  googleLogin: () => Promise<{ isNewUser: boolean; hasPhone: boolean }>;
  facebookLogin: () => Promise<{ isNewUser: boolean; hasPhone: boolean }>;
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
      socketService.disconnect({ force: true });
      setState({ user: null, isLoading: false, isAuthenticated: false });
    });
    return () => setOnAuthFailure(null);
  }, []);

  // Auto-connect/disconnect WebSocket based on auth state
  useEffect(() => {
    if (state.isAuthenticated && !state.isLoading) {
      socketService.connect();
    } else if (!state.isAuthenticated && !state.isLoading) {
      socketService.disconnect({ force: true });
    }
  }, [state.isAuthenticated, state.isLoading]);

  // Reconnect socket when app returns to foreground
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const wasBackground = appStateRef.current.match(/inactive|background/);
      const goingToBackground = nextAppState.match(/inactive|background/) && appStateRef.current === 'active';

      if (goingToBackground && state.isAuthenticated) {
        // Disconnect socket immediately when going to background.
        // This tells the server the user is offline so it uses FCM push instead.
        // Without this, the server sends via a stale socket that the backgrounded app can't process.
        console.log('[Auth] App going to background, disconnecting sockets');
        socketService.disconnect();
      }

      if (wasBackground && nextAppState === 'active') {
        console.log('[Auth] App returned to foreground');
        if (state.isAuthenticated) {
          console.log('[Auth] Reconnecting sockets...');
          socketService.reconnect();
        }
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [state.isAuthenticated]);

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
    // For phone-based OTP we deliver the code via FCM push, so attach the
    // device's current FCM token to the request. The server requires it.
    let fcmToken: string | undefined;
    if (params.phone) {
      try {
        const {
          getMessaging,
          requestPermission,
          getToken,
        } = require('@react-native-firebase/messaging');
        const messaging = getMessaging();
        // On Android 13+ this triggers the POST_NOTIFICATIONS runtime prompt
        // IF the permission is declared in app.config.ts.
        const authStatus = await requestPermission(messaging);
        const enabled = authStatus === 1 /* AUTHORIZED */ || authStatus === 2 /* PROVISIONAL */;
        if (!enabled) {
          throw new Error(
            'Notification permission was not granted. Please enable notifications for this app and try again.',
          );
        }
        fcmToken = await getToken(messaging);
        console.log('[auth] Got FCM token for OTP:', fcmToken?.slice(0, 12) + '…');
      } catch (err: any) {
        console.warn('[auth] Could not obtain FCM token:', err?.message || err);
        throw new Error(
          err?.message ||
            'Could not register for notifications. Please allow notifications and try again.',
        );
      }
    }
    await authApi.sendOtp({ ...params, fcmToken });
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
    // Sign out first so the account picker always shows (lets user switch accounts)
    try { await GoogleSignin.signOut(); } catch {}
    const signInResult = await GoogleSignin.signIn();
    const idToken = signInResult?.data?.idToken;
    if (!idToken) throw new Error('Google sign-in failed: no ID token');
    const response = await authApi.googleLogin({ idToken });
    cache.set(CacheKeys.USER_PROFILE, response.user);
    setState({ user: response.user, isLoading: false, isAuthenticated: true });
    return { isNewUser: response.isNewUser, hasPhone: !!response.user.phone };
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
    return { isNewUser: response.isNewUser, hasPhone: !!response.user.phone };
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Ignore server errors — tokens are already cleared by authApi.logout's finally block
    }
    // Sign out from Google so the account picker shows on next login
    try {
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      await GoogleSignin.signOut();
    } catch {}
    socketService.disconnect({ force: true });
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
        socketService.disconnect({ force: true });
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

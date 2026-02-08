import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, User } from '@/services/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  sendOtp: (phone: string, countryCode?: string) => Promise<void>;
  verifyOtp: (phone: string, otp: string) => Promise<{ isNewUser: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, isLoading: true, isAuthenticated: false });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const isAuth = await authApi.isAuthenticated();
      if (isAuth) {
        const user = await authApi.getMe();
        setState({ user, isLoading: false, isAuthenticated: true });
      } else {
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    } catch (error) {
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  };

  const sendOtp = useCallback(async (phone: string, countryCode?: string) => {
    await authApi.sendOtp({ phone, countryCode });
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string) => {
    const response = await authApi.verifyOtp({ phone, otp });
    setState({ user: response.user, isLoading: false, isAuthenticated: true });
    return { isNewUser: response.isNewUser };
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Ignore server errors — tokens are already cleared by authApi.logout's finally block
    }
    setState({ user: null, isLoading: false, isAuthenticated: false });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const user = await authApi.getMe();
      setState((prev) => ({ ...prev, user }));
    } catch (error) {
      // Token might be invalid, logout
      await logout();
    }
  }, [logout]);

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

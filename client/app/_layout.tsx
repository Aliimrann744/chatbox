import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { CallProvider } from '@/contexts/call-context';
import { NotificationProvider } from '@/contexts/notification-context';
import { IncomingCallListener } from '@/components/call/incoming-call-listener';
import { ActiveCallBanner } from '@/components/call/active-call-banner';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Register background handlers at module level (before React tree mounts)
import { registerBackgroundHandler, registerNotifeeBackgroundHandler } from '@/services/background-handler';
registerBackgroundHandler();
registerNotifeeBackgroundHandler();

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Create custom themes based on our color scheme
  const lightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.cardBackground,
      text: colors.text,
      border: colors.border,
    },
  };

  const darkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.cardBackground,
      text: colors.text,
      border: colors.border,
    },
  };

  // Handle authentication redirects
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const currentScreen = segments[1];
    // A profile is considered complete when the user has a phone number.
    // Google/Facebook logins land without one, so we must detour through setup-profile.
    const needsProfileSetup = isAuthenticated && !!user && !user.phone;

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to continue/welcome page if not authenticated
      router.replace('/(auth)/continue');
    } else if (isAuthenticated && needsProfileSetup) {
      // Force the user to setup-profile until they add a phone number,
      // regardless of where expo-router currently has them.
      if (currentScreen !== 'setup-profile') {
        router.replace({
          pathname: '/(auth)/setup-profile',
          params: { loginMode: 'social' },
        });
      }
    } else if (isAuthenticated && inAuthGroup) {
      // Allow staying on transitional screens (verify-otp, loading) while the
      // rest of the auth flow finishes. Everything else means the user is
      // fully logged in and should be punted into the app.
      if (currentScreen !== 'verify-otp' && currentScreen !== 'loading') {
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, isLoading, segments, user]);

  // Show loading screen while checking auth
  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? darkTheme : lightTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="new-chat"
          options={{
            title: 'Select Contact',
            headerStyle: {
              backgroundColor: colors.primary,
            },
            headerTintColor: colors.headerText,
            headerTitleStyle: {
              fontWeight: '600',
            },
          }}
        />
        <Stack.Screen
          name="chat/[id]"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="group/new"
          options={{
            title: 'Add participants',
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: colors.headerText,
            headerTitleStyle: { fontWeight: '600' },
          }}
        />
        <Stack.Screen
          name="group/setup"
          options={{
            title: 'New group',
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: colors.headerText,
            headerTitleStyle: { fontWeight: '600' },
          }}
        />
        <Stack.Screen name="group/[id]/info" options={{ headerShown: false }} />
        <Stack.Screen
          name="group/[id]/permissions"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="group/[id]/add-members"
          options={{
            title: 'Add participants',
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: colors.headerText,
            headerTitleStyle: { fontWeight: '600' },
          }}
        />
        <Stack.Screen
          name="chat/user-info"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="chat/media-gallery"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="call"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen
          name="status/create"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen
          name="status/viewer"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen name="archived-chats" options={{ headerShown: false }} />
        <Stack.Screen
          name="image-editor"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'fade',
          }}
        />
        <Stack.Screen name="shared-messages" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <IncomingCallListener />
      <ActiveCallBanner />
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'light'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <NotificationProvider>
            <CallProvider>
              <RootLayoutNav />
            </CallProvider>
          </NotificationProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

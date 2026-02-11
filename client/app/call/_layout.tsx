import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CallLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'fullScreenModal',
        animation: 'fade',
        contentStyle: {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      }}>
      <Stack.Screen name="incoming" />
      <Stack.Screen name="active" />
    </Stack>
  );
}

import { Stack } from 'expo-router';

export default function CallLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'fullScreenModal',
        animation: 'fade',
      }}>
      <Stack.Screen name="incoming" />
      <Stack.Screen name="active" />
    </Stack>
  );
}

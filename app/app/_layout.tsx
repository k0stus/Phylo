import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../store/authStore';
import { soloTheme } from '../constants/theme';

export default function RootLayout() {
  const hydrate = useAuthStore(s => s.hydrate);

  useEffect(() => {
    hydrate();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: soloTheme.background },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="battle/lobby"  options={{ presentation: 'modal' }} />
        <Stack.Screen name="battle/result" options={{ presentation: 'modal', gestureEnabled: false }} />
        <Stack.Screen name="scan/capture"  options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="scan/result"   options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

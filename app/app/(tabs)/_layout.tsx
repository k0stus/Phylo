import { Tabs } from 'expo-router';
import { soloTheme, battleTheme } from '../../constants/theme';
import { View, Text } from 'react-native';

function TabIcon({ label, active, color }: { label: string; active: boolean; color: string }) {
  return (
    <Text style={{ fontSize: 10, color, fontWeight: active ? '700' : '400', marginTop: 2 }}>
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: soloTheme.surface,
          borderTopColor: soloTheme.border,
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 20,
        },
        tabBarActiveTintColor: soloTheme.accent,
        tabBarInactiveTintColor: soloTheme.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Dashboard', tabBarLabel: 'Dashboard' }}
      />
      <Tabs.Screen
        name="capture"
        options={{ title: 'Scan', tabBarLabel: 'Scan' }}
      />
      <Tabs.Screen
        name="battle"
        options={{ title: 'Battle', tabBarLabel: 'Battle' }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'History', tabBarLabel: 'History' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarLabel: 'Profile' }}
      />
    </Tabs>
  );
}

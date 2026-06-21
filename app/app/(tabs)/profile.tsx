import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { getMyProfile, clearTokens } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { soloTheme, fontSize, spacing, radius } from '../../constants/theme';

export default function ProfileScreen() {
  const { user, setUser, logout } = useAuthStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getMyProfile().then(p => {
      if (p && !p.error) setUser(p as Parameters<typeof setUser>[0]);
    });
  }, []);

  async function handleLogout() {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive', onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  if (!user) return <View style={styles.centered}><ActivityIndicator color={soloTheme.accent} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.username[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.username}>{user.username}</Text>
        {user.country && <Text style={styles.country}>{user.country}</Text>}
        <Text style={styles.email}>{user.email}</Text>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Wins" value={user.wins} color={soloTheme.success} />
        <StatCard label="Losses" value={user.losses} color={soloTheme.error} />
        <StatCard label="Battles" value={user.wins + user.losses} color={soloTheme.accent} />
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statCard, { borderColor: color + '55' }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: soloTheme.background, padding: spacing.lg, paddingTop: 80 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: soloTheme.background },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: soloTheme.accent + '33', justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { fontSize: fontSize['2xl'], fontWeight: '800', color: soloTheme.accent },
  username: { fontSize: fontSize.xl, fontWeight: '800', color: soloTheme.text },
  country: { fontSize: fontSize.sm, color: soloTheme.textMuted, marginTop: 2 },
  email: { fontSize: fontSize.sm, color: soloTheme.textMuted, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  statCard: {
    flex: 1, backgroundColor: soloTheme.surface, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center', borderWidth: 1,
  },
  statValue: { fontSize: fontSize.xl, fontWeight: '800' },
  statLabel: { fontSize: fontSize.xs, color: soloTheme.textMuted, marginTop: 2 },
  logoutBtn: {
    borderColor: soloTheme.error, borderWidth: 1, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center', marginTop: 'auto',
  },
  logoutText: { color: soloTheme.error, fontSize: fontSize.md, fontWeight: '600' },
});

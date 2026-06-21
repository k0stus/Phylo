import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { getMyProfile, getBattleHistory } from '../../services/api';
import { soloTheme, fontSize, spacing, radius } from '../../constants/theme';

interface RecentBattle {
  id: string; opponent_username: string; result: 'win' | 'loss' | 'draw';
  my_score: number; completed_at: number;
}

export default function DashboardScreen() {
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const [battles, setBattles] = useState<RecentBattle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [profile, hist] = await Promise.all([
        getMyProfile(),
        getBattleHistory({ limit: 5 }),
      ]);
      if (profile && !profile.error) {
        setUser(profile as Parameters<typeof setUser>[0]);
      }
      if (hist.battles) setBattles(hist.battles as RecentBattle[]);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={soloTheme.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>Hey, {user?.username ?? 'Athlete'}</Text>
      <Text style={styles.subtext}>Ready to track your progress?</Text>

      <View style={styles.statsRow}>
        <StatCard label="Wins" value={String(user?.wins ?? 0)} accent={soloTheme.success} />
        <StatCard label="Losses" value={String(user?.losses ?? 0)} accent={soloTheme.error} />
        <StatCard label="Battles" value={String((user?.wins ?? 0) + (user?.losses ?? 0))} accent={soloTheme.accent} />
      </View>

      <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/(tabs)/capture')}>
        <Text style={styles.ctaBtnText}>+ New Scan</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.ctaBtn, { backgroundColor: soloTheme.surfaceAlt, borderColor: soloTheme.border, borderWidth: 1 }]}
        onPress={() => router.push('/(tabs)/battle')}
      >
        <Text style={[styles.ctaBtnText, { color: soloTheme.accent }]}>⚔ Battle a Friend</Text>
      </TouchableOpacity>

      {battles.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recent Battles</Text>
          {battles.map(b => (
            <TouchableOpacity
              key={b.id}
              style={styles.battleRow}
              onPress={() => router.push(`/battle/result?id=${b.id}`)}
            >
              <Text style={styles.battleOpponent}>vs {b.opponent_username}</Text>
              <View style={[styles.resultBadge, { backgroundColor: resultColor(b.result) + '33' }]}>
                <Text style={[styles.resultText, { color: resultColor(b.result) }]}>
                  {b.result.toUpperCase()}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function resultColor(r: 'win' | 'loss' | 'draw') {
  return r === 'win' ? soloTheme.success : r === 'loss' ? soloTheme.error : soloTheme.textMuted;
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={[styles.statCard, { borderColor: accent + '55' }]}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: soloTheme.background },
  content: { padding: spacing.lg, paddingTop: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: soloTheme.background },
  greeting: { fontSize: fontSize['2xl'], fontWeight: '700', color: soloTheme.text },
  subtext: { fontSize: fontSize.sm, color: soloTheme.textMuted, marginTop: 4, marginBottom: spacing.xl },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: {
    flex: 1, backgroundColor: soloTheme.surface, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center', borderWidth: 1,
  },
  statValue: { fontSize: fontSize['2xl'], fontWeight: '800' },
  statLabel: { fontSize: fontSize.xs, color: soloTheme.textMuted, marginTop: 2 },
  ctaBtn: {
    backgroundColor: soloTheme.accent, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center', marginBottom: spacing.md,
  },
  ctaBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: '700' },
  sectionTitle: {
    fontSize: fontSize.lg, fontWeight: '700', color: soloTheme.text,
    marginTop: spacing.lg, marginBottom: spacing.md,
  },
  battleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: soloTheme.surface, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: soloTheme.border,
  },
  battleOpponent: { color: soloTheme.text, fontSize: fontSize.md },
  resultBadge: { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  resultText: { fontSize: fontSize.xs, fontWeight: '700' },
});

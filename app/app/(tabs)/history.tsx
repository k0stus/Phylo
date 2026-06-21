import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { getBattleHistory } from '../../services/api';
import { soloTheme, fontSize, spacing, radius } from '../../constants/theme';

interface HistoryEntry {
  id: string; opponent_username: string; result: 'win' | 'loss' | 'draw';
  my_score: number; opponent_score: number; completed_at: number;
}

export default function HistoryScreen() {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBattleHistory({ limit: 50 }).then(res => {
      if (res.battles) setItems(res.battles as HistoryEntry[]);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={soloTheme.accent} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Battle History</Text>
      {items.length === 0 && (
        <Text style={styles.empty}>No battles yet. Challenge a friend!</Text>
      )}
      {items.map(item => (
        <TouchableOpacity
          key={item.id}
          style={styles.row}
          onPress={() => router.push(`/battle/result?id=${item.id}`)}
        >
          <View>
            <Text style={styles.opponent}>vs {item.opponent_username}</Text>
            <Text style={styles.date}>{new Date(item.completed_at * 1000).toLocaleDateString()}</Text>
          </View>
          <View style={styles.right}>
            <Text style={styles.scores}>{item.my_score?.toFixed(0)} – {item.opponent_score?.toFixed(0)}</Text>
            <View style={[styles.badge, { backgroundColor: resultColor(item.result) + '33' }]}>
              <Text style={[styles.badgeText, { color: resultColor(item.result) }]}>
                {item.result.toUpperCase()}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function resultColor(r: 'win' | 'loss' | 'draw') {
  return r === 'win' ? soloTheme.success : r === 'loss' ? soloTheme.error : soloTheme.textMuted;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: soloTheme.background },
  content: { padding: spacing.lg, paddingTop: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: soloTheme.background },
  title: { fontSize: fontSize['2xl'], fontWeight: '800', color: soloTheme.text, marginBottom: spacing.xl },
  empty: { color: soloTheme.textMuted, textAlign: 'center', marginTop: spacing.xl },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: soloTheme.surface, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: soloTheme.border,
  },
  opponent: { color: soloTheme.text, fontSize: fontSize.md, fontWeight: '600' },
  date: { color: soloTheme.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 4 },
  scores: { color: soloTheme.textMuted, fontSize: fontSize.sm },
  badge: { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: fontSize.xs, fontWeight: '700' },
});

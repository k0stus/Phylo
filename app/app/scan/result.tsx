import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { soloTheme, fontSize, spacing, radius } from '../../constants/theme';

const CATEGORY_LABELS: Record<string, string> = {
  muscularity: 'Muscularity',
  leanness: 'Leanness',
  symmetry: 'Symmetry',
  posing: 'Posing',
  conditioning: 'Conditioning',
};

export default function ScanResultScreen() {
  const params = useLocalSearchParams<{
    scan_id: string;
    overall_score: string;
    category_scores: string;
    ai_feedback: string;
    used: string;
    limit: string;
  }>();

  const overall = parseFloat(params.overall_score ?? '0');
  const categories = params.category_scores ? JSON.parse(params.category_scores) as Record<string, number> : {};
  const remaining = parseInt(params.limit ?? '5') - parseInt(params.used ?? '1');

  function scoreColor(s: number) {
    if (s >= 70) return soloTheme.scoreHigh;
    if (s >= 45) return soloTheme.scoreMid;
    return soloTheme.scoreLow;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Scan Complete</Text>

      {/* Overall score */}
      <View style={[styles.scoreCircle, { borderColor: scoreColor(overall) + '88' }]}>
        <Text style={[styles.scoreValue, { color: scoreColor(overall) }]}>{overall.toFixed(1)}</Text>
        <Text style={styles.scoreLabel}>Overall</Text>
      </View>

      {/* Category breakdown */}
      <Text style={styles.sectionTitle}>Category Scores</Text>
      {Object.entries(categories).map(([key, val]) => (
        <View key={key} style={styles.catRow}>
          <Text style={styles.catName}>{CATEGORY_LABELS[key] ?? key}</Text>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${val}%`, backgroundColor: scoreColor(val as number) }]} />
          </View>
          <Text style={[styles.catVal, { color: scoreColor(val as number) }]}>{(val as number).toFixed(0)}</Text>
        </View>
      ))}

      {/* AI Feedback */}
      <Text style={styles.sectionTitle}>Feedback</Text>
      <View style={styles.feedbackBox}>
        <Text style={styles.feedbackText}>{params.ai_feedback}</Text>
      </View>

      <Text style={styles.usageText}>{remaining} scan{remaining !== 1 ? 's' : ''} remaining today</Text>

      <TouchableOpacity style={styles.doneBtn} onPress={() => router.replace('/(tabs)/dashboard')}>
        <Text style={styles.doneBtnText}>Done</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.scanAgainBtn} onPress={() => router.replace('/(tabs)/capture')}>
        <Text style={styles.scanAgainText}>Scan Again</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: soloTheme.background },
  content: { padding: spacing.lg, paddingTop: 60, alignItems: 'center' },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: soloTheme.text, marginBottom: spacing.xl },
  scoreCircle: {
    width: 140, height: 140, borderRadius: 70, borderWidth: 3,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xl,
    backgroundColor: soloTheme.surface,
  },
  scoreValue: { fontSize: fontSize['3xl'], fontWeight: '900' },
  scoreLabel: { color: soloTheme.textMuted, fontSize: fontSize.xs },
  sectionTitle: {
    fontSize: fontSize.md, fontWeight: '700', color: soloTheme.text,
    alignSelf: 'flex-start', marginBottom: spacing.md, marginTop: spacing.lg,
  },
  catRow: {
    flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: spacing.sm, gap: spacing.sm,
  },
  catName: { width: 90, color: soloTheme.textMuted, fontSize: fontSize.sm },
  barBg: { flex: 1, height: 6, backgroundColor: soloTheme.surfaceAlt, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  catVal: { width: 28, fontSize: fontSize.sm, fontWeight: '700', textAlign: 'right' },
  feedbackBox: {
    backgroundColor: soloTheme.surface, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: soloTheme.border, width: '100%',
  },
  feedbackText: { color: soloTheme.text, fontSize: fontSize.sm, lineHeight: 20 },
  usageText: { color: soloTheme.textMuted, fontSize: fontSize.xs, marginTop: spacing.xl },
  doneBtn: {
    backgroundColor: soloTheme.accent, borderRadius: radius.md, padding: spacing.md,
    alignItems: 'center', width: '100%', marginTop: spacing.lg,
  },
  doneBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: '700' },
  scanAgainBtn: {
    borderWidth: 1, borderColor: soloTheme.border, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center', width: '100%', marginTop: spacing.md,
  },
  scanAgainText: { color: soloTheme.textMuted, fontSize: fontSize.md },
});

import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Share, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getBattleDetail } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { battleTheme, soloTheme, fontSize, spacing, radius } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PANEL = (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm) / 2;

interface BattleResult {
  user_id: string; username: string;
  overall_score: number;
  category_scores: Record<string, number>;
  ai_feedback: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  muscularity: 'Muscle',
  leanness: 'Lean',
  symmetry: 'Symm.',
  posing: 'Pose',
  conditioning: 'Cond.',
};

export default function BattleResultScreen() {
  const params = useLocalSearchParams<{
    id?: string;                // when viewing from history
    result_a?: string;          // when coming fresh from a battle
    result_b?: string;
    winner_id?: string;
    my_user_id?: string;
    battle_id?: string;
  }>();
  const user = useAuthStore(s => s.user);
  const [resultA, setResultA] = useState<BattleResult | null>(null);
  const [resultB, setResultB] = useState<BattleResult | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.result_a && params.result_b) {
      // Fresh from a battle — data passed via params
      setResultA(JSON.parse(params.result_a) as BattleResult);
      setResultB(JSON.parse(params.result_b) as BattleResult);
      setWinnerId(params.winner_id || null);
      setLoading(false);
    } else if (params.id) {
      // Loading from history
      getBattleDetail(params.id).then((detail: any) => {
        if (detail.user_a) {
          setResultA({
            user_id: detail.user_a.id,
            username: detail.user_a.username,
            overall_score: detail.user_a.overall_score ?? 0,
            category_scores: detail.user_a.category_scores ?? {},
            ai_feedback: '',
          });
          setResultB({
            user_id: detail.user_b.id,
            username: detail.user_b.username,
            overall_score: detail.user_b.overall_score ?? 0,
            category_scores: detail.user_b.category_scores ?? {},
            ai_feedback: '',
          });
          setWinnerId(detail.winner_id ?? null);
        }
        setLoading(false);
      });
    }
  }, []);

  if (loading || !resultA || !resultB) {
    return <View style={styles.centered}><ActivityIndicator color={battleTheme.accent} size="large" /></View>;
  }

  const myId = params.my_user_id || user?.id;
  const iAmA = resultA.user_id === myId;
  const myResult = iAmA ? resultA : resultB;
  const oppResult = iAmA ? resultB : resultA;

  const iWon = winnerId === myId;
  const isDraw = !winnerId;
  const iLost = !!winnerId && winnerId !== myId;

  const outcomeLabel = iWon ? 'GG, YOU WIN!' : isDraw ? 'DRAW — GG!' : 'GG — NICE BATTLE!';
  const outcomeColor = iWon ? soloTheme.success : isDraw ? battleTheme.accent : soloTheme.error;

  const categories = Object.keys(resultA.category_scores);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Outcome banner */}
      <View style={[styles.outcomeBanner, { borderColor: outcomeColor + '66' }]}>
        <Text style={[styles.outcomeText, { color: outcomeColor }]}>{outcomeLabel}</Text>
      </View>

      {/* Score panels */}
      <View style={styles.panels}>
        <ScorePanel result={myResult} isWinner={winnerId === myId} label="YOU" />
        <View style={styles.vsDivider}><Text style={styles.vsText}>VS</Text></View>
        <ScorePanel result={oppResult} isWinner={winnerId === oppResult.user_id} label="OPPONENT" />
      </View>

      {/* Category breakdown */}
      <Text style={styles.sectionTitle}>Category Breakdown</Text>
      {categories.map(cat => {
        const scoreA = myResult.category_scores[cat] ?? 0;
        const scoreB = oppResult.category_scores[cat] ?? 0;
        const winner = scoreA > scoreB ? 'me' : scoreB > scoreA ? 'opp' : 'tie';
        return (
          <View key={cat} style={styles.catRow}>
            <Text style={[styles.catScore, { color: winner === 'me' ? soloTheme.success : soloTheme.text }]}>
              {scoreA.toFixed(0)}
            </Text>
            <View style={styles.catCenter}>
              <Text style={styles.catLabel}>{CATEGORY_LABELS[cat] ?? cat}</Text>
              {winner !== 'tie' && (
                <Text style={styles.catWinner}>{winner === 'me' ? '← you' : 'them →'}</Text>
              )}
            </View>
            <Text style={[styles.catScore, { color: winner === 'opp' ? soloTheme.error : soloTheme.text }]}>
              {scoreB.toFixed(0)}
            </Text>
          </View>
        );
      })}

      {/* AI feedback */}
      {myResult.ai_feedback ? (
        <>
          <Text style={styles.sectionTitle}>Your Feedback</Text>
          <View style={styles.feedbackBox}>
            <Text style={styles.feedbackText}>{myResult.ai_feedback}</Text>
          </View>
        </>
      ) : null}

      {/* Actions */}
      <TouchableOpacity style={styles.battleAgainBtn} onPress={() => router.replace('/(tabs)/battle')}>
        <Text style={styles.battleAgainText}>Rematch / New Battle</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/(tabs)/dashboard')}>
        <Text style={styles.homeText}>Back to Dashboard</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function ScorePanel({ result, isWinner, label }: { result: BattleResult; isWinner: boolean; label: string }) {
  return (
    <View style={[styles.panel, isWinner && styles.panelWinner]}>
      <Text style={styles.panelLabel}>{label}</Text>
      <Text style={styles.panelUsername}>{result.username}</Text>
      <Text style={[styles.panelScore, { color: isWinner ? soloTheme.success : battleTheme.text }]}>
        {result.overall_score.toFixed(1)}
      </Text>
      {isWinner && <Text style={styles.winnerCrown}>👑</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: battleTheme.background },
  content: { padding: spacing.lg, paddingTop: 60, paddingBottom: 80 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: battleTheme.background },
  outcomeBanner: {
    borderWidth: 1, borderRadius: radius.md, padding: spacing.lg,
    alignItems: 'center', marginBottom: spacing.xl, backgroundColor: battleTheme.surface,
  },
  outcomeText: { fontSize: fontSize.xl, fontWeight: '900', letterSpacing: 3 },
  panels: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  panel: {
    flex: 1, backgroundColor: battleTheme.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: battleTheme.border,
    padding: spacing.md, alignItems: 'center',
  },
  panelWinner: { borderColor: soloTheme.success + '88', backgroundColor: soloTheme.success + '11' },
  panelLabel: { fontSize: fontSize.xs, color: battleTheme.textMuted, letterSpacing: 2, marginBottom: 4 },
  panelUsername: { fontSize: fontSize.sm, fontWeight: '700', color: battleTheme.text, marginBottom: 4 },
  panelScore: { fontSize: fontSize['3xl'], fontWeight: '900' },
  winnerCrown: { fontSize: fontSize.lg, marginTop: 4 },
  vsDivider: {
    width: 28, justifyContent: 'center', alignItems: 'center',
  },
  vsText: { color: battleTheme.textMuted, fontSize: fontSize.xs, fontWeight: '700' },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: battleTheme.text, marginBottom: spacing.md },
  catRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: battleTheme.surface, borderRadius: radius.sm, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: battleTheme.border,
  },
  catScore: { fontSize: fontSize.lg, fontWeight: '800', width: 40, textAlign: 'center' },
  catCenter: { flex: 1, alignItems: 'center' },
  catLabel: { color: battleTheme.textMuted, fontSize: fontSize.xs, letterSpacing: 1 },
  catWinner: { color: battleTheme.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  feedbackBox: {
    backgroundColor: battleTheme.surface, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: battleTheme.border, marginBottom: spacing.xl,
  },
  feedbackText: { color: battleTheme.text, fontSize: fontSize.sm, lineHeight: 20 },
  battleAgainBtn: {
    backgroundColor: battleTheme.accent, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center', marginBottom: spacing.md,
  },
  battleAgainText: { color: battleTheme.background, fontSize: fontSize.md, fontWeight: '700' },
  homeBtn: {
    borderWidth: 1, borderColor: battleTheme.border, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center',
  },
  homeText: { color: battleTheme.textMuted, fontSize: fontSize.md },
});

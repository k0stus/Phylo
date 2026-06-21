import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Share, Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { createInvite, acceptInvite, getBattleHistory } from '../../services/api';
import { connectToMatchmaking } from '../../services/battleClient';
import { useAuthStore } from '../../store/authStore';
import { battleTheme, soloTheme, fontSize, spacing, radius } from '../../constants/theme';
import type { WSClient, MatchmakingServerMessage } from '../../services/battleClient';

interface HistoryEntry {
  id: string; opponent_username: string; result: 'win' | 'loss' | 'draw';
  my_score: number; completed_at: number;
}

export default function BattleHomeScreen() {
  const user = useAuthStore(s => s.user);
  const params = useLocalSearchParams<{ invite_code?: string }>();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [joiningCode, setJoiningCode] = useState('');
  const [matchmaking, setMatchmaking] = useState(false);
  const mmClientRef = useRef<WSClient<MatchmakingServerMessage> | null>(null);

  useEffect(() => {
    loadHistory();
    // Handle deep link invite code
    if (params.invite_code) setInviteCode(params.invite_code);
    return () => { mmClientRef.current?.close(); };
  }, []);

  async function loadHistory() {
    const res = await getBattleHistory({ limit: 20 });
    if (res.battles) setHistory(res.battles as HistoryEntry[]);
    setLoadingHistory(false);
  }

  async function handleCreateInvite() {
    setCreatingInvite(true);
    try {
      const res = await createInvite();
      if (res.error || !res.code || !res.battle_id) {
        Alert.alert('Error', res.error ?? 'Failed to create invite');
        return;
      }
      await Share.share({
        message: `Join me for a physique battle on Phylo! Code: ${res.code}\nOpen: ${res.deep_link}`,
        url: res.deep_link,
      });
      // Navigate to lobby as the inviter
      router.push(`/battle/lobby?battleId=${res.battle_id}&role=inviter`);
    } finally {
      setCreatingInvite(false);
    }
  }

  async function handleJoinCode() {
    const code = joiningCode.trim().toUpperCase();
    if (code.length < 4) { Alert.alert('Enter invite code'); return; }

    const res = await acceptInvite(code);
    if (res.error || !res.battle_id) {
      Alert.alert('Invalid code', res.error ?? 'Code not found or expired');
      return;
    }
    router.push(`/battle/lobby?battleId=${res.battle_id}&role=joiner`);
  }

  async function handleFindRandom() {
    setMatchmaking(true);
    try {
      const client = await connectToMatchmaking();
      mmClientRef.current = client;

      client.onMessage((msg) => {
        if (msg.type === 'matched') {
          mmClientRef.current = null;
          setMatchmaking(false);
          router.push(`/battle/lobby?battleId=${msg.battle_id}&role=random`);
        } else if (msg.type === 'error') {
          setMatchmaking(false);
          Alert.alert('Matchmaking', msg.message);
        }
      });

      client.setOnClose(() => {
        if (matchmaking) {
          setMatchmaking(false);
        }
      });
    } catch {
      setMatchmaking(false);
      Alert.alert('Connection error', 'Could not connect to matchmaking. Try again.');
    }
  }

  function cancelMatchmaking() {
    mmClientRef.current?.close();
    mmClientRef.current = null;
    setMatchmaking(false);
  }

  const wins = user?.wins ?? 0;
  const losses = user?.losses ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>BATTLE</Text>
      <Text style={styles.record}>{wins}W – {losses}L</Text>

      {/* Invite a friend */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Challenge a Friend</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateInvite} disabled={creatingInvite}>
          {creatingInvite
            ? <ActivityIndicator color="#07070a" />
            : <Text style={styles.primaryBtnText}>Invite a Friend</Text>
          }
        </TouchableOpacity>

        <View style={styles.dividerRow}><View style={styles.dividerLine} /><Text style={styles.dividerText}>or enter code</Text><View style={styles.dividerLine} /></View>

        <View style={styles.codeRow}>
          <TextInput
            style={styles.codeInput} placeholder="ABC123" placeholderTextColor={battleTheme.textMuted}
            value={joiningCode} onChangeText={setJoiningCode}
            autoCapitalize="characters" maxLength={8}
          />
          <TouchableOpacity style={styles.joinBtn} onPress={handleJoinCode}>
            <Text style={styles.joinBtnText}>Join</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Random matchmaking */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Find a Random Opponent</Text>
        {matchmaking ? (
          <View style={styles.matchmakingState}>
            <ActivityIndicator color={battleTheme.accent} />
            <Text style={styles.matchmakingText}>Searching for opponent...</Text>
            <TouchableOpacity onPress={cancelMatchmaking}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: battleTheme.accent }]} onPress={handleFindRandom}>
            <Text style={[styles.primaryBtnText, { color: '#07070a' }]}>Find Opponent</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Battle history */}
      <Text style={styles.sectionTitle}>Battle History</Text>
      {loadingHistory
        ? <ActivityIndicator color={battleTheme.accent} style={{ marginTop: spacing.lg }} />
        : history.length === 0
          ? <Text style={styles.emptyText}>No battles yet — challenge someone!</Text>
          : history.map(b => (
              <TouchableOpacity key={b.id} style={styles.historyRow} onPress={() => router.push(`/battle/result?id=${b.id}`)}>
                <Text style={styles.historyOpponent}>vs {b.opponent_username}</Text>
                <View style={[styles.badge, { backgroundColor: resultColor(b.result) + '33' }]}>
                  <Text style={[styles.badgeText, { color: resultColor(b.result) }]}>{b.result.toUpperCase()}</Text>
                </View>
              </TouchableOpacity>
            ))
      }
    </ScrollView>
  );
}

function resultColor(r: 'win' | 'loss' | 'draw') {
  return r === 'win' ? soloTheme.success : r === 'loss' ? soloTheme.error : soloTheme.textMuted;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: battleTheme.background },
  content: { padding: spacing.lg, paddingTop: 60 },
  title: {
    fontSize: fontSize['3xl'], fontWeight: '900', color: battleTheme.text,
    letterSpacing: 6, textAlign: 'center',
  },
  record: { fontSize: fontSize.lg, color: battleTheme.accent, textAlign: 'center', marginTop: 4, marginBottom: spacing.xl },
  card: {
    backgroundColor: battleTheme.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: battleTheme.border,
    padding: spacing.lg, marginBottom: spacing.md,
  },
  cardTitle: { fontSize: fontSize.md, fontWeight: '700', color: battleTheme.text, marginBottom: spacing.md },
  primaryBtn: {
    backgroundColor: battleTheme.text, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center',
  },
  primaryBtnText: { color: battleTheme.background, fontSize: fontSize.md, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md, gap: spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: battleTheme.border },
  dividerText: { color: battleTheme.textMuted, fontSize: fontSize.xs },
  codeRow: { flexDirection: 'row', gap: spacing.sm },
  codeInput: {
    flex: 1, backgroundColor: battleTheme.surfaceAlt, color: battleTheme.text,
    borderRadius: radius.sm, borderWidth: 1, borderColor: battleTheme.border,
    padding: spacing.md, fontSize: fontSize.lg, fontWeight: '700', letterSpacing: 4,
    textAlign: 'center',
  },
  joinBtn: {
    backgroundColor: battleTheme.accent, borderRadius: radius.sm,
    paddingHorizontal: spacing.lg, justifyContent: 'center',
  },
  joinBtnText: { color: battleTheme.background, fontWeight: '700', fontSize: fontSize.md },
  matchmakingState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  matchmakingText: { color: battleTheme.textMuted, fontSize: fontSize.md },
  cancelText: { color: soloTheme.error, fontSize: fontSize.sm, marginTop: spacing.sm },
  sectionTitle: {
    fontSize: fontSize.lg, fontWeight: '700', color: battleTheme.text,
    marginTop: spacing.lg, marginBottom: spacing.md,
  },
  emptyText: { color: battleTheme.textMuted, fontSize: fontSize.md, textAlign: 'center', marginTop: spacing.lg },
  historyRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: battleTheme.surface, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: battleTheme.border,
  },
  historyOpponent: { color: battleTheme.text, fontSize: fontSize.md },
  badge: { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  badgeText: { fontSize: fontSize.xs, fontWeight: '700' },
});

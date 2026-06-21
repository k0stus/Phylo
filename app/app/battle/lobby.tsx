import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
  Dimensions, Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { router, useLocalSearchParams } from 'expo-router';
import { connectToBattleRoom, WSClient, BattleServerMessage, BattleResult, PublicProfile } from '../../services/battleClient';
import { analyzePhoto } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useBattleStore } from '../../store/battleStore';
import { battleTheme, fontSize, spacing, radius } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PANEL_WIDTH = (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm) / 2;

type LobbyPhase = 'connecting' | 'waiting_for_opponent' | 'both_connected' | 'countdown' | 'capturing' | 'analyzing' | 'done';

export default function BattleLobbyScreen() {
  const params = useLocalSearchParams<{ battleId: string; role: string }>();
  const user = useAuthStore(s => s.user);
  const [permission] = useCameraPermissions();
  const [phase, setPhase] = useState<LobbyPhase>('connecting');
  const [opponent, setOpponent] = useState<PublicProfile | null>(null);
  const [countdownVal, setCountdownVal] = useState(3);
  const [myDone, setMyDone] = useState(false);
  const [oppDone, setOppDone] = useState(false);
  const [ready, setReady] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const wsRef = useRef<WSClient<BattleServerMessage> | null>(null);
  const countAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!params.battleId) { router.back(); return; }
    let cancelled = false;

    (async () => {
      try {
        const client = await connectToBattleRoom(params.battleId);
        if (cancelled) { client.close(); return; }
        wsRef.current = client;
        setPhase('waiting_for_opponent');

        client.setOnClose(() => {
          if (!cancelled) router.back();
        });

        client.onMessage(handleServerMessage);
      } catch (err) {
        if (!cancelled) {
          Alert.alert('Connection failed', 'Could not connect to battle room.');
          router.back();
        }
      }
    })();

    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, [params.battleId]);

  function handleServerMessage(msg: BattleServerMessage) {
    switch (msg.type) {
      case 'waiting_for_opponent':
        setPhase('waiting_for_opponent');
        break;
      case 'opponent_joined':
        setOpponent(msg.opponent);
        setPhase('both_connected');
        break;
      case 'both_ready':
        setPhase('countdown');
        break;
      case 'countdown':
        setCountdownVal(msg.count);
        animateCountdown();
        break;
      case 'capture_now':
        setPhase('capturing');
        captureAndAnalyze();
        break;
      case 'analyzing':
        setPhase('analyzing');
        if (msg.side === 'a') setMyDone(true);
        else setOppDone(true);
        break;
      case 'results':
        // Navigate to result screen
        router.replace({
          pathname: '/battle/result',
          params: {
            result_a: JSON.stringify(msg.result_a),
            result_b: JSON.stringify(msg.result_b),
            winner_id: msg.winner_id ?? '',
            my_user_id: user?.id ?? '',
            battle_id: params.battleId,
          },
        });
        break;
      case 'opponent_disconnected':
        Alert.alert('Opponent left', 'Your opponent disconnected.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        break;
      case 'error':
        Alert.alert('Error', msg.message, [{ text: 'OK', onPress: () => router.back() }]);
        break;
    }
  }

  function animateCountdown() {
    countAnim.setValue(0);
    Animated.spring(countAnim, { toValue: 1, useNativeDriver: true }).start();
  }

  function sendReady() {
    setReady(true);
    wsRef.current?.send({ type: 'ready' });
  }

  async function captureAndAnalyze() {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: false });
      if (!photo) throw new Error('No photo');

      const resized = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 800 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (!resized.base64) throw new Error('Encode failed');

      const result = await analyzePhoto({
        image: resized.base64,
        media_type: 'image/jpeg',
        battle_id: params.battleId,
      });

      if (result.error) {
        Alert.alert('Scan failed', result.error);
        wsRef.current?.close();
        router.back();
        return;
      }

      wsRef.current?.send({ type: 'scan_complete', scan_id: result.scan_id! });
    } catch (err) {
      Alert.alert('Capture error', err instanceof Error ? err.message : 'Unknown');
      wsRef.current?.close();
      router.back();
    }
  }

  const isCountdown = phase === 'countdown';
  const isAnalyzing = phase === 'analyzing';

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.header}>
        {phase === 'waiting_for_opponent' ? 'AWAITING CHALLENGER' :
         phase === 'both_connected' ? 'READY UP' :
         phase === 'countdown' ? 'GET READY' :
         phase === 'capturing' ? 'SNAP!' :
         phase === 'analyzing' ? 'ANALYZING...' : 'CONNECTING...'}
      </Text>

      {/* VS panels */}
      <View style={styles.panels}>
        {/* MY panel */}
        <View style={styles.panel}>
          <Text style={styles.panelLabel}>YOUR SCAN</Text>
          <View style={styles.cameraBox}>
            {(phase === 'both_connected' || phase === 'countdown' || phase === 'capturing') ? (
              <CameraView ref={cameraRef} style={styles.cameraFill} facing="back" />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>{user?.username ?? 'YOU'}</Text>
                {isAnalyzing && myDone && <Text style={styles.doneText}>✓</Text>}
                {isAnalyzing && !myDone && <ActivityIndicator color={battleTheme.accent} />}
              </View>
            )}
          </View>
          <Text style={styles.username}>{user?.username ?? ''}</Text>
          <Text style={styles.record}>{user?.wins ?? 0}W–{user?.losses ?? 0}L</Text>
        </View>

        {/* VS badge */}
        <View style={styles.vsBadge}>
          {isCountdown ? (
            <Animated.Text style={[styles.vsText, { transform: [{ scale: countAnim }], color: battleTheme.accent }]}>
              {countdownVal}
            </Animated.Text>
          ) : (
            <Text style={styles.vsText}>VS</Text>
          )}
        </View>

        {/* OPPONENT panel */}
        <View style={styles.panel}>
          <Text style={styles.panelLabel}>OPPONENT</Text>
          <View style={styles.cameraBox}>
            {opponent ? (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>{opponent.username}</Text>
                {isAnalyzing && oppDone && <Text style={styles.doneText}>✓</Text>}
                {isAnalyzing && !oppDone && <ActivityIndicator color={battleTheme.red} />}
              </View>
            ) : (
              <View style={styles.placeholder}>
                <ActivityIndicator color={battleTheme.textMuted} />
                <Text style={styles.waitingText}>Waiting...</Text>
              </View>
            )}
          </View>
          {opponent ? (
            <>
              <Text style={styles.username}>{opponent.username}</Text>
              <Text style={styles.record}>{opponent.wins}W–{opponent.losses}L</Text>
            </>
          ) : (
            <Text style={[styles.username, { color: battleTheme.textMuted }]}>—</Text>
          )}
        </View>
      </View>

      {/* CTA */}
      {phase === 'both_connected' && !ready && (
        <TouchableOpacity style={styles.readyBtn} onPress={sendReady}>
          <Text style={styles.readyBtnText}>READY</Text>
        </TouchableOpacity>
      )}
      {phase === 'both_connected' && ready && (
        <View style={styles.readyBtn}>
          <ActivityIndicator color={battleTheme.background} />
          <Text style={styles.readyBtnText}>Waiting for opponent...</Text>
        </View>
      )}
      {(phase === 'analyzing') && (
        <View style={styles.analyzingBar}>
          <Text style={styles.analyzingText}>Scores incoming — hold tight</Text>
        </View>
      )}

      {/* Disconnect / back */}
      {(phase === 'waiting_for_opponent' || phase === 'connecting') && (
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: battleTheme.background, paddingTop: 60, paddingHorizontal: spacing.lg },
  header: {
    fontSize: fontSize.sm, fontWeight: '700', color: battleTheme.accent,
    letterSpacing: 4, textAlign: 'center', marginBottom: spacing.xl,
  },
  panels: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  panel: { width: PANEL_WIDTH, alignItems: 'center' },
  panelLabel: { fontSize: fontSize.xs, color: battleTheme.textMuted, letterSpacing: 2, marginBottom: spacing.sm },
  cameraBox: {
    width: PANEL_WIDTH, height: PANEL_WIDTH * 1.4,
    borderRadius: radius.sm, overflow: 'hidden',
    backgroundColor: battleTheme.surface, borderWidth: 1, borderColor: battleTheme.border,
  },
  cameraFill: { flex: 1 },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  placeholderText: { color: battleTheme.text, fontSize: fontSize.md, fontWeight: '700' },
  waitingText: { color: battleTheme.textMuted, fontSize: fontSize.xs },
  doneText: { color: battleTheme.accent, fontSize: fontSize.xl, fontWeight: '800' },
  username: { color: battleTheme.text, fontSize: fontSize.sm, fontWeight: '700', marginTop: spacing.sm },
  record: { color: battleTheme.textMuted, fontSize: fontSize.xs },
  vsBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: battleTheme.surfaceAlt, borderWidth: 1, borderColor: battleTheme.border,
    justifyContent: 'center', alignItems: 'center', alignSelf: 'center',
  },
  vsText: { color: battleTheme.text, fontSize: fontSize.xs, fontWeight: '900', letterSpacing: 1 },
  readyBtn: {
    marginTop: spacing.xl, backgroundColor: battleTheme.accent, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm,
  },
  readyBtnText: { color: battleTheme.background, fontSize: fontSize.lg, fontWeight: '900', letterSpacing: 2 },
  analyzingBar: {
    marginTop: spacing.xl, padding: spacing.md, alignItems: 'center',
    backgroundColor: battleTheme.surface, borderRadius: radius.md,
  },
  analyzingText: { color: battleTheme.textMuted, fontSize: fontSize.sm },
  backBtn: { marginTop: spacing.xl, alignItems: 'center' },
  backText: { color: battleTheme.textMuted, fontSize: fontSize.sm },
});

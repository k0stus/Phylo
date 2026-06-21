import { create } from 'zustand';
import type { BattleResult, PublicProfile } from '../services/battleClient';

export type BattlePhase =
  | 'idle'
  | 'waiting_for_opponent'
  | 'both_connected'
  | 'countdown'
  | 'capturing'
  | 'analyzing'
  | 'revealing_results'
  | 'complete'
  | 'opponent_disconnected'
  | 'error';

interface BattleState {
  phase: BattlePhase;
  battleId: string | null;
  opponent: PublicProfile | null;
  countdownValue: number;
  myResultDone: boolean;
  opponentResultDone: boolean;
  resultA: BattleResult | null;
  resultB: BattleResult | null;
  winnerId: string | null;
  errorMessage: string | null;

  reset: () => void;
  setPhase: (phase: BattlePhase) => void;
  setBattleId: (id: string) => void;
  setOpponent: (profile: PublicProfile) => void;
  setCountdown: (n: number) => void;
  markAnalyzing: (side: 'a' | 'b') => void;
  setResults: (a: BattleResult, b: BattleResult, winner: string | null) => void;
  setError: (msg: string) => void;
}

const defaultState = {
  phase: 'idle' as BattlePhase,
  battleId: null,
  opponent: null,
  countdownValue: 3,
  myResultDone: false,
  opponentResultDone: false,
  resultA: null,
  resultB: null,
  winnerId: null,
  errorMessage: null,
};

export const useBattleStore = create<BattleState>((set) => ({
  ...defaultState,

  reset: () => set(defaultState),
  setPhase: (phase) => set({ phase }),
  setBattleId: (battleId) => set({ battleId }),
  setOpponent: (opponent) => set({ opponent }),
  setCountdown: (countdownValue) => set({ countdownValue }),
  markAnalyzing: (side) =>
    set((s) => ({
      phase: 'analyzing',
      myResultDone: side === 'a' ? true : s.myResultDone,
      opponentResultDone: side === 'b' ? true : s.opponentResultDone,
    })),
  setResults: (resultA, resultB, winnerId) =>
    set({ resultA, resultB, winnerId, phase: 'revealing_results' }),
  setError: (errorMessage) => set({ phase: 'error', errorMessage }),
}));

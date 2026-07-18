import { create } from 'zustand';
import { rooms } from '../data/rooms';

export type QualityTier = 'high' | 'balanced' | 'low';

type ExperienceState = {
  started: boolean;
  activeRoom: number;
  requestedRoom: number;
  warmingRoom: number | null;
  isTransitioning: boolean;
  transitionDirection: -1 | 0 | 1;
  transitionProgress: number;
  reducedMotion: boolean;
  soundEnabled: boolean;
  qualityTier: QualityTier;
  start: () => void;
  requestRoom: (delta: -1 | 1) => void;
  goToRoom: (index: number) => void;
  setWarmingRoom: (index: number | null) => void;
  setTransitionProgress: (progress: number) => void;
  completeTransition: () => void;
  setReducedMotion: (value: boolean) => void;
  setSoundEnabled: (value: boolean) => void;
  setQualityTier: (value: QualityTier) => void;
};

const clampRoom = (index: number) => Math.max(0, Math.min(rooms.length - 1, index));

const initialQuery = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);
const captureMode = initialQuery?.get('capture') === '1';
const captureFullMotion = initialQuery?.get('motion') === 'full';
const queryRoom = Number.parseInt(initialQuery?.get('room') ?? '1', 10);
const initialRoom = clampRoom(Number.isFinite(queryRoom) ? queryRoom - 1 : 0);

function initialQuality(): QualityTier {
  const forced = initialQuery?.get('quality');
  if (forced === 'high' || forced === 'balanced' || forced === 'low') return forced;
  if (captureMode || typeof navigator === 'undefined') return 'balanced';
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  if (memory <= 4 || cores <= 4) return 'low';
  if (memory >= 8 && cores >= 8) return 'high';
  return 'balanced';
}

export const useExperienceStore = create<ExperienceState>((set, get) => ({
  started: captureMode,
  activeRoom: initialRoom,
  requestedRoom: initialRoom,
  warmingRoom: null,
  isTransitioning: false,
  transitionDirection: 0,
  transitionProgress: 0,
  reducedMotion: captureMode && !captureFullMotion,
  soundEnabled: !captureMode,
  qualityTier: initialQuality(),
  start: () => set({ started: true }),
  requestRoom: (delta) => {
    const state = get();
    if (!state.started || state.isTransitioning) return;

    const next = clampRoom(state.activeRoom + delta);
    if (next === state.activeRoom) return;

    set({
      requestedRoom: next,
      warmingRoom: null,
      isTransitioning: true,
      transitionDirection: delta,
      transitionProgress: 0,
    });
  },
  goToRoom: (index) => {
    const state = get();
    if (!state.started || state.isTransitioning) return;

    const next = clampRoom(index);
    if (next === state.activeRoom) return;

    set({
      requestedRoom: next,
      warmingRoom: null,
      isTransitioning: true,
      transitionDirection: next > state.activeRoom ? 1 : -1,
      transitionProgress: 0,
    });
  },
  setWarmingRoom: (index) => set({ warmingRoom: index }),
  setTransitionProgress: (progress) => set({ transitionProgress: progress }),
  completeTransition: () => {
    const requestedRoom = get().requestedRoom;
    set({
      activeRoom: requestedRoom,
      warmingRoom: null,
      isTransitioning: false,
      transitionDirection: 0,
      transitionProgress: 0,
    });
  },
  setReducedMotion: (value) => set({ reducedMotion: value }),
  setSoundEnabled: (value) => set({ soundEnabled: value }),
  setQualityTier: (value) => set({ qualityTier: value }),
}));

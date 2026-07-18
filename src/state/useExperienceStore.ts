import { create } from 'zustand';
import { rooms } from '../data/rooms';

export type QualityTier = 'high' | 'balanced' | 'low';

export type PerformanceSnapshot = {
  sampledAt: number;
  windowMs: number;
  samples: number;
  averageIntervalMs: number;
  p95Ms: number;
  worstMs: number;
  longFrames: number;
  stability: 'stable' | 'watching' | 'stressed';
};

type ExperienceState = {
  started: boolean;
  activeRoom: number;
  requestedRoom: number;
  isTransitioning: boolean;
  transitionDirection: -1 | 0 | 1;
  transitionProgress: number;
  reducedMotion: boolean;
  soundEnabled: boolean;
  qualityTier: QualityTier;
  renderDistance: number;
  performance: PerformanceSnapshot | null;
  renderWarmupReady: boolean;
  start: () => void;
  requestRoom: (delta: -1 | 1) => void;
  goToRoom: (index: number) => void;
  setTransitionProgress: (progress: number, commit?: boolean) => void;
  completeTransition: () => void;
  setReducedMotion: (value: boolean) => void;
  setSoundEnabled: (value: boolean) => void;
  setQualityTier: (value: QualityTier) => void;
  setRenderDistance: (value: number) => void;
  setPerformance: (value: PerformanceSnapshot) => void;
  setRenderWarmupReady: (value: boolean) => void;
};

const clampRoom = (index: number) => Math.max(0, Math.min(rooms.length - 1, index));

const initialQuery = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);
const captureMode = initialQuery?.get('capture') === '1';
const captureFullMotion = initialQuery?.get('motion') === 'full';
const queryRoom = Number.parseInt(initialQuery?.get('room') ?? '1', 10);
const initialRoom = clampRoom(Number.isFinite(queryRoom) ? queryRoom - 1 : 0);
let frameTransitionProgress = 0;

export function getFrameTransitionProgress() {
  return frameTransitionProgress;
}

function setFrameTransitionProgress(progress: number) {
  frameTransitionProgress = Math.max(0, Math.min(1, progress));
}

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
  isTransitioning: false,
  transitionDirection: 0,
  transitionProgress: 0,
  reducedMotion: captureMode && !captureFullMotion,
  soundEnabled: !captureMode,
  qualityTier: initialQuality(),
  renderDistance: initialQuality() === 'high' ? 3 : initialQuality() === 'balanced' ? 2 : 1,
  performance: null,
  renderWarmupReady: false,
  start: () => set({ started: true }),
  requestRoom: (delta) => {
    const state = get();
    if (!state.started || state.isTransitioning) return;

    const next = clampRoom(state.activeRoom + delta);
    if (next === state.activeRoom) return;

    setFrameTransitionProgress(0);
    set({
      requestedRoom: next,
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

    setFrameTransitionProgress(0);
    set({
      requestedRoom: next,
      isTransitioning: true,
      transitionDirection: next > state.activeRoom ? 1 : -1,
      transitionProgress: 0,
    });
  },
  setTransitionProgress: (progress, commit = true) => {
    setFrameTransitionProgress(progress);
    if (commit) set({ transitionProgress: frameTransitionProgress });
  },
  completeTransition: () => {
    const requestedRoom = get().requestedRoom;
    setFrameTransitionProgress(0);
    set({
      activeRoom: requestedRoom,
      isTransitioning: false,
      transitionDirection: 0,
      transitionProgress: 0,
    });
  },
  setReducedMotion: (value) => set({ reducedMotion: value }),
  setSoundEnabled: (value) => set({ soundEnabled: value }),
  setQualityTier: (value) => set({ qualityTier: value }),
  setRenderDistance: (value) => set({ renderDistance: Math.max(1, Math.min(5, Math.trunc(value))) }),
  setPerformance: (value) => set({ performance: value }),
  setRenderWarmupReady: (value) => set({ renderWarmupReady: value }),
}));

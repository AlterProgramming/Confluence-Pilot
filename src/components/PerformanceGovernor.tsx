import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { rooms } from '../data/rooms';
import { useExperienceStore } from '../state/useExperienceStore';

const DPR_RESTORE_DELAY_MS = 360;
const IDLE_WARM_DELAY_MS = 850;
const IDLE_MOUNT_WINDOW_MS = 900;

type IdleCapableWindow = Window & {
  requestIdleCallback?: (
    callback: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void,
    options?: { timeout?: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function scheduleIdle(callback: () => void, timeout = 1_200) {
  const browser = window as IdleCapableWindow;
  if (typeof browser.requestIdleCallback === 'function') {
    const handle = browser.requestIdleCallback(() => callback(), { timeout });
    return () => browser.cancelIdleCallback?.(handle);
  }
  const handle = window.setTimeout(callback, 64);
  return () => window.clearTimeout(handle);
}

/**
 * Keeps navigation responsive while preparing likely adjacent rooms safely.
 *
 * The destination scene graph is briefly mounted during idle so React, Three.js,
 * GLTF clones, furniture and materials are instantiated before input. Explicit
 * shader compilation and offscreen rendering are intentionally avoided: those
 * operations can block the main thread or continue into a later navigation on
 * slow drivers. The visible move starts immediately and uses reduced DPR/effects.
 */
export function PerformanceGovernor() {
  const { setDpr } = useThree();
  const started = useExperienceStore((state) => state.started);
  const activeRoom = useExperienceStore((state) => state.activeRoom);
  const warmingRoom = useExperienceStore((state) => state.warmingRoom);
  const isTransitioning = useExperienceStore((state) => state.isTransitioning);
  const qualityTier = useExperienceStore((state) => state.qualityTier);
  const setWarmingRoom = useExperienceStore((state) => state.setWarmingRoom);
  const warmedRooms = useRef(new Set<number>());
  const [warmCycle, setWarmCycle] = useState(0);

  useEffect(() => {
    const deviceDpr = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio, 1.2);
    const tierDpr = qualityTier === 'high'
      ? deviceDpr
      : qualityTier === 'balanced'
        ? Math.min(deviceDpr, 1)
        : Math.min(deviceDpr, 0.72);
    const targetDpr = Math.max(0.55, isTransitioning ? tierDpr * 0.7 : tierDpr);

    if (isTransitioning) {
      setDpr(targetDpr);
      return;
    }

    const restore = window.setTimeout(() => setDpr(targetDpr), DPR_RESTORE_DELAY_MS);
    return () => window.clearTimeout(restore);
  }, [isTransitioning, qualityTier, setDpr]);

  useEffect(() => {
    warmedRooms.current.add(activeRoom);
  }, [activeRoom]);

  useEffect(() => {
    if (!started || isTransitioning || warmingRoom !== null) return;

    const candidates = [activeRoom + 1, activeRoom - 1]
      .filter((index) => index >= 0 && index < rooms.length)
      .filter((index) => !warmedRooms.current.has(index));
    const candidate = candidates[0];
    if (candidate === undefined) return;

    let cancelIdle: () => void = () => undefined;
    const timer = window.setTimeout(() => {
      cancelIdle = scheduleIdle(() => {
        const state = useExperienceStore.getState();
        if (
          state.started
          && !state.isTransitioning
          && state.activeRoom === activeRoom
          && state.warmingRoom === null
        ) {
          setWarmingRoom(candidate);
        }
      });
    }, IDLE_WARM_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      cancelIdle();
    };
  }, [activeRoom, isTransitioning, setWarmingRoom, started, warmCycle, warmingRoom]);

  useEffect(() => {
    if (warmingRoom === null || isTransitioning) return;
    const roomIndex = warmingRoom;
    const release = window.setTimeout(() => {
      const state = useExperienceStore.getState();
      if (!state.isTransitioning && state.warmingRoom === roomIndex) {
        warmedRooms.current.add(roomIndex);
        setWarmingRoom(null);
        setWarmCycle((value) => value + 1);
      }
    }, IDLE_MOUNT_WINDOW_MS);
    return () => window.clearTimeout(release);
  }, [isTransitioning, setWarmingRoom, warmingRoom]);

  return null;
}

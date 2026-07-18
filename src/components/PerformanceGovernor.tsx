import { useEffect, useMemo, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Material, Object3D, PerspectiveCamera, Texture } from 'three';
import { rooms } from '../data/rooms';
import { useExperienceStore } from '../state/useExperienceStore';

const DPR_RESTORE_DELAY_MS = 360;
const IDLE_WARM_DELAY_MS = 850;
const WARM_TIMEOUT_MS = 5_000;

function nextPaint() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function waitForIdle(timeout = 1_000) {
  return new Promise<void>((resolve) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => resolve(), { timeout });
      return;
    }
    window.setTimeout(resolve, 48);
  });
}

function scheduleIdle(callback: () => void, timeout = 1_200) {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(callback, 64);
  return () => window.clearTimeout(handle);
}

function collectTextures(root: Object3D) {
  const textures = new Set<Texture>();
  root.traverse((node) => {
    const renderable = node as Object3D & { material?: Material | Material[] };
    const materials = Array.isArray(renderable.material)
      ? renderable.material
      : renderable.material
        ? [renderable.material]
        : [];

    for (const material of materials) {
      for (const value of Object.values(material as unknown as Record<string, unknown>)) {
        if (value && typeof value === 'object' && (value as Texture).isTexture) {
          textures.add(value as Texture);
        }
      }
    }
  });
  return [...textures];
}

/**
 * Keeps visible navigation free of compilation and upload work.
 *
 * After a room settles, likely adjacent destinations are briefly mounted in
 * their complete scene configuration. Their shaders are compiled asynchronously
 * and textures are initialized one at a time during browser idle slices. The
 * camera move itself starts immediately when the user navigates; no compile or
 * offscreen render is ever performed inside the input path.
 */
export function PerformanceGovernor() {
  const { gl, scene, camera, setDpr } = useThree();
  const started = useExperienceStore((state) => state.started);
  const activeRoom = useExperienceStore((state) => state.activeRoom);
  const warmingRoom = useExperienceStore((state) => state.warmingRoom);
  const isTransitioning = useExperienceStore((state) => state.isTransitioning);
  const qualityTier = useExperienceStore((state) => state.qualityTier);
  const setWarmingRoom = useExperienceStore((state) => state.setWarmingRoom);
  const { active: assetsLoading } = useProgress();
  const warmedRooms = useRef(new Set<number>());
  const generation = useRef(0);
  const [warmCycle, setWarmCycle] = useState(0);
  const warmCamera = useMemo(() => new PerspectiveCamera(), []);

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

    let cancelIdle = () => undefined;
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
    if (warmingRoom === null || isTransitioning || assetsLoading) return;

    const roomIndex = warmingRoom;
    const run = ++generation.current;
    let cancelled = false;

    const abandon = window.setTimeout(() => {
      const state = useExperienceStore.getState();
      if (state.warmingRoom === roomIndex) {
        setWarmingRoom(null);
        setWarmCycle((value) => value + 1);
      }
    }, WARM_TIMEOUT_MS);

    const warm = async () => {
      await nextPaint();
      await waitForIdle();
      if (cancelled || generation.current !== run) return;

      const state = useExperienceStore.getState();
      const destination = rooms[roomIndex];
      if (!destination || state.isTransitioning || state.warmingRoom !== roomIndex) return;

      warmCamera.copy(camera as PerspectiveCamera);
      warmCamera.position.set(...destination.camera);
      warmCamera.lookAt(...destination.target);
      warmCamera.updateProjectionMatrix();
      warmCamera.updateMatrixWorld(true);
      scene.updateMatrixWorld(true);

      try {
        await gl.compileAsync(scene, warmCamera);
      } catch (error) {
        console.warn('Idle shader warm-up was skipped by this browser or driver.', error);
      }

      if (cancelled || generation.current !== run) return;
      const roomRoot = scene.getObjectByName(`confluence-room-${destination.id}`);
      if (roomRoot) {
        for (const texture of collectTextures(roomRoot)) {
          await waitForIdle(750);
          if (cancelled || generation.current !== run) return;
          try {
            gl.initTexture(texture);
          } catch (error) {
            console.warn('Idle texture initialization was skipped.', error);
          }
        }
      }

      if (cancelled || generation.current !== run) return;
      warmedRooms.current.add(roomIndex);
      window.clearTimeout(abandon);

      const finalState = useExperienceStore.getState();
      if (!finalState.isTransitioning && finalState.warmingRoom === roomIndex) {
        setWarmingRoom(null);
        setWarmCycle((value) => value + 1);
      }
    };

    void warm();
    return () => {
      cancelled = true;
      generation.current += 1;
      window.clearTimeout(abandon);
    };
  }, [assetsLoading, camera, gl, isTransitioning, scene, setWarmingRoom, warmCamera, warmingRoom]);

  return null;
}

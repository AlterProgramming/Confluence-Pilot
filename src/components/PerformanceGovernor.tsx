import { useEffect, useMemo, useRef } from 'react';
import { useProgress } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { PerspectiveCamera, WebGLRenderTarget } from 'three';
import { rooms } from '../data/rooms';
import { useExperienceStore } from '../state/useExperienceStore';

const PREPARATION_BUDGET_MS = 620;
const DPR_RESTORE_DELAY_MS = 360;

function nextPaint() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/**
 * Moves expensive first-use work out of the visible camera move.
 *
 * A requested destination is mounted in its real active configuration while the
 * current camera remains still. Once its assets have loaded, compileAsync warms
 * its material/light shader variants and a tiny offscreen render forces texture
 * and geometry uploads. Navigation begins immediately after warming, with a
 * short deadline so input never feels stuck on unusually slow hardware.
 */
export function PerformanceGovernor() {
  const { gl, scene, camera, setDpr } = useThree();
  const activeRoom = useExperienceStore((state) => state.activeRoom);
  const requestedRoom = useExperienceStore((state) => state.requestedRoom);
  const isPreparing = useExperienceStore((state) => state.isPreparing);
  const isTransitioning = useExperienceStore((state) => state.isTransitioning);
  const qualityTier = useExperienceStore((state) => state.qualityTier);
  const beginTransition = useExperienceStore((state) => state.beginTransition);
  const { active: assetsLoading } = useProgress();
  const generation = useRef(0);

  const warmCamera = useMemo(() => new PerspectiveCamera(), []);
  const warmTarget = useMemo(() => {
    const target = new WebGLRenderTarget(96, 54, { depthBuffer: true, stencilBuffer: false });
    target.texture.generateMipmaps = false;
    return target;
  }, []);

  useEffect(() => () => warmTarget.dispose(), [warmTarget]);

  useEffect(() => {
    const busy = isPreparing || isTransitioning;
    const deviceDpr = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio, 1.2);
    const tierDpr = qualityTier === 'high'
      ? deviceDpr
      : qualityTier === 'balanced'
        ? Math.min(deviceDpr, 1)
        : Math.min(deviceDpr, 0.72);
    const targetDpr = Math.max(0.55, busy ? tierDpr * 0.7 : tierDpr);

    if (busy) {
      setDpr(targetDpr);
      return;
    }

    const restore = window.setTimeout(() => setDpr(targetDpr), DPR_RESTORE_DELAY_MS);
    return () => window.clearTimeout(restore);
  }, [isPreparing, isTransitioning, qualityTier, setDpr]);

  useEffect(() => {
    if (!isPreparing) return;
    const roomAtRequest = requestedRoom;
    const timeout = window.setTimeout(() => {
      const state = useExperienceStore.getState();
      if (state.isPreparing && state.requestedRoom === roomAtRequest) beginTransition();
    }, PREPARATION_BUDGET_MS);
    return () => window.clearTimeout(timeout);
  }, [beginTransition, isPreparing, requestedRoom]);

  useEffect(() => {
    if (!isPreparing || assetsLoading) return;

    const run = ++generation.current;
    let cancelled = false;

    const warm = async () => {
      // Give React two paints to commit the destination's active furniture,
      // lighting, hero and screen before asking Three.js to compile the scene.
      await nextPaint();
      if (cancelled || generation.current !== run) return;

      const state = useExperienceStore.getState();
      if (!state.isPreparing || state.requestedRoom !== requestedRoom) return;
      const destination = rooms[requestedRoom];
      if (!destination) {
        beginTransition();
        return;
      }

      warmCamera.copy(camera as PerspectiveCamera);
      warmCamera.position.set(...destination.camera);
      warmCamera.lookAt(...destination.target);
      warmCamera.updateProjectionMatrix();
      warmCamera.updateMatrixWorld(true);
      scene.updateMatrixWorld(true);

      try {
        await gl.compileAsync(scene, warmCamera);
      } catch (error) {
        // compileAsync is an optimization. Navigation must still work if a
        // browser/driver rejects parallel compilation.
        console.warn('Destination shader warm-up fell back to normal rendering.', error);
      }

      if (cancelled || generation.current !== run) return;
      const latest = useExperienceStore.getState();
      if (!latest.isPreparing || latest.requestedRoom !== requestedRoom) return;

      const previousTarget = gl.getRenderTarget();
      const previousXr = gl.xr.enabled;
      const previousShadowUpdates = gl.shadowMap.autoUpdate;
      try {
        gl.xr.enabled = false;
        gl.shadowMap.autoUpdate = false;
        gl.setRenderTarget(warmTarget);
        gl.clear();
        gl.render(scene, warmCamera);
      } catch (error) {
        console.warn('Destination upload warm-up fell back to visible rendering.', error);
      } finally {
        gl.setRenderTarget(previousTarget);
        gl.xr.enabled = previousXr;
        gl.shadowMap.autoUpdate = previousShadowUpdates;
      }

      const finalState = useExperienceStore.getState();
      if (!cancelled && finalState.isPreparing && finalState.requestedRoom === requestedRoom) {
        beginTransition();
      }
    };

    void warm();
    return () => {
      cancelled = true;
      generation.current += 1;
    };
  }, [activeRoom, assetsLoading, beginTransition, camera, gl, isPreparing, requestedRoom, scene, warmCamera, warmTarget]);

  return null;
}

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from 'three';
import gsap from 'gsap';
import { rooms } from '../data/rooms';
import { useExperienceStore } from '../state/useExperienceStore';

// Keep navigation tied to elapsed time even when a low-power GPU drops frames.
gsap.ticker.lagSmoothing(0);

type CameraProxy = {
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  roll: number;
  fov: number;
};

type CaptureOffset = {
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetY: number;
  targetZ: number;
};

const captureParams = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);
const captureMode = captureParams?.get('capture') === '1';
const captureView = captureMode ? captureParams?.get('view') : null;
const NO_CAPTURE_OFFSET: CaptureOffset = { x: 0, y: 0, z: 0, targetX: 0, targetY: 0, targetZ: 0 };

/** Secondary evidence views deliberately frame each room's program zone rather
 * than applying the same small lateral nudge to every composition. */
const secondaryOffsets: Record<string, CaptureOffset> = {
  '01': { x: 2.35, y: 0.2, z: 0.55, targetX: 0.45, targetY: 0.08, targetZ: 0 },
  '02': { x: -3.4, y: -0.05, z: -1.1, targetX: -3.7, targetY: -0.25, targetZ: 0.8 },
  '03': { x: 3.6, y: -0.12, z: -1.15, targetX: 4.1, targetY: -0.2, targetZ: 0.5 },
  '04': { x: 3.25, y: -0.1, z: -1.35, targetX: 4.2, targetY: -0.1, targetZ: 0.55 },
  '05': { x: 3.35, y: -0.12, z: -1.2, targetX: 4.45, targetY: -0.18, targetZ: 0.4 },
  '06': { x: -3.45, y: -0.18, z: -1.3, targetX: -4.35, targetY: -0.25, targetZ: 0.55 },
  '07': { x: 3.5, y: -0.15, z: -1.15, targetX: 3.75, targetY: -0.2, targetZ: 0.6 },
  '08': { x: -4.0, y: -0.22, z: -1.65, targetX: -3.6, targetY: -0.35, targetZ: 1.2 },
  '09': { x: 3.45, y: -0.08, z: -1.3, targetX: 4.45, targetY: -0.05, targetZ: 0.35 },
  '10': { x: -3.55, y: -0.14, z: -1.15, targetX: -4.6, targetY: -0.2, targetZ: 0.45 },
  '11': { x: 3.55, y: -0.12, z: -1.25, targetX: 4.15, targetY: -0.18, targetZ: 0.45 },
  '12': { x: -3.8, y: -0.18, z: -1.35, targetX: -4.25, targetY: -0.25, targetZ: 0.6 },
};

function getCaptureOffset(roomId: string): CaptureOffset {
  if (captureView !== 'secondary') return NO_CAPTURE_OFFSET;
  return secondaryOffsets[roomId] ?? secondaryOffsets['01'];
}

export function CameraDirector() {
  const { camera, pointer } = useThree();
  const perspectiveCamera = camera as PerspectiveCamera;
  const activeRoom = useExperienceStore((state) => state.activeRoom);
  const requestedRoom = useExperienceStore((state) => state.requestedRoom);
  const isTransitioning = useExperienceStore((state) => state.isTransitioning);
  const reducedMotion = useExperienceStore((state) => state.reducedMotion);
  const setTransitionProgress = useExperienceStore((state) => state.setTransitionProgress);
  const completeTransition = useExperienceStore((state) => state.completeTransition);
  const captureOffset = getCaptureOffset(rooms[activeRoom]?.id ?? '');

  const initial = rooms[0];
  const proxy = useMemo<CameraProxy>(
    () => ({
      x: initial.camera[0],
      y: initial.camera[1],
      z: initial.camera[2],
      targetX: initial.target[0],
      targetY: initial.target[1],
      targetZ: initial.target[2],
      roll: 0,
      fov: 43,
    }),
    [initial],
  );

  const progressProxy = useRef({ value: 0 });
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const previousFov = useRef(proxy.fov);

  useEffect(() => {
    const room = rooms[activeRoom];
    if (isTransitioning) return;

    proxy.x = room.camera[0];
    proxy.y = room.camera[1];
    proxy.z = room.camera[2];
    proxy.targetX = room.target[0];
    proxy.targetY = room.target[1];
    proxy.targetZ = room.target[2];
    proxy.roll = 0;
    proxy.fov = 43;
  }, [activeRoom, isTransitioning, proxy]);

  useEffect(() => {
    if (!isTransitioning) return;

    timelineRef.current?.kill();

    const destination = rooms[requestedRoom];
    const distance = Math.max(1, Math.abs(requestedRoom - activeRoom));
    const direction = requestedRoom > activeRoom ? 1 : -1;
    const duration = reducedMotion ? 0.12 : 1.42 + Math.min(1.05, (distance - 1) * 0.16);
    const sideExcursion = direction * Math.min(1.7, 0.95 + distance * 0.12);
    progressProxy.current.value = 0;

    const timeline = gsap.timeline({
      defaults: { ease: 'power3.inOut' },
      onUpdate: () => setTransitionProgress(progressProxy.current.value),
      onComplete: completeTransition,
    });

    timeline.to(
      proxy,
      {
        y: destination.camera[1],
        targetY: destination.target[1],
        targetX: destination.target[0],
        targetZ: destination.target[2],
        duration,
      },
      0,
    );

    if (reducedMotion) {
      timeline.to(
        proxy,
        {
          x: destination.camera[0],
          z: destination.camera[2],
          roll: 0,
          fov: 43,
          duration,
        },
        0,
      );
    } else {
      timeline.to(proxy, { x: sideExcursion, duration: duration * 0.43, ease: 'power2.inOut' }, 0);
      timeline.to(
        proxy,
        { x: destination.camera[0], duration: duration * 0.57, ease: 'power2.out' },
        duration * 0.43,
      );
      timeline.to(proxy, { z: 5.9, fov: 51.5, roll: -direction * 0.038, duration: duration * 0.48, ease: 'power2.in' }, 0);
      timeline.to(
        proxy,
        { z: destination.camera[2], fov: 43, roll: 0, duration: duration * 0.52, ease: 'power2.out' },
        duration * 0.48,
      );
    }

    timeline.to(progressProxy.current, { value: 1, duration, ease: 'none' }, 0);
    timelineRef.current = timeline;

    return () => {
      timeline.kill();
    };
  }, [activeRoom, completeTransition, isTransitioning, proxy, reducedMotion, requestedRoom, setTransitionProgress]);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const ambientScale = isTransitioning || reducedMotion ? 0 : 1;
    const driftX = (pointer.x * 0.24 + Math.sin(time * 0.42) * 0.055) * ambientScale;
    const driftY = (pointer.y * 0.13 + Math.cos(time * 0.36) * 0.045) * ambientScale;
    const driftZ = Math.sin(time * 0.28) * 0.045 * ambientScale;

    perspectiveCamera.position.set(
      proxy.x + captureOffset.x + driftX,
      proxy.y + captureOffset.y + driftY,
      proxy.z + captureOffset.z + driftZ,
    );
    perspectiveCamera.lookAt(
      proxy.targetX + captureOffset.targetX + driftX * 0.2,
      proxy.targetY + captureOffset.targetY + driftY * 0.16,
      proxy.targetZ + captureOffset.targetZ,
    );
    perspectiveCamera.rotateZ(proxy.roll);

    if (Math.abs(previousFov.current - proxy.fov) > 0.001) {
      perspectiveCamera.fov = proxy.fov;
      perspectiveCamera.updateProjectionMatrix();
      previousFov.current = proxy.fov;
    }
  });

  return null;
}

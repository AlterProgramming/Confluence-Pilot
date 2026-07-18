import { useEffect } from 'react';
import { useProgress } from '@react-three/drei';
import { rooms } from '../data/rooms';
import { useExperienceStore } from '../state/useExperienceStore';
import type { PerformanceSnapshot } from '../state/useExperienceStore';

type ValidationSnapshot = {
  version: 1;
  ready: boolean;
  started: boolean;
  activeRoomIndex: number;
  activeRoomId: string;
  requestedRoomIndex: number;
  requestedRoomId: string;
  isTransitioning: boolean;
  transitionProgress: number;
  assetsLoading: boolean;
  assetProgress: number;
  qualityTier: string;
  renderDistance: number;
  performance: unknown;
  goToRoomNumber: (roomNumber: number) => void;
};

type RenderSnapshot = {
  version: 1;
  ready: boolean;
  started: boolean;
  assetsLoading: boolean;
  assetProgress: number;
  renderWarmupReady: boolean;
  qualityTier: string;
  renderDistance: number;
  performance: unknown;
};

declare global {
  interface Window {
    __CONFLUENCE_VALIDATION__?: ValidationSnapshot;
    __CONFLUENCE_RENDER_READY__?: RenderSnapshot;
    __CONFLUENCE_PERFORMANCE__?: PerformanceSnapshot;
  }
}

const params = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);
const validationMode = params?.get('validate') === '1';
const renderMode = params?.get('render') === '1';

function effectiveAssetState(assetsLoading: boolean, assetProgress: number) {
  if (assetProgress >= 100) return { assetsLoading: false, assetProgress: 100 };
  return { assetsLoading, assetProgress };
}

export function ValidationBridge() {
  const started = useExperienceStore((state) => state.started);
  const activeRoom = useExperienceStore((state) => state.activeRoom);
  const requestedRoom = useExperienceStore((state) => state.requestedRoom);
  const isTransitioning = useExperienceStore((state) => state.isTransitioning);
  const transitionProgress = useExperienceStore((state) => state.transitionProgress);
  const qualityTier = useExperienceStore((state) => state.qualityTier);
  const renderDistance = useExperienceStore((state) => state.renderDistance);
  const performance = useExperienceStore((state) => state.performance);
  const renderWarmupReady = useExperienceStore((state) => state.renderWarmupReady);
  const goToRoom = useExperienceStore((state) => state.goToRoom);
  const { active: assetsLoading, progress: assetProgress } = useProgress();

  useEffect(() => {
    if (!validationMode && !renderMode) return;

    const activeDefinition = rooms[activeRoom];
    const requestedDefinition = rooms[requestedRoom];
    const effectiveAssets = effectiveAssetState(assetsLoading, assetProgress);
    const ready = started && !isTransitioning;
    if (validationMode) {
      const snapshot: ValidationSnapshot = {
        version: 1,
        ready,
        started,
        activeRoomIndex: activeRoom,
        activeRoomId: activeDefinition?.id ?? '',
        requestedRoomIndex: requestedRoom,
        requestedRoomId: requestedDefinition?.id ?? '',
        isTransitioning,
        transitionProgress,
        assetsLoading: effectiveAssets.assetsLoading,
        assetProgress: effectiveAssets.assetProgress,
        qualityTier,
        renderDistance,
        performance: performance ?? window.__CONFLUENCE_PERFORMANCE__ ?? null,
        goToRoomNumber: (roomNumber: number) => {
          if (!Number.isFinite(roomNumber)) return;
          goToRoom(Math.max(0, Math.min(rooms.length - 1, Math.trunc(roomNumber) - 1)));
        },
      };

      window.__CONFLUENCE_VALIDATION__ = snapshot;
      document.documentElement.dataset.validationReady = String(ready);
      document.documentElement.dataset.activeRoom = snapshot.activeRoomId;
      window.dispatchEvent(new CustomEvent('confluence:validation-state', { detail: snapshot }));
    }

    if (renderMode) {
      const renderSnapshot: RenderSnapshot = {
        version: 1,
        ready: started && !isTransitioning && renderWarmupReady,
        started,
        assetsLoading: effectiveAssets.assetsLoading,
        assetProgress: effectiveAssets.assetProgress,
        renderWarmupReady,
        qualityTier,
        renderDistance,
        performance: performance ?? window.__CONFLUENCE_PERFORMANCE__ ?? null,
      };
      window.__CONFLUENCE_RENDER_READY__ = renderSnapshot;
      document.documentElement.dataset.renderReady = String(renderSnapshot.ready);
      window.dispatchEvent(new CustomEvent('confluence:render-state', { detail: renderSnapshot }));
    }
  }, [
    activeRoom,
    assetProgress,
    assetsLoading,
    goToRoom,
    isTransitioning,
    performance,
    qualityTier,
    renderDistance,
    renderWarmupReady,
    requestedRoom,
    started,
    transitionProgress,
  ]);

  useEffect(
    () => () => {
      if (!validationMode && !renderMode) return;
      delete window.__CONFLUENCE_VALIDATION__;
      delete window.__CONFLUENCE_RENDER_READY__;
      delete document.documentElement.dataset.validationReady;
      delete document.documentElement.dataset.renderReady;
      delete document.documentElement.dataset.activeRoom;
    },
    [],
  );

  return null;
}

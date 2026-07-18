import { useEffect } from 'react';
import { useProgress } from '@react-three/drei';
import { rooms } from '../data/rooms';
import { useExperienceStore } from '../state/useExperienceStore';

type ValidationSnapshot = {
  version: 1;
  ready: boolean;
  started: boolean;
  activeRoomIndex: number;
  activeRoomId: string;
  requestedRoomIndex: number;
  requestedRoomId: string;
  isPreparing: boolean;
  isTransitioning: boolean;
  transitionProgress: number;
  assetsLoading: boolean;
  assetProgress: number;
  qualityTier: string;
  goToRoomNumber: (roomNumber: number) => void;
};

declare global {
  interface Window {
    __CONFLUENCE_VALIDATION__?: ValidationSnapshot;
  }
}

const validationMode =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('validate') === '1';

export function ValidationBridge() {
  const started = useExperienceStore((state) => state.started);
  const activeRoom = useExperienceStore((state) => state.activeRoom);
  const requestedRoom = useExperienceStore((state) => state.requestedRoom);
  const isPreparing = useExperienceStore((state) => state.isPreparing);
  const isTransitioning = useExperienceStore((state) => state.isTransitioning);
  const transitionProgress = useExperienceStore((state) => state.transitionProgress);
  const qualityTier = useExperienceStore((state) => state.qualityTier);
  const goToRoom = useExperienceStore((state) => state.goToRoom);
  const { active: assetsLoading, progress: assetProgress } = useProgress();

  useEffect(() => {
    if (!validationMode) return;

    const activeDefinition = rooms[activeRoom];
    const requestedDefinition = rooms[requestedRoom];
    const ready = started && !isPreparing && !isTransitioning && !assetsLoading;
    const snapshot: ValidationSnapshot = {
      version: 1,
      ready,
      started,
      activeRoomIndex: activeRoom,
      activeRoomId: activeDefinition?.id ?? '',
      requestedRoomIndex: requestedRoom,
      requestedRoomId: requestedDefinition?.id ?? '',
      isPreparing,
      isTransitioning,
      transitionProgress,
      assetsLoading,
      assetProgress,
      qualityTier,
      goToRoomNumber: (roomNumber: number) => {
        if (!Number.isFinite(roomNumber)) return;
        goToRoom(Math.max(0, Math.min(rooms.length - 1, Math.trunc(roomNumber) - 1)));
      },
    };

    window.__CONFLUENCE_VALIDATION__ = snapshot;
    document.documentElement.dataset.validationReady = String(ready);
    document.documentElement.dataset.activeRoom = snapshot.activeRoomId;
    window.dispatchEvent(new CustomEvent('confluence:validation-state', { detail: snapshot }));
  }, [
    activeRoom,
    assetProgress,
    assetsLoading,
    goToRoom,
    isPreparing,
    isTransitioning,
    qualityTier,
    requestedRoom,
    started,
    transitionProgress,
  ]);

  useEffect(
    () => () => {
      if (!validationMode) return;
      delete window.__CONFLUENCE_VALIDATION__;
      delete document.documentElement.dataset.validationReady;
      delete document.documentElement.dataset.activeRoom;
    },
    [],
  );

  return null;
}

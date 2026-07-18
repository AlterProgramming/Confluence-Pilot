import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useExperienceStore } from '../state/useExperienceStore';

const DPR_RESTORE_DELAY_MS = 360;

/**
 * Reduces fill-rate only while the camera is moving, then restores the selected
 * quality tier after arrival. Asset LOD is handled separately by RoomAsset so
 * this component never performs compilation, uploads, or hidden renders.
 */
export function PerformanceGovernor() {
  const { setDpr } = useThree();
  const isTransitioning = useExperienceStore((state) => state.isTransitioning);
  const qualityTier = useExperienceStore((state) => state.qualityTier);

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

  return null;
}

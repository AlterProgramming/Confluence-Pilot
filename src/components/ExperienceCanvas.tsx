import { Suspense } from 'react';
import { AdaptiveDpr, PerformanceMonitor, Preload } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useExperienceStore } from '../state/useExperienceStore';
import { Atmosphere } from './Atmosphere';
import { CameraDirector } from './CameraDirector';
import { GlobalParticles } from './GlobalParticles';
import { PostEffects } from './PostEffects';
import { RoomStack } from './RoomStack';
import { TransitionShaft } from './TransitionShaft';

function AdaptiveQuality({ children }: { children: React.ReactNode }) {
  const setQualityTier = useExperienceStore((state) => state.setQualityTier);

  return (
    <PerformanceMonitor
      flipflops={3}
      bounds={(refreshRate) => [Math.min(34, refreshRate * 0.56), Math.min(54, refreshRate * 0.82)]}
      onIncline={() => setQualityTier('high')}
      onDecline={() => setQualityTier('balanced')}
      onFallback={() => setQualityTier('low')}
    >
      {children}
    </PerformanceMonitor>
  );
}

export function ExperienceCanvas() {
  return (
    <Canvas
      dpr={[0.85, 1.25]}
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
      camera={{ fov: 43, near: 0.1, far: 280, position: [0, 1.8, 12.4] }}
      performance={{ min: 0.5, debounce: 220 }}
    >
      <AdaptiveQuality>
        <AdaptiveDpr pixelated />
        <Atmosphere />
        <Suspense fallback={null}>
          <RoomStack />
        </Suspense>
        <TransitionShaft />
        <GlobalParticles />
        <CameraDirector />
        <PostEffects />
        <Preload all />
      </AdaptiveQuality>
    </Canvas>
  );
}

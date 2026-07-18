import { Suspense } from 'react';
import { Environment, Lightformer, PerformanceMonitor, Preload } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping } from 'three';
import { useExperienceStore } from '../state/useExperienceStore';
import { Atmosphere } from './Atmosphere';

/** Procedural studio environment for image-based lighting (reflections + realistic
 *  material response). Self-contained — no external HDRI fetch. */
function StudioEnvironment() {
  return (
    <Environment resolution={256} frames={1} environmentIntensity={0.85}>
      <Lightformer form="rect" intensity={3.6} color="#fff2e0" position={[0, 6, -9]} scale={[14, 9, 1]} />
      <Lightformer form="rect" intensity={2.2} color="#cfe0ff" position={[-8, 4, 3]} rotation={[0, Math.PI / 3, 0]} scale={[8, 8, 1]} />
      <Lightformer form="rect" intensity={2.2} color="#ffd9c2" position={[8, 4, 3]} rotation={[0, -Math.PI / 3, 0]} scale={[8, 8, 1]} />
      <Lightformer form="ring" intensity={3.0} color="#ffffff" position={[0, 10, 1]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 10, 1]} />
      {/* soft overhead fill so ceilings/corners don't fall off */}
      <Lightformer form="rect" intensity={1.3} color="#eef2ff" position={[0, 9, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[16, 12, 1]} />
    </Environment>
  );
}
import { CameraDirector } from './CameraDirector';
import { GlobalParticles } from './GlobalParticles';
import { PerformanceGovernor } from './PerformanceGovernor';
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
      dpr={[0.55, 1.2]}
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
      camera={{ fov: 43, near: 0.1, far: 280, position: [0, 1.8, 12.4] }}
      performance={{ min: 0.35, debounce: 200 }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.25;
      }}
    >
      <AdaptiveQuality>
        <Atmosphere />
        <Suspense fallback={null}>
          <StudioEnvironment />
        </Suspense>
        <Suspense fallback={null}>
          <RoomStack />
        </Suspense>
        <TransitionShaft />
        <GlobalParticles />
        <CameraDirector />
        <PerformanceGovernor />
        <PostEffects />
        <Preload all />
      </AdaptiveQuality>
    </Canvas>
  );
}

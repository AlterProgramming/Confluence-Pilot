import { useMemo } from 'react';
import { Vector2 } from 'three';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useExperienceStore } from '../state/useExperienceStore';

export function PostEffects() {
  const preparing = useExperienceStore((state) => state.isPreparing);
  const transitioning = useExperienceStore((state) => state.isTransitioning);
  const reducedMotion = useExperienceStore((state) => state.reducedMotion);
  const qualityTier = useExperienceStore((state) => state.qualityTier);
  const busy = preparing || transitioning;
  const travel = transitioning && !reducedMotion;
  const quality = qualityTier === 'high' ? 1 : qualityTier === 'balanced' ? 0.72 : 0.38;
  const offset = useMemo(() => new Vector2(0.00016, 0.00008), []);

  // During a move the scene is already doing its most expensive work. Keep the
  // cinematic wash, but lower fill-rate and remove full-screen effects that are
  // difficult to perceive while the camera is travelling.
  const composerScale = busy ? (qualityTier === 'low' ? 0.58 : 0.7) : 1;
  const bloomScale = busy ? 0.2 : qualityTier === 'high' ? 0.45 : 0.32;
  const bloom = (
    <Bloom
      intensity={(busy ? 0.22 : 0.34) * quality}
      luminanceThreshold={busy ? 0.76 : 0.69}
      luminanceSmoothing={0.24}
      mipmapBlur
      resolutionScale={bloomScale}
    />
  );
  const vignette = <Vignette eskil={false} offset={0.28} darkness={busy ? 0.3 : 0.26} />;

  if (qualityTier === 'low' || busy) {
    return (
      <EffectComposer multisampling={0} enableNormalPass={false} resolutionScale={composerScale}>
        {bloom}
        {vignette}
      </EffectComposer>
    );
  }

  const aberration = (
    <ChromaticAberration
      offset={offset}
      radialModulation
      modulationOffset={travel ? 0.18 : 0.12}
      blendFunction={BlendFunction.NORMAL}
    />
  );

  if (qualityTier === 'balanced') {
    return (
      <EffectComposer multisampling={0} enableNormalPass={false}>
        {bloom}
        {aberration}
        {vignette}
      </EffectComposer>
    );
  }

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {bloom}
      {aberration}
      <Noise opacity={0.025} blendFunction={BlendFunction.SOFT_LIGHT} />
      {vignette}
    </EffectComposer>
  );
}

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
  const transitioning = useExperienceStore((state) => state.isTransitioning);
  const reducedMotion = useExperienceStore((state) => state.reducedMotion);
  const qualityTier = useExperienceStore((state) => state.qualityTier);
  const travel = transitioning && !reducedMotion ? 1 : 0;
  const quality = qualityTier === 'high' ? 1 : qualityTier === 'balanced' ? 0.72 : 0.38;
  const offset = useMemo(() => new Vector2(), []);
  offset.set(
    0.00016 + travel * 0.00175 * quality,
    0.00008 + travel * 0.00072 * quality,
  );

  const bloom = (
    <Bloom
      intensity={(0.34 + travel * 0.68) * quality}
      luminanceThreshold={0.69 - travel * 0.11}
      luminanceSmoothing={0.24}
      mipmapBlur
      resolutionScale={qualityTier === 'high' ? 0.45 : 0.32}
    />
  );
  const vignette = <Vignette eskil={false} offset={0.28} darkness={0.26 + travel * 0.08} />;

  if (qualityTier === 'low') {
    return (
      <EffectComposer multisampling={0} enableNormalPass={false} resolutionScale={0.72}>
        {bloom}
        {vignette}
      </EffectComposer>
    );
  }

  const aberration = (
    <ChromaticAberration
      offset={offset}
      radialModulation
      modulationOffset={0.12 + travel * 0.36}
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
      <Noise opacity={0.025 + travel * 0.018} blendFunction={BlendFunction.SOFT_LIGHT} />
      {vignette}
    </EffectComposer>
  );
}

import { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { LinearSRGBColorSpace, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import type { Side } from 'three';
import { materials, type MaterialName } from './catalog';

/**
 * Loads a CC0 PBR material (albedo/normal/roughness) and returns a memoized
 * MeshStandardMaterial with correct color spaces and tiling. Reflections come
 * from the global drei <Environment> (IBL). Reuse for walls, floors, props.
 */
export function usePbr(
  name: MaterialName,
  repeat?: [number, number],
  overrides?: Partial<{ color: string; roughness: number; metalness: number; side: Side }>,
) {
  const m = materials[name];
  const maps = useTexture([m.albedo, m.normal, m.roughness]) as Texture[];

  return useMemo(() => {
    const [albedo, normal, roughness] = maps as [Texture, Texture, Texture];
    const rep = repeat ?? m.repeat;
    for (const t of maps) {
      t.wrapS = RepeatWrapping;
      t.wrapT = RepeatWrapping;
      t.repeat.set(rep[0], rep[1]);
      t.colorSpace = LinearSRGBColorSpace;
      t.needsUpdate = true;
    }
    albedo.colorSpace = SRGBColorSpace;

    return new MeshStandardMaterial({
      map: albedo,
      normalMap: normal,
      roughnessMap: roughness,
      roughness: (m.roughness_scale ?? 1) * (overrides?.roughness ?? 1),
      metalness: overrides?.metalness ?? m.metalness ?? 0,
      color: overrides?.color ?? '#ffffff',
      envMapIntensity: 0.85,
      ...(overrides?.side !== undefined ? { side: overrides.side } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maps, name, repeat?.[0], repeat?.[1], overrides?.color, overrides?.roughness, overrides?.metalness]);
}

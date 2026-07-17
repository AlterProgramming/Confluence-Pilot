import { Component, Suspense, useEffect, useMemo, useRef, type ErrorInfo, type ReactNode } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Box3, Mesh, MeshStandardMaterial, Vector3, type Group, type Material } from 'three';
import type { AssetMaterialTuning, RoomDefinition } from '../types/room';

type RoomAssetProps = Pick<
  RoomDefinition,
  'assetUrl' | 'assetScale' | 'assetPosition' | 'assetRotation' | 'assetTargetSize' | 'assetMaterialTuning'
> & {
  fallback: ReactNode;
};

class AssetErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('Room GLB failed to load; procedural fallback retained.', error, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function tuneMaterial(source: Material, tuning?: AssetMaterialTuning): Material {
  const material = source.clone();
  if (!tuning) return material;

  const pbr = material as MeshStandardMaterial;
  if (typeof pbr.envMapIntensity === 'number' && tuning.envMapIntensity !== undefined) {
    pbr.envMapIntensity = tuning.envMapIntensity;
  }
  if (typeof pbr.emissiveIntensity === 'number' && tuning.emissiveIntensity !== undefined) {
    pbr.emissiveIntensity = tuning.emissiveIntensity;
  }
  if (pbr.color && tuning.colorMultiplier !== undefined) {
    pbr.color.multiplyScalar(tuning.colorMultiplier);
  }
  if (typeof pbr.roughness === 'number' && tuning.roughnessFloor !== undefined) {
    pbr.roughness = Math.max(pbr.roughness, tuning.roughnessFloor);
  }
  pbr.needsUpdate = true;
  return pbr;
}

function LoadedRoomAsset({
  url,
  scale,
  position,
  rotation,
  targetSize,
  materialTuning,
}: {
  url: string;
  scale: number;
  position: [number, number, number];
  rotation: [number, number, number];
  targetSize: number;
  materialTuning?: AssetMaterialTuning;
}) {
  const groupRef = useRef<Group>(null);
  const { scene, animations } = useGLTF(url, false, true);
  const { actions, names } = useAnimations(animations, groupRef);

  const normalized = useMemo(() => {
    const instance = scene.clone(true);
    instance.updateMatrixWorld(true);
    instance.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const original = mesh.material;
      if (Array.isArray(original)) {
        mesh.material = original.map((material) => tuneMaterial(material, materialTuning));
      } else {
        mesh.material = tuneMaterial(original, materialTuning);
      }
    });
    const bounds = new Box3().setFromObject(instance);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const largestAxis = Math.max(size.x, size.y, size.z, 0.001);
    return {
      instance,
      center: [-center.x, -center.y, -center.z] as [number, number, number],
      normalizedScale: (targetSize / largestAxis) * scale,
    };
  }, [materialTuning, scale, scene, targetSize]);

  useEffect(() => {
    const firstAction = names[0] ? actions[names[0]] : undefined;
    firstAction?.reset().fadeIn(0.25).play();
    return () => {
      firstAction?.fadeOut(0.15);
    };
  }, [actions, names]);

  // Gentle idle motion (slow turn + hover) so the centrepiece feels alive.
  // Skipped when the GLB ships its own animation.
  useFrame(({ clock }) => {
    if (names.length > 0) return;
    const t = clock.getElapsedTime();
    const inst = normalized.instance;
    inst.rotation.y = t * 0.16;
    inst.position.y = normalized.center[1] + Math.sin(t * 0.85) * 0.05;
  });

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      scale={normalized.normalizedScale}
    >
      <primitive object={normalized.instance} position={normalized.center} />
    </group>
  );
}

export function preloadRoomAsset(url?: string) {
  if (url) useGLTF.preload(url, false, true);
}

export function RoomAsset({
  assetUrl,
  assetScale = 1,
  assetPosition = [0, 0.25, 0],
  assetRotation = [0, 0, 0],
  assetTargetSize = 3.5,
  assetMaterialTuning,
  fallback,
}: RoomAssetProps) {
  if (!assetUrl) return fallback;

  return (
    <AssetErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <LoadedRoomAsset
          url={assetUrl}
          scale={assetScale}
          position={assetPosition}
          rotation={assetRotation}
          targetSize={assetTargetSize}
          materialTuning={assetMaterialTuning}
        />
      </Suspense>
    </AssetErrorBoundary>
  );
}

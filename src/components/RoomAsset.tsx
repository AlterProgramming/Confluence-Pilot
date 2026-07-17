import { Component, Suspense, useEffect, useMemo, useRef, type ErrorInfo, type ReactNode } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import { Box3, Vector3, type Group } from 'three';
import type { RoomDefinition } from '../types/room';

type RoomAssetProps = Pick<
  RoomDefinition,
  'assetUrl' | 'assetScale' | 'assetPosition' | 'assetRotation' | 'assetTargetSize'
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

function LoadedRoomAsset({
  url,
  scale,
  position,
  rotation,
  targetSize,
}: {
  url: string;
  scale: number;
  position: [number, number, number];
  rotation: [number, number, number];
  targetSize: number;
}) {
  const groupRef = useRef<Group>(null);
  const { scene, animations } = useGLTF(url, false, true);
  const { actions, names } = useAnimations(animations, groupRef);

  const normalized = useMemo(() => {
    const instance = scene.clone(true);
    instance.updateMatrixWorld(true);
    // Let textured (TRELLIS) assets pick up reflections from the Environment IBL.
    instance.traverse((node) => {
      const mesh = node as unknown as { isMesh?: boolean; material?: { envMapIntensity?: number } | Array<{ envMapIntensity?: number }> };
      if (mesh.isMesh && mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) if (m && typeof m.envMapIntensity === 'number') m.envMapIntensity = 0.9;
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
  }, [scale, scene, targetSize]);

  useEffect(() => {
    const firstAction = names[0] ? actions[names[0]] : undefined;
    firstAction?.reset().fadeIn(0.25).play();
    return () => {
      firstAction?.fadeOut(0.15);
    };
  }, [actions, names]);

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
        />
      </Suspense>
    </AssetErrorBoundary>
  );
}

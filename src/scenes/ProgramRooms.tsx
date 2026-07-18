import { Component, Suspense, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Color, Mesh, MeshStandardMaterial, Vector3, type Group, type Material } from 'three';
import type { RoomDefinition } from '../types/room';
import { useExperienceStore } from '../state/useExperienceStore';
import { RoomShell } from './kit/RoomShell';
import { LedWall } from './kit/LedWall';
import { CeilingRig } from './kit/CeilingRig';
import { Glazing } from './kit/Glazing';
import { Platform, Workbenches } from './kit/Furnishings';
import type { MaterialName } from '../materials/catalog';

export type ProgramRoomProps = { room: RoomDefinition; active: boolean };

type Profile = {
  floor: MaterialName;
  wall: MaterialName;
  wallColor: string;
  ledWall: string;
  glazing?: 'left' | 'right';
  width?: number;
  depth?: number;
  height?: number;
  ledArc?: number;
  ceilingRig?: boolean;
  feature?: 'credential-plinth' | 'maker-bay' | 'open-studio' | 'test-bay' | 'vault' | 'hangar' | 'broadcast' | 'cold-room' | 'trading-suite' | 'main-street';
};

const architectureAssetNames: Record<NonNullable<Profile['feature']>, string> = {
  'credential-plinth': 'credential-plinth',
  'maker-bay': 'maker-bay',
  'open-studio': 'open-studio',
  'test-bay': 'test-bay',
  vault: 'secure-room',
  hangar: 'hangar',
  broadcast: 'broadcast-suite',
  'cold-room': 'cold-room',
  'trading-suite': 'trading-suite',
  'main-street': 'main-street',
};

const architectureUrlCache = new Map<string, boolean>();

const profiles: Record<string, Profile> = {
  '02': { floor: 'wood-floor', wall: 'plaster', wallColor: '#e7dccb', ledWall: '/assets/screens/room-02-wall.webp', glazing: 'left', width: 15.2, depth: 13.8, height: 5.7, ledArc: 1.72, feature: 'credential-plinth' },
  '03': { floor: 'concrete', wall: 'plaster', wallColor: '#dcdfe4', ledWall: '/assets/screens/room-03-wall.webp', width: 17.6, depth: 16.2, height: 6.4, feature: 'maker-bay' },
  '05': { floor: 'concrete', wall: 'concrete', wallColor: '#b2b8c0', ledWall: '/assets/screens/room-05-wall.webp', width: 18.2, depth: 16.8, height: 6.1, ledArc: 1.55, feature: 'open-studio' },
  '06': { floor: 'concrete', wall: 'metal-panel', wallColor: '#c8ccd0', ledWall: '/assets/screens/room-06-wall.webp', width: 18.4, depth: 17.4, height: 7.2, feature: 'test-bay' },
  '07': { floor: 'metal-panel', wall: 'concrete', wallColor: '#bac0cc', ledWall: '/assets/screens/room-07-wall.webp', width: 14.8, depth: 14.4, height: 5.9, ledArc: 1.62, feature: 'vault' },
  '08': { floor: 'concrete', wall: 'metal-panel', wallColor: '#c6ced6', ledWall: '/assets/screens/room-08-wall.webp', width: 20.2, depth: 18.4, height: 7.6, ledArc: 1.45, ceilingRig: false, feature: 'hangar' },
  '09': { floor: 'metal-panel', wall: 'plaster', wallColor: '#d8dae2', ledWall: '/assets/screens/room-09-wall.webp', width: 16.8, depth: 15.2, height: 6.5, feature: 'broadcast' },
  '10': { floor: 'metal-panel', wall: 'metal-panel', wallColor: '#ccd2d8', ledWall: '/assets/screens/room-10-wall.webp', width: 15.4, depth: 16.6, height: 5.8, ledArc: 1.68, feature: 'cold-room' },
  '11': { floor: 'marble', wall: 'marble', wallColor: '#ece9e4', ledWall: '/assets/screens/room-11-wall.webp', glazing: 'right', width: 16.4, depth: 14.6, height: 6.0, ledArc: 1.76, feature: 'trading-suite' },
  '12': { floor: 'wood-floor', wall: 'plaster', wallColor: '#ece0cd', ledWall: '/assets/screens/room-12-wall.webp', glazing: 'left', width: 19.2, depth: 14.2, height: 6.0, ledArc: 1.35, feature: 'main-street' },
};

const DEFAULT_PROFILE: Profile = {
  floor: 'concrete',
  wall: 'plaster',
  wallColor: '#d6d8de',
  ledWall: '/assets/screens/room-02-wall.webp',
};

function AccentStrip({ position, scale, color }: { position: [number, number, number]; scale: [number, number, number]; color: string }) {
  return (
    <mesh position={position} scale={scale}>
      <boxGeometry />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} roughness={0.48} />
    </mesh>
  );
}

function FramedPanel({ position, rotation = [0, 0, 0], color, width = 1.5, height = 1 }: {
  position: [number, number, number];
  rotation?: [number, number, number];
  color: string;
  width?: number;
  height?: number;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, 0.1]} />
        <meshStandardMaterial color="#2c3138" metalness={0.24} roughness={0.48} />
      </mesh>
      <mesh position={[0, 0, 0.065]}>
        <boxGeometry args={[width - 0.16, height - 0.16, 0.035]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.1} roughness={0.62} />
      </mesh>
    </group>
  );
}

function PortalFrame({
  name,
  width,
  depth,
  height,
  color,
  z = 0,
}: {
  name: string;
  width: number;
  depth: number;
  height: number;
  color: string;
  z?: number;
}) {
  return (
    <group name={name} position={[0, -1.5, z]}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * width / 2, height / 2, 0]} castShadow>
          <boxGeometry args={[0.18, height, depth]} />
          <meshStandardMaterial color={color} metalness={0.3} roughness={0.46} />
        </mesh>
      ))}
      <mesh position={[0, height - 0.08, 0]} castShadow>
        <boxGeometry args={[width + 0.18, 0.16, depth]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.46} />
      </mesh>
    </group>
  );
}

function architectureAssetUrl(room: RoomDefinition, profile: Profile) {
  if (!profile.feature) return undefined;
  const slug = architectureAssetNames[profile.feature];
  return `/assets/architecture/room-${room.id}-${slug}.glb`;
}

function useGeneratedArchitectureAsset(room: RoomDefinition, profile: Profile) {
  const url = architectureAssetUrl(room, profile);
  const [availableUrl, setAvailableUrl] = useState(() => (url && architectureUrlCache.get(url) ? url : undefined));

  useEffect(() => {
    if (!url) return undefined;
    const cached = architectureUrlCache.get(url);
    if (cached !== undefined) {
      Promise.resolve().then(() => setAvailableUrl(cached ? url : undefined));
      return undefined;
    }

    let cancelled = false;
    fetch(url, { method: 'HEAD' })
      .then((response) => {
        const ok = response.ok;
        architectureUrlCache.set(url, ok);
        if (!cancelled) setAvailableUrl(ok ? url : undefined);
      })
      .catch(() => {
        architectureUrlCache.set(url, false);
        if (!cancelled) setAvailableUrl(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return availableUrl === url ? url : undefined;
}

function cloneArchitectureMaterial(source: Material, room: RoomDefinition): Material {
  const material = source.clone();
  const pbr = material as MeshStandardMaterial;
  if (typeof pbr.envMapIntensity === 'number') pbr.envMapIntensity = 0.72;
  if (typeof pbr.roughness === 'number') pbr.roughness = Math.max(pbr.roughness, 0.46);
  if (pbr.emissive && typeof pbr.emissiveIntensity === 'number') {
    pbr.emissive.lerp(new Color(room.color), 0.08);
    pbr.emissiveIntensity = Math.max(pbr.emissiveIntensity, 0.04);
  }
  pbr.needsUpdate = true;
  return pbr;
}

function prepareArchitectureScene(scene: Group, room: RoomDefinition, targetSize: number) {
  const instance = scene.clone(true);
  instance.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((material) => cloneArchitectureMaterial(material, room))
      : cloneArchitectureMaterial(mesh.material, room);
  });

  instance.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(instance);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const largestAxis = Math.max(size.x, size.y, size.z, 0.001);

  return {
    instance,
    center: [-center.x, -center.y, -center.z] as [number, number, number],
    scale: targetSize / largestAxis,
  };
}

function LoadedArchitectureAsset({ url, room, profile }: { url: string; room: RoomDefinition; profile: Profile }) {
  const { scene } = useGLTF(url, false, true);
  const width = profile.width ?? 16;
  const depth = profile.depth ?? 15;
  const targetSize = Math.min(width * 0.68, depth * 0.62, 7.2);
  const prepared = useMemo(() => prepareArchitectureScene(scene, room, targetSize), [room, scene, targetSize]);

  return (
    <group name={`generated-${profile.feature}-architecture`} position={[0, -1.14, -0.75]} scale={prepared.scale}>
      <primitive object={prepared.instance} position={prepared.center} rotation={[0, Math.PI, 0]} />
    </group>
  );
}

class ArchitectureAssetErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('Generated architecture GLB failed to load; procedural feature retained.', error, info.componentStack);
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function AutoArchitectureFeature({ room, profile }: { room: RoomDefinition; profile: Profile }) {
  const fallback = <ArchitectureFeature room={room} profile={profile} />;
  const url = useGeneratedArchitectureAsset(room, profile);

  if (!url) return fallback;

  return (
    <ArchitectureAssetErrorBoundary fallback={fallback}>
      <Suspense fallback={null}>
        <LoadedArchitectureAsset url={url} room={room} profile={profile} />
      </Suspense>
    </ArchitectureAssetErrorBoundary>
  );
}

function ArchitectureFeature({ room, profile }: { room: RoomDefinition; profile: Profile }) {
  const width = profile.width ?? 16;
  const depth = profile.depth ?? 15;
  const height = profile.height ?? 6.2;
  const backZ = -depth / 2 + 0.22;
  const topY = -1.5 + height;

  if (profile.feature === 'credential-plinth') {
    const plinths: [number, number, number][] = [
      [-1.45, 0.18, Math.PI * 0.065],
      [0, 0, 0],
      [1.45, 0.18, -Math.PI * 0.065],
    ];
    return (
      <group name="credential-plinth-architecture" position={[0, -1.5, -2.8]}>
        {plinths.map(([x, z, rotationY], index) => (
          <group key={index} name={`credential-plinth-${index + 1}`} position={[x, 0, z]} rotation={[0, rotationY, 0]}>
            <mesh name="plinth-base-foot" position={[0, 0.04, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.62, 0.08, 0.48]} />
              <meshStandardMaterial color="#bfb3a2" roughness={0.82} metalness={0.02} />
            </mesh>
            <mesh name="plinth-body" position={[0, 0.72, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.52, 1.28, 0.38]} />
              <meshStandardMaterial color="#d4c8b8" roughness={0.74} metalness={0.02} />
            </mesh>
            <mesh name="credential-display-recess" position={[0, 0.92, 0.195]}>
              <boxGeometry args={[0.42, 0.58, 0.025]} />
              <meshStandardMaterial color="#1a1a22" roughness={0.12} metalness={0} />
            </mesh>
            <mesh name="brushed-recess-lip" position={[0, 0.92, 0.212]}>
              <boxGeometry args={[0.5, 0.68, 0.018]} />
              <meshStandardMaterial color="#c0a98d" roughness={0.38} metalness={0.72} />
            </mesh>
            <mesh name="credential-display-glass" position={[0, 0.92, 0.224]}>
              <boxGeometry args={[0.4, 0.52, 0.02]} />
              <meshStandardMaterial color="#1a1a22" emissive={index === 1 ? room.color : room.secondaryColor} emissiveIntensity={0.08} roughness={0.16} />
            </mesh>
            <mesh name="amber-top-cap" position={[0, 1.39, 0]}>
              <boxGeometry args={[0.48, 0.06, 0.4]} />
              <meshStandardMaterial color={room.color} emissive={room.color} emissiveIntensity={0.28} roughness={0.5} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  if (profile.feature === 'maker-bay') {
    return (
      <group name="maker-bay-architecture">
        <PortalFrame name="wide-shop-door-frame" width={width - 2.6} depth={0.22} height={height - 0.9} color="#6d7680" z={backZ + 0.1} />
        <mesh name="overhead-utility-boom" position={[0, topY - 0.78, 1.8]} castShadow>
          <boxGeometry args={[width - 4.4, 0.16, 0.26]} />
          <meshStandardMaterial color="#59636d" metalness={0.42} roughness={0.42} />
        </mesh>
      </group>
    );
  }

  if (profile.feature === 'open-studio') {
    return (
      <group name="open-studio-architecture">
        {[-1, 1].map((side) => (
          <mesh key={side} name="pinup-wing-wall" position={[side * (width / 2 - 2.4), 0.8, -1.2]} rotation={[0, side * 0.26, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.22, 3.8, 4.4]} />
            <meshStandardMaterial color="#a8afb8" roughness={0.7} />
          </mesh>
        ))}
        <mesh name="planning-floor-inlay" position={[0, -1.47, 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.2, 3.36, 56]} />
          <meshStandardMaterial color={room.color} emissive={room.color} emissiveIntensity={0.08} roughness={0.58} />
        </mesh>
      </group>
    );
  }

  if (profile.feature === 'test-bay') {
    return (
      <group name="high-bay-test-architecture">
        <PortalFrame name="structural-test-frame" width={width - 3.8} depth={0.32} height={height - 0.65} color="#5a626b" z={-1.2} />
        <mesh name="overhead-crane-rail" position={[0, topY - 0.7, 1.4]} castShadow>
          <boxGeometry args={[width - 2.8, 0.2, 0.34]} />
          <meshStandardMaterial color="#444d56" metalness={0.5} roughness={0.38} />
        </mesh>
      </group>
    );
  }

  if (profile.feature === 'vault') {
    return (
      <group name="contained-vault-architecture">
        <mesh name="inner-secure-room-back" position={[0, 0.8, backZ + 1.35]} receiveShadow>
          <boxGeometry args={[width - 4.4, 3.8, 0.22]} />
          <meshStandardMaterial color="#8f98a6" metalness={0.18} roughness={0.58} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} name="inner-secure-room-return" position={[side * 3.1, 0.8, backZ + 2.65]} receiveShadow>
            <boxGeometry args={[0.2, 3.8, 2.6]} />
            <meshStandardMaterial color="#8f98a6" metalness={0.18} roughness={0.58} />
          </mesh>
        ))}
      </group>
    );
  }

  if (profile.feature === 'hangar') {
    return (
      <group name="hangar-architecture">
        <PortalFrame name="hangar-door-opening" width={width - 2.2} depth={0.36} height={height - 0.7} color="#59626b" z={backZ + 0.1} />
        {[-1, 1].map((side) => (
          <mesh key={side} name="hangar-side-catwalk" position={[side * (width / 2 - 1.2), 1.65, -1.4]} castShadow>
            <boxGeometry args={[0.82, 0.16, depth - 4.8]} />
            <meshStandardMaterial color="#4b545c" metalness={0.44} roughness={0.44} />
          </mesh>
        ))}
      </group>
    );
  }

  if (profile.feature === 'broadcast') {
    return (
      <group name="broadcast-suite-architecture">
        <mesh name="acoustic-back-wall-baffle" position={[0, 1.0, backZ + 0.12]} receiveShadow>
          <boxGeometry args={[width - 2.4, 3.3, 0.2]} />
          <meshStandardMaterial color="#27303a" roughness={0.82} />
        </mesh>
        {[-3.6, -1.8, 0, 1.8, 3.6].map((x) => (
          <mesh key={x} name="vertical-acoustic-fin" position={[x, 1.0, backZ + 0.34]} castShadow>
            <boxGeometry args={[0.12, 3.5, 0.42]} />
            <meshStandardMaterial color="#4e5964" roughness={0.78} />
          </mesh>
        ))}
      </group>
    );
  }

  if (profile.feature === 'cold-room') {
    return (
      <group name="cold-room-architecture">
        <PortalFrame name="insulated-threshold-frame" width={width - 3.4} depth={0.28} height={height - 1.1} color="#a7b3bd" z={backZ + 0.25} />
        {[-4.8, -2.4, 0, 2.4, 4.8].map((x) => (
          <mesh key={x} name="insulated-ceiling-rib" position={[x, topY - 0.38, 0]} castShadow>
            <boxGeometry args={[0.16, 0.22, depth - 2.6]} />
            <meshStandardMaterial color="#d4dde5" metalness={0.18} roughness={0.42} />
          </mesh>
        ))}
      </group>
    );
  }

  if (profile.feature === 'trading-suite') {
    return (
      <group name="trading-suite-architecture">
        <mesh name="low-dealing-rail" position={[0, -0.82, 2.1]} castShadow receiveShadow>
          <boxGeometry args={[width - 4.2, 0.34, 0.36]} />
          <meshStandardMaterial color="#b9b2a8" metalness={0.16} roughness={0.52} />
        </mesh>
        <mesh name="recessed-market-cove" position={[0, topY - 0.5, -1.4]} castShadow>
          <boxGeometry args={[width - 2.6, 0.18, 1.1]} />
          <meshStandardMaterial color="#d8d2c9" roughness={0.46} />
        </mesh>
      </group>
    );
  }

  if (profile.feature === 'main-street') {
    return (
      <group name="main-street-architecture">
        {[-5.7, -1.9, 1.9, 5.7].map((x, index) => (
          <group key={x} name={`storefront-bay-${index + 1}`} position={[x, 0.35, backZ + 0.4]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[2.7, 3.6, 0.2]} />
              <meshStandardMaterial color={index % 2 ? '#d4c2aa' : '#c5b79e'} roughness={0.68} />
            </mesh>
            <mesh position={[0, 0.42, 0.14]}>
              <boxGeometry args={[1.85, 1.28, 0.06]} />
              <meshStandardMaterial color={index % 2 ? room.secondaryColor : room.color} emissive={room.color} emissiveIntensity={0.06} roughness={0.5} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  return null;
}

function ProgramShell({ room, active, children }: ProgramRoomProps & { children: ReactNode }) {
  const profile = profiles[room.id] ?? DEFAULT_PROFILE;
  const low = useExperienceStore((state) => state.qualityTier) === 'low';
  const width = profile.width ?? 16;
  const depth = profile.depth ?? 15;
  const height = profile.height ?? 6.2;
  return (
    <group>
      <RoomShell
        width={width}
        depth={depth}
        height={height}
        floor={profile.floor}
        wall={profile.wall}
        wallColor={profile.wallColor}
        floorRepeat={[5, 5]}
        floorRoughness={room.id === '11' ? 0.3 : 0.68}
      />
      <AutoArchitectureFeature room={room} profile={profile} />
      <LedWall url={profile.ledWall} radius={width / 2 + 0.2} arc={profile.ledArc ?? 2.05} height={Math.min(4, height - 2.0)} y={1.5} />
      {profile.glazing && !low && <Glazing side={profile.glazing} x={width / 2 - 0.4} width={Math.min(11, depth - 3)} />}
      {profile.ceilingRig !== false && <CeilingRig y={height - 1.7} accent={room.color} stripWidth={Math.min(9, width - 4)} />}
      {active && children}
    </group>
  );
}

function AcademyCue({ room }: { room: RoomDefinition }) {
  return (
    <>
      <Workbenches accent={room.color} secondary={room.secondaryColor} rows={2} perRow={3} spacingX={2.55} z0={2.1} rowGap={2.15} />
      <group position={[5.15, 0.3, -2.4]} rotation={[0, -0.32, 0]}>
        {[0, 1, 2, 3].map((index) => (
          <FramedPanel key={index} position={[0, index * 1.05, 0]} color={index % 2 ? room.secondaryColor : room.color} width={1.5} height={0.8} />
        ))}
      </group>
      <group position={[-5.1, -1.05, -1.4]} rotation={[0, 0.35, 0]}>
        <mesh castShadow receiveShadow><cylinderGeometry args={[1.25, 1.4, 0.72, 28]} /><meshStandardMaterial color="#654f42" roughness={0.78} /></mesh>
        <AccentStrip position={[0, 0.39, 0]} scale={[1.15, 0.035, 1.15]} color={room.color} />
        {[0, 1, 2].map((index) => (
          <mesh key={index} position={[(index - 1) * 0.9, -0.45, 0.95]} castShadow>
            <cylinderGeometry args={[0.24, 0.3, 0.72, 16]} />
            <meshStandardMaterial color="#3b4148" metalness={0.18} roughness={0.55} />
          </mesh>
        ))}
      </group>
    </>
  );
}

function MakerspaceCue({ room }: { room: RoomDefinition }) {
  return (
    <>
      <group name="maker-workbenches">
        <Workbenches accent={room.color} secondary={room.secondaryColor} rows={2} perRow={3} spacingX={3} z0={2.5} rowGap={3.2} />
      </group>
      <group name="fabrication-cell" position={[-5.7, -0.25, -1.7]}>
        <mesh name="fabricator-body" castShadow><boxGeometry args={[1.2, 2.3, 1.2]} /><meshStandardMaterial color="#343942" metalness={0.3} roughness={0.48} /></mesh>
        <mesh name="fabricator-status-panel" position={[0, 0.6, 0.66]}><boxGeometry args={[0.84, 0.78, 0.06]} /><meshStandardMaterial color={room.secondaryColor} emissive={room.color} emissiveIntensity={0.16} /></mesh>
        <mesh name="fabricator-build-tray" position={[0, -0.45, 0.7]}><boxGeometry args={[0.7, 0.5, 0.15]} /><meshStandardMaterial color="#161a20" metalness={0.42} roughness={0.4} /></mesh>
        <mesh name="fabricator-gantry" position={[0, 1.35, 0.72]} castShadow><boxGeometry args={[0.95, 0.08, 0.12]} /><meshStandardMaterial color="#9aa4ad" metalness={0.5} roughness={0.36} /></mesh>
        {[-0.38, 0.38].map((x) => (
          <mesh key={x} name="fabricator-rail" position={[x, 0.16, 0.74]} castShadow>
            <boxGeometry args={[0.08, 1.65, 0.1]} />
            <meshStandardMaterial color="#7c8792" metalness={0.48} roughness={0.38} />
          </mesh>
        ))}
      </group>
      <group name="student-project-wall" position={[5.6, 1.1, -2.4]} rotation={[0, -0.28, 0]}>
        {[-1.3, 0, 1.3].map((x, index) => <FramedPanel key={x} position={[x, 0, 0]} color={index === 1 ? room.color : room.secondaryColor} width={1.1} height={1.4} />)}
      </group>
      <group name="material-storage" position={[5.6, -0.9, 1.4]}>
        {[0, 1, 2, 3].map((index) => (
          <mesh key={index} position={[(index % 2) * 0.9 - 0.45, Math.floor(index / 2) * 0.7, 0]} castShadow>
            <boxGeometry args={[0.72, 0.55, 0.72]} />
            <meshStandardMaterial color={index % 2 ? '#9d8f82' : '#6d7681'} roughness={0.72} />
          </mesh>
        ))}
        <mesh name="storage-top-shelf" position={[0, 1.55, 0]} castShadow>
          <boxGeometry args={[2.1, 0.14, 0.82]} />
          <meshStandardMaterial color="#49515a" metalness={0.18} roughness={0.62} />
        </mesh>
      </group>
      <group name="prototype-parts-table" position={[-4.7, -1.06, 1.65]} rotation={[0, 0.22, 0]}>
        <mesh castShadow receiveShadow><boxGeometry args={[1.9, 0.18, 1.05]} /><meshStandardMaterial color="#6a5b4a" roughness={0.7} /></mesh>
        {[-0.55, 0, 0.55].map((x, index) => (
          <mesh key={x} position={[x, 0.22, index % 2 ? 0.22 : -0.16]} castShadow>
            <boxGeometry args={[0.34, 0.22 + index * 0.05, 0.34]} />
            <meshStandardMaterial color={index === 1 ? room.secondaryColor : '#c4b7a5'} roughness={0.64} />
          </mesh>
        ))}
      </group>
    </>
  );
}

function NeighborhoodCue({ room }: { room: RoomDefinition }) {
  const homes = [
    [-1.6, -0.6, -0.8], [-0.55, -0.6, 0.3], [0.65, -0.6, -0.65], [1.55, -0.6, 0.65], [0, -0.6, 1.35],
  ] as const;
  return (
    <>
      <Platform accent={room.color} radius={3.7} height={0.3} />
      <group position={[0, -0.75, 0]}>
        {homes.map(([x, y, z], index) => (
          <group key={index} position={[x, y, z]}>
            <mesh castShadow><boxGeometry args={[0.9, 0.7 + (index % 2) * 0.3, 0.8]} /><meshStandardMaterial color={index % 2 ? '#b7aa96' : '#7f8a78'} roughness={0.76} /></mesh>
            <mesh position={[0, 0.55 + (index % 2) * 0.15, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[0.72, 0.5, 4]} /><meshStandardMaterial color="#5a493f" roughness={0.74} /></mesh>
          </group>
        ))}
        <mesh position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[2.5, 0.055, 8, 64]} /><meshStandardMaterial color={room.color} emissive={room.color} emissiveIntensity={0.2} /></mesh>
      </group>
      <group position={[5.25, 0.6, -2.1]} rotation={[0, -0.3, 0]}>
        <FramedPanel position={[0, 0, 0]} color={room.secondaryColor} width={2.8} height={2.2} />
        {([
          [-0.7, 0.45],
          [0.55, 0.6],
          [-0.25, -0.45],
          [0.8, -0.55],
        ] satisfies [number, number][]).map(([x, y], index) => (
          <mesh key={index} position={[x, y, 0.1]}><sphereGeometry args={[0.09, 14, 10]} /><meshStandardMaterial color={room.color} emissive={room.color} emissiveIntensity={0.3} /></mesh>
        ))}
      </group>
    </>
  );
}

function InfrastructureCue({ room }: { room: RoomDefinition }) {
  return (
    <>
      <Platform accent={room.color} radius={3.1} height={0.22} />
      <group position={[0, -0.25, -0.4]}>
        {[-2.3, 2.3].map((x) => <mesh key={x} position={[x, 0.4, 0]} castShadow><boxGeometry args={[0.28, 3.6, 0.32]} /><meshStandardMaterial color="#555d64" metalness={0.42} roughness={0.44} /></mesh>)}
        <mesh position={[0, 2.05, 0]} castShadow><boxGeometry args={[5, 0.28, 0.32]} /><meshStandardMaterial color="#555d64" metalness={0.42} roughness={0.44} /></mesh>
        {[-1.6, -0.8, 0, 0.8, 1.6].map((x) => <mesh key={x} position={[x, 1.5, 0]} rotation={[0, 0, x * 0.03]}><boxGeometry args={[0.08, 1.1, 0.12]} /><meshStandardMaterial color={room.color} emissive={room.color} emissiveIntensity={0.13} /></mesh>)}
      </group>
      <group position={[-5.5, -0.65, -1.2]}>
        {[0, 1, 2].map((index) => <mesh key={index} position={[0, index * 0.72, 0]} castShadow><boxGeometry args={[1.9, 0.55, 0.85]} /><meshStandardMaterial color={index === 1 ? '#aa8d61' : '#747d84'} roughness={0.68} /></mesh>)}
      </group>
      <group position={[5.4, -0.15, 0.8]}>
        <mesh castShadow><cylinderGeometry args={[0.18, 0.28, 2.7, 14]} /><meshStandardMaterial color="#333941" metalness={0.38} roughness={0.46} /></mesh>
        <mesh position={[0, 1.55, 0]} rotation={[0, 0, 0.3]}><boxGeometry args={[0.9, 0.22, 0.3]} /><meshStandardMaterial color={room.secondaryColor} emissive={room.color} emissiveIntensity={0.18} /></mesh>
      </group>
    </>
  );
}

function TrustCue({ room }: { room: RoomDefinition }) {
  return (
    <>
      <Platform accent={room.color} radius={2.8} height={0.24} />
      {[-3.8, 0, 3.8].map((x, index) => (
        <group key={x} position={[x, -0.45, index === 1 ? 1.9 : 0.6]} rotation={[0, index === 0 ? 0.35 : index === 2 ? -0.35 : Math.PI, 0]}>
          <mesh castShadow receiveShadow><cylinderGeometry args={[1.05, 1.2, 1.5, 28]} /><meshStandardMaterial color="#333944" metalness={0.35} roughness={0.48} /></mesh>
          <mesh position={[0, 0.45, 0.76]}><boxGeometry args={[1.25, 0.7, 0.06]} /><meshStandardMaterial color={room.secondaryColor} emissive={room.color} emissiveIntensity={0.12} /></mesh>
          <mesh position={[0, 1.15, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.6, 0.055, 10, 40]} /><meshStandardMaterial color={room.color} emissive={room.color} emissiveIntensity={0.2} /></mesh>
        </group>
      ))}
      <group position={[0, 0.45, -1]}>
        {[0.55, 0.9, 1.25].map((radius, index) => <mesh key={radius} rotation={[Math.PI / 2, 0, index * 0.35]}><torusGeometry args={[radius, 0.035, 8, 48]} /><meshStandardMaterial color={index === 1 ? room.secondaryColor : room.color} emissive={room.color} emissiveIntensity={0.12} /></mesh>)}
      </group>
    </>
  );
}

function HangarCue({ room }: { room: RoomDefinition }) {
  return (
    <>
      <group position={[0, -1.42, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[6.5, 12]} /><meshStandardMaterial color="#30363c" roughness={0.74} /></mesh>
        {[-2.2, 0, 2.2].map((x) => <AccentStrip key={x} position={[x, 0.025, 0]} scale={[0.06, 0.02, 5.4]} color={x === 0 ? room.color : room.secondaryColor} />)}
      </group>
      <group position={[0, 1.85, -1.5]}>
        <mesh castShadow><boxGeometry args={[9.5, 0.25, 0.3]} /><meshStandardMaterial color="#505860" metalness={0.45} roughness={0.42} /></mesh>
        {[-4.5, 4.5].map((x) => <mesh key={x} position={[x, -1.5, 0]} castShadow><boxGeometry args={[0.25, 3.25, 0.3]} /><meshStandardMaterial color="#505860" metalness={0.45} roughness={0.42} /></mesh>)}
      </group>
      {[-5.8, 5.8].map((x) => (
        <group key={x} position={[x, -0.9, 1.7]}>
          <mesh castShadow><boxGeometry args={[1.45, 0.55, 1.05]} /><meshStandardMaterial color="#68737d" metalness={0.3} roughness={0.52} /></mesh>
          {[-0.48, 0.48].map((dx) => <mesh key={dx} position={[dx, -0.34, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.22, 0.08, 10, 24]} /><meshStandardMaterial color="#20252b" roughness={0.65} /></mesh>)}
        </group>
      ))}
    </>
  );
}

function CommunicationsCue({ room }: { room: RoomDefinition }) {
  return (
    <>
      <Platform accent={room.color} radius={3.2} height={0.22} />
      <group position={[0, -0.2, 0]} rotation={[0, -0.35, 0]}>
        <mesh rotation={[0.3, 0, 0]} castShadow><cylinderGeometry args={[0.08, 0.5, 2.4, 20]} /><meshStandardMaterial color="#545d67" metalness={0.36} roughness={0.48} /></mesh>
        <mesh position={[0, 1.25, 0]} rotation={[0.55, 0, 0]}><circleGeometry args={[1.55, 48]} /><meshStandardMaterial color="#9ba5af" side={2} metalness={0.25} roughness={0.54} /></mesh>
        <mesh position={[0, 1.25, 0.15]} rotation={[0.55, 0, 0]}><torusGeometry args={[1.2, 0.045, 8, 48]} /><meshStandardMaterial color={room.color} emissive={room.color} emissiveIntensity={0.18} /></mesh>
      </group>
      {[-5.6, -4.5, 4.5, 5.6].map((x, index) => (
        <group key={x} position={[x, -0.15, index % 2 ? -1.8 : 1.1]}>
          <mesh castShadow><cylinderGeometry args={[0.07, 0.12, 3, 10]} /><meshStandardMaterial color="#343a42" metalness={0.42} /></mesh>
          {[0.3, 0.8, 1.3].map((y) => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.35, 0.035, 8, 30]} /><meshStandardMaterial color={room.secondaryColor} emissive={room.color} emissiveIntensity={0.12} /></mesh>)}
        </group>
      ))}
    </>
  );
}

function ColdChainCue({ room }: { room: RoomDefinition }) {
  return (
    <>
      <Workbenches accent={room.color} secondary={room.secondaryColor} rows={1} perRow={3} spacingX={3.1} z0={2.3} />
      {[-5.7, 5.7].map((x) => (
        <group key={x} position={[x, -0.05, -1.6]}>
          <mesh castShadow><boxGeometry args={[1.8, 3.1, 1.05]} /><meshStandardMaterial color="#d5dde3" metalness={0.16} roughness={0.44} /></mesh>
          {[0.65, -0.25, -1.05].map((y, index) => <mesh key={y} position={[0, y, 0.57]}><boxGeometry args={[1.45, 0.08, 0.05]} /><meshStandardMaterial color={index === 0 ? room.color : '#7b858e'} emissive={index === 0 ? room.color : '#000000'} emissiveIntensity={0.12} /></mesh>)}
        </group>
      ))}
      <group position={[0, -0.85, -1.4]}>
        {[-1.4, -0.45, 0.5, 1.45].map((x, index) => <mesh key={x} position={[x, 0, index % 2 ? 0.45 : -0.2]} castShadow><boxGeometry args={[0.8, 0.65, 0.8]} /><meshStandardMaterial color={index % 2 ? '#83956c' : '#a9875e'} roughness={0.78} /></mesh>)}
        <mesh position={[0, 1.15, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[2.1, 0.08, 10, 48]} /><meshStandardMaterial color={room.secondaryColor} emissive={room.color} emissiveIntensity={0.14} /></mesh>
      </group>
    </>
  );
}

function FintechCue({ room }: { room: RoomDefinition }) {
  return (
    <>
      <Workbenches accent={room.color} secondary={room.secondaryColor} rows={2} perRow={2} spacingX={4.2} z0={2.2} rowGap={2.6} />
      <group position={[0, -0.9, -1.25]}>
        {[-2.2, 0, 2.2].map((x, index) => (
          <group key={x} position={[x, index * 0.25, 0]}>
            <mesh castShadow><cylinderGeometry args={[0.62, 0.76, 1.2 + index * 0.35, 24]} /><meshStandardMaterial color={index === 1 ? '#5d5062' : '#77717b'} metalness={0.22} roughness={0.56} /></mesh>
            <mesh position={[0, 0.72 + index * 0.18, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.58, 0.045, 8, 36]} /><meshStandardMaterial color={index === 1 ? room.color : room.secondaryColor} emissive={room.color} emissiveIntensity={0.14} /></mesh>
          </group>
        ))}
        {[-1.1, 1.1].map((x) => <AccentStrip key={x} position={[x, 0.05, 0]} scale={[0.7, 0.035, 0.035]} color={room.secondaryColor} />)}
      </group>
      <group position={[5.35, 0.55, -2.1]} rotation={[0, -0.32, 0]}>
        <FramedPanel position={[0, 0.75, 0]} color={room.secondaryColor} width={2.5} height={1.1} />
        <FramedPanel position={[0, -0.55, 0]} color={room.color} width={2.5} height={1.1} />
      </group>
    </>
  );
}

function MainStreetCue({ room }: { room: RoomDefinition }) {
  return (
    <>
      {[-5.4, -2.8, 2.8, 5.4].map((x, index) => (
        <group key={x} position={[x, -0.1, -2.1]}>
          <mesh castShadow receiveShadow><boxGeometry args={[2.15, 2.9, 1]} /><meshStandardMaterial color={index % 2 ? '#c8ad91' : '#a99d8a'} roughness={0.72} /></mesh>
          <mesh position={[0, 0.55, 0.54]}><boxGeometry args={[1.7, 0.95, 0.06]} /><meshStandardMaterial color={index % 2 ? room.secondaryColor : room.color} emissive={room.color} emissiveIntensity={0.08} /></mesh>
          <mesh position={[0, -0.75, 0.55]}><boxGeometry args={[0.75, 1, 0.07]} /><meshStandardMaterial color="#454a50" metalness={0.2} roughness={0.54} /></mesh>
          <mesh position={[0, 1.25, 0.65]}><boxGeometry args={[1.65, 0.16, 0.5]} /><meshStandardMaterial color={index % 2 ? room.color : room.secondaryColor} roughness={0.55} /></mesh>
        </group>
      ))}
      <group position={[0, -1, 1.4]}>
        <mesh castShadow receiveShadow><cylinderGeometry args={[2.1, 2.35, 0.78, 36]} /><meshStandardMaterial color="#6a5142" roughness={0.78} /></mesh>
        <mesh position={[0, 0.42, 0]}><cylinderGeometry args={[2.05, 2.05, 0.08, 36]} /><meshStandardMaterial color={room.secondaryColor} emissive={room.color} emissiveIntensity={0.08} roughness={0.6} /></mesh>
        {[-1.3, 0, 1.3].map((x) => <mesh key={x} position={[x, -0.62, 1.25]} castShadow><cylinderGeometry args={[0.28, 0.34, 0.72, 16]} /><meshStandardMaterial color="#3b4046" metalness={0.16} roughness={0.58} /></mesh>)}
      </group>
    </>
  );
}

export function WorkforceAcademy({ room, active }: ProgramRoomProps) {
  return <ProgramShell room={room} active={active}><AcademyCue room={room} /></ProgramShell>;
}

export function StudentMakerspace({ room, active }: ProgramRoomProps) {
  return <ProgramShell room={room} active={active}><MakerspaceCue room={room} /></ProgramShell>;
}

export function NeighborhoodStudio({ room, active }: ProgramRoomProps) {
  return <ProgramShell room={room} active={active}><NeighborhoodCue room={room} /></ProgramShell>;
}

export function InfrastructureTestbed({ room, active }: ProgramRoomProps) {
  return <ProgramShell room={room} active={active}><InfrastructureCue room={room} /></ProgramShell>;
}

export function TrustworthyAILab({ room, active }: ProgramRoomProps) {
  return <ProgramShell room={room} active={active}><TrustCue room={room} /></ProgramShell>;
}

export function MobilityHangar({ room, active }: ProgramRoomProps) {
  return <ProgramShell room={room} active={active}><HangarCue room={room} /></ProgramShell>;
}

export function CommunicationsLab({ room, active }: ProgramRoomProps) {
  return <ProgramShell room={room} active={active}><CommunicationsCue room={room} /></ProgramShell>;
}

export function ColdChainLab({ room, active }: ProgramRoomProps) {
  return <ProgramShell room={room} active={active}><ColdChainCue room={room} /></ProgramShell>;
}

export function FintechStudio({ room, active }: ProgramRoomProps) {
  return <ProgramShell room={room} active={active}><FintechCue room={room} /></ProgramShell>;
}

export function MainStreetStudio({ room, active }: ProgramRoomProps) {
  return <ProgramShell room={room} active={active}><MainStreetCue room={room} /></ProgramShell>;
}

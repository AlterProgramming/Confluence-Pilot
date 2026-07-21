import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { Dimension } from './Dimension';
import { ProceduralDestinationArchitecture } from './ProceduralDestinationArchitecture';
import { ProceduralWorldArchitecture } from './ProceduralWorldArchitecture';
import './complexity.css';

const WORLD_ID = 'the-weight-of-remembering';
const DESTINATION_ID = 'parallel-remembrance';

function parseVector(value: string | null): Vector3 | null {
  if (!value) return null;
  const coordinates = value.split(',').map(Number);
  if (coordinates.length !== 3 || coordinates.some((coordinate) => !Number.isFinite(coordinate))) return null;
  return new Vector3(coordinates[0], coordinates[1], coordinates[2]);
}

function SynchronizedArchitecture() {
  const worldGroup = useRef<Group>(null);
  const destinationGroup = useRef<Group>(null);
  const scene = useMemo(() => new Dimension(WORLD_ID).buildScene(), []);
  const destination = scene.destinations.find((candidate) => candidate.id === DESTINATION_ID) ?? null;
  const target = useRef(new Vector3(...scene.camera.target));

  useFrame((state, delta) => {
    const runtime = document.querySelector<HTMLElement>('[data-testid="dimension-runtime"]');
    if (!runtime) return;

    const realmId = runtime.dataset.realmId;
    if (worldGroup.current) worldGroup.current.visible = realmId === WORLD_ID;
    if (destinationGroup.current) destinationGroup.current.visible = realmId === DESTINATION_ID;
    if (realmId !== WORLD_ID && realmId !== DESTINATION_ID) return;

    const nextPosition = parseVector(runtime.dataset.cameraPosition ?? null);
    const nextTarget = parseVector(runtime.dataset.cameraTarget ?? null);
    if (!nextPosition || !nextTarget) return;

    const cameraBlend = Math.min(1, delta * 5.5);
    state.camera.position.lerp(nextPosition, cameraBlend);
    target.current.lerp(nextTarget, cameraBlend);
    state.camera.lookAt(target.current);
    if (state.camera instanceof PerspectiveCamera) {
      state.camera.fov += ((realmId === DESTINATION_ID ? 48 : 45) - state.camera.fov) * cameraBlend;
    }
    state.camera.updateProjectionMatrix();
  });

  return (
    <>
      <group ref={worldGroup}>
        <ambientLight intensity={0.22} color="#a79bc7" />
        <pointLight position={[-4.5, 2.5, 3]} intensity={5} distance={13} color={scene.palette.memory} />
        <pointLight position={[3.8, -0.8, 0]} intensity={4} distance={12} color={scene.palette.violet} />
        <ProceduralWorldArchitecture scene={scene} />
      </group>
      {destination && (
        <group ref={destinationGroup} visible={false}>
          <ambientLight intensity={0.24} color={destination.palette.primary} />
          <pointLight position={[4.2, 2.2, -14.2]} intensity={5} distance={10} color={destination.palette.primary} />
          <pointLight position={[8.8, 1.4, -14.4]} intensity={4} distance={10} color={destination.palette.secondary} />
          <ProceduralDestinationArchitecture destination={destination} />
        </group>
      )}
    </>
  );
}

export function ProceduralWorldOverlay() {
  const scene = useMemo(() => new Dimension(WORLD_ID).buildScene(), []);
  return (
    <Canvas
      className="dimension-complexity-overlay"
      camera={{ position: scene.camera.position, fov: 45, near: 0.1, far: 100 }}
      dpr={[1, 1.35]}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <SynchronizedArchitecture />
    </Canvas>
  );
}

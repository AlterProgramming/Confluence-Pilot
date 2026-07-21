import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Group, Vector3 } from 'three';
import { Dimension } from './Dimension';
import { ProceduralWorldArchitecture } from './ProceduralWorldArchitecture';
import './complexity.css';

const WORLD_ID = 'the-weight-of-remembering';

function parseVector(value: string | null): Vector3 | null {
  if (!value) return null;
  const coordinates = value.split(',').map(Number);
  if (coordinates.length !== 3 || coordinates.some((coordinate) => !Number.isFinite(coordinate))) return null;
  return new Vector3(coordinates[0], coordinates[1], coordinates[2]);
}

function SynchronizedArchitecture() {
  const group = useRef<Group>(null);
  const scene = useMemo(() => new Dimension(WORLD_ID).buildScene(), []);
  const target = useRef(new Vector3(...scene.camera.target));

  useFrame((state, delta) => {
    const runtime = document.querySelector<HTMLElement>('[data-testid="dimension-runtime"]');
    const architecture = group.current;
    if (!runtime || !architecture) return;

    const visible = runtime.dataset.realmId === WORLD_ID;
    architecture.visible = visible;
    if (!visible) return;

    const nextPosition = parseVector(runtime.dataset.cameraPosition ?? null);
    const nextTarget = parseVector(runtime.dataset.cameraTarget ?? null);
    if (!nextPosition || !nextTarget) return;

    const cameraBlend = Math.min(1, delta * 5.5);
    state.camera.position.lerp(nextPosition, cameraBlend);
    target.current.lerp(nextTarget, cameraBlend);
    state.camera.lookAt(target.current);
    state.camera.updateProjectionMatrix();
  });

  return (
    <group ref={group}>
      <ambientLight intensity={0.22} color="#a79bc7" />
      <pointLight position={[-4.5, 2.5, 3]} intensity={5} distance={13} color={scene.palette.memory} />
      <pointLight position={[3.8, -0.8, 0]} intensity={4} distance={12} color={scene.palette.violet} />
      <ProceduralWorldArchitecture scene={scene} />
    </group>
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

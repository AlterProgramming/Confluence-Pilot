import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Color,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  TorusGeometry,
  type Mesh,
  type MeshBasicMaterial,
} from 'three';
import { rooms, ROOM_SPACING } from '../data/rooms';
import { useExperienceStore } from '../state/useExperienceStore';

const SHAFT_Z = -2.1;
const TOTAL_HEIGHT = (rooms.length - 1) * ROOM_SPACING;
const ENERGY_RINGS = 3;

export function TransitionShaft() {
  const bracesRef = useRef<InstancedMesh>(null);
  const energyRefs = useRef<Array<Mesh | null>>([]);

  const braceGeometry = useMemo(() => new TorusGeometry(1.15, 0.05, 6, 40), []);
  const braceMaterial = useMemo(
    () => new MeshStandardMaterial({ color: '#20283a', metalness: 0.7, roughness: 0.35, emissive: '#0c1220' }),
    [],
  );
  const railGeometry = useMemo(() => new CylinderGeometry(0.035, 0.035, TOTAL_HEIGHT + 6, 6), []);
  const railMaterial = useMemo(
    () => new MeshStandardMaterial({ color: '#2a3346', metalness: 0.66, roughness: 0.4 }),
    [],
  );

  const braceCount = useMemo(() => Math.floor(TOTAL_HEIGHT / (ROOM_SPACING / 2)) + 2, []);

  useEffect(() => {
    const mesh = bracesRef.current;
    if (!mesh) return;
    const dummy = new Object3D();
    const step = ROOM_SPACING / 2;
    for (let i = 0; i < braceCount; i += 1) {
      dummy.position.set(0, i * step - 2, 0);
      dummy.rotation.set(Math.PI / 2, 0, (i % 2) * 0.4);
      dummy.scale.setScalar(i % 2 === 0 ? 1 : 0.72);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [braceCount]);

  const colorA = useMemo(() => new Color(), []);
  const colorB = useMemo(() => new Color(), []);
  const mixed = useMemo(() => new Color(), []);
  const scratch = useMemo(() => new Matrix4(), []);

  // Silence unused warning for the scratch matrix on some TS configs.
  void scratch;

  useFrame(() => {
    const state = useExperienceStore.getState();
    const activeY = rooms[state.activeRoom].y;
    const requestedY = rooms[state.requestedRoom].y;
    const progress = state.isTransitioning ? state.transitionProgress : 0;

    colorA.set(rooms[state.activeRoom].color);
    colorB.set(rooms[state.requestedRoom].color);
    mixed.lerpColors(colorA, colorB, progress);

    const travel = state.isTransitioning ? Math.sin(progress * Math.PI) : 0;
    const from = activeY + 0.7;
    const to = requestedY + 0.7;

    for (let i = 0; i < ENERGY_RINGS; i += 1) {
      const ring = energyRefs.current[i];
      if (!ring) continue;
      const phase = (progress + i / ENERGY_RINGS) % 1;
      ring.position.y = from + (to - from) * phase;
      const mat = ring.material as MeshBasicMaterial;
      mat.color.copy(mixed);
      mat.opacity = travel * (0.85 - i * 0.18);
      const scale = 1 + Math.sin(phase * Math.PI) * 0.5;
      ring.scale.setScalar(scale);
      ring.visible = travel > 0.01;
    }
  });

  return (
    <group position={[0, 0, SHAFT_Z]}>
      <instancedMesh ref={bracesRef} args={[braceGeometry, braceMaterial, braceCount]} frustumCulled={false} />

      <mesh geometry={railGeometry} material={railMaterial} position={[1.05, TOTAL_HEIGHT / 2, 0]} />
      <mesh geometry={railGeometry} material={railMaterial} position={[-1.05, TOTAL_HEIGHT / 2, 0]} />

      <mesh position={[0, TOTAL_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[0.26, 0.26, TOTAL_HEIGHT + 6, 10]} />
        <meshStandardMaterial color="#141a26" metalness={0.5} roughness={0.5} emissive="#0a0f1a" />
      </mesh>

      {Array.from({ length: ENERGY_RINGS }, (_, i) => (
        <mesh
          key={i}
          ref={(node) => {
            energyRefs.current[i] = node;
          }}
          visible={false}
        >
          <torusGeometry args={[1.28, 0.06, 8, 48]} />
          <meshBasicMaterial transparent opacity={0} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

import { useEffect, useMemo, useRef } from 'react';
import {
  CylinderGeometry,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
} from 'three';
import type { RoomDefinition } from '../types/room';

const PEDESTALS = 7;
const RADIUS = 4.9;

function ProgramAccent({ room, active }: { room: RoomDefinition; active: boolean }) {
  const emissive = active ? 1.1 : 0.28;
  switch (room.category) {
    case 'public':
    case 'workforce':
      return (
        <mesh position={[-3.4, 1.1, -2.2]} rotation={[0, 0.5, 0]}>
          <planeGeometry args={[1.8, 1.1]} />
          <meshStandardMaterial color={room.secondaryColor} emissive={room.color} emissiveIntensity={emissive} />
        </mesh>
      );
    case 'student':
    case 'research':
      return (
        <group position={[3.3, 0.2, -2.0]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, i * 0.42, 0]}>
              <boxGeometry args={[1.3 - i * 0.28, 0.28, 1.0 - i * 0.2]} />
              <meshStandardMaterial
                color="#1a2230"
                emissive={room.color}
                emissiveIntensity={emissive * (0.3 + i * 0.2)}
                metalness={0.5}
                roughness={0.4}
              />
            </mesh>
          ))}
        </group>
      );
    default:
      return (
        <mesh position={[3.2, 1.0, -2.2]} rotation={[0, -0.4, 0]}>
          <torusGeometry args={[0.7, 0.08, 8, 28]} />
          <meshStandardMaterial color={room.secondaryColor} emissive={room.color} emissiveIntensity={emissive} />
        </mesh>
      );
  }
}

export function RoomFixtures({ room, active }: { room: RoomDefinition; active: boolean }) {
  const basesRef = useRef<InstancedMesh>(null);
  const capsRef = useRef<InstancedMesh>(null);

  const baseGeometry = useMemo(() => new CylinderGeometry(0.34, 0.42, 1.0, 12), []);
  const baseMaterial = useMemo(
    () => new MeshStandardMaterial({ color: '#161d29', metalness: 0.58, roughness: 0.36 }),
    [],
  );
  const capGeometry = useMemo(() => new CylinderGeometry(0.36, 0.36, 0.08, 16), []);
  const capMaterial = useMemo(
    () => new MeshBasicMaterial({ color: room.color, toneMapped: false, transparent: true }),
    [room.color],
  );

  useEffect(() => {
    capMaterial.opacity = active ? 0.9 : 0.28;
  }, [active, capMaterial]);

  useEffect(() => {
    const bases = basesRef.current;
    const caps = capsRef.current;
    if (!bases || !caps) return;
    const dummy = new Object3D();
    for (let i = 0; i < PEDESTALS; i += 1) {
      // Leave a wider gap toward the camera (front) so the hero asset reads clearly.
      const angle = Math.PI * 0.5 + (i / PEDESTALS) * Math.PI * 1.7;
      const x = Math.cos(angle) * RADIUS;
      const z = Math.sin(angle) * RADIUS * 0.82 - 0.6;

      dummy.position.set(x, -1.0, z);
      dummy.rotation.set(0, -angle, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      bases.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, -0.46, z);
      dummy.updateMatrix();
      caps.setMatrixAt(i, dummy.matrix);
    }
    bases.instanceMatrix.needsUpdate = true;
    caps.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <group>
      <instancedMesh ref={basesRef} args={[baseGeometry, baseMaterial, PEDESTALS]} frustumCulled={false} />
      <instancedMesh ref={capsRef} args={[capGeometry, capMaterial, PEDESTALS]} frustumCulled={false} />
      <ProgramAccent room={room} active={active} />
    </group>
  );
}

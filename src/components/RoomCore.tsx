import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import type { RoomDefinition } from '../types/room';

function CoreGeometry({ room }: { room: RoomDefinition }) {
  switch (room.shape) {
    case 'torus':
      return <torusKnotGeometry args={[0.98, 0.25, 112, 14]} />;
    case 'octahedron':
      return <octahedronGeometry args={[1.42, 2]} />;
    case 'box':
      return <boxGeometry args={[1.7, 1.7, 1.7, 3, 3, 3]} />;
    case 'cylinder':
      return <cylinderGeometry args={[1.0, 1.34, 2.25, 18, 4]} />;
    case 'icosahedron':
      return <icosahedronGeometry args={[1.4, 2]} />;
    default:
      return <sphereGeometry args={[1.28, 40, 28]} />;
  }
}

export function RoomCore({ room, active }: { room: RoomDefinition; active: boolean }) {
  const coreRef = useRef<Mesh>(null);
  const shellRef = useRef<Mesh>(null);
  const orbitRef = useRef<Group>(null);

  useFrame(({ clock }, delta) => {
    const time = clock.getElapsedTime();
    if (coreRef.current) {
      coreRef.current.rotation.y += delta * (active ? 0.3 : 0.07);
      coreRef.current.rotation.x = Math.sin(time * 0.46) * 0.1;
      coreRef.current.position.y = 0.65 + Math.sin(time * 0.76) * (active ? 0.14 : 0.04);
    }
    if (shellRef.current) {
      shellRef.current.rotation.y -= delta * (active ? 0.16 : 0.035);
      shellRef.current.rotation.z = time * 0.025;
      const scale = 1.32 + Math.sin(time * 0.58) * (active ? 0.035 : 0.01);
      shellRef.current.scale.setScalar(scale);
    }
    if (orbitRef.current) {
      orbitRef.current.rotation.y += delta * (active ? 0.19 : 0.045);
      orbitRef.current.rotation.x = Math.sin(time * 0.2) * 0.2;
    }
  });

  return (
    <group position={[0, 0.12, 0]}>
      <mesh ref={coreRef} castShadow>
        <CoreGeometry room={room} />
        <meshStandardMaterial
          color={room.color}
          emissive={room.color}
          emissiveIntensity={active ? 0.58 : 0.14}
          metalness={0.58}
          roughness={0.16}
          wireframe={room.shape === 'box'}
        />
      </mesh>

      <mesh ref={shellRef} position={[0, 0.65, 0]}>
        <icosahedronGeometry args={[1.62, 1]} />
        <meshBasicMaterial
          color={room.secondaryColor}
          wireframe
          transparent
          opacity={active ? 0.23 : 0.07}
        />
      </mesh>

      <group ref={orbitRef} position={[0, 0.66, 0]} rotation={[0.5, 0.2, 0.2]}>
        <mesh>
          <torusGeometry args={[2.16, 0.025, 6, 96]} />
          <meshBasicMaterial color={room.secondaryColor} transparent opacity={active ? 0.6 : 0.14} />
        </mesh>
        {[0, 1, 2].map((index) => {
          const angle = (index / 3) * Math.PI * 2;
          return (
            <mesh key={index} position={[Math.cos(angle) * 2.16, Math.sin(angle) * 2.16, 0]}>
              <sphereGeometry args={[0.085 + index * 0.018, 12, 8]} />
              <meshBasicMaterial color={index === 1 ? '#ffffff' : room.secondaryColor} toneMapped={false} />
            </mesh>
          );
        })}
      </group>

      <mesh position={[0, -1.46, 0]} receiveShadow>
        <cylinderGeometry args={[1.95, 2.3, 0.38, 48]} />
        <meshStandardMaterial color="#181d25" metalness={0.62} roughness={0.27} />
      </mesh>
      <mesh position={[0, -1.245, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.08, 1.78, 64]} />
        <meshBasicMaterial color={room.color} transparent opacity={active ? 0.32 : 0.08} />
      </mesh>
      <pointLight
        color={room.secondaryColor}
        intensity={active ? 6.5 : 1.4}
        distance={9}
        decay={2}
        position={[0, 1.35, 1.4]}
      />
    </group>
  );
}

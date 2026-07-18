import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { RoomDefinition } from '../types/room';

/**
 * Two-draw-call semantic proxies for the generated hero outliers.
 * Room 03 reads as a faceted fabrication core; Room 04 reads as a building node.
 * They preserve room identity on balanced/low hardware without uploading the
 * 300k–385k triangle source GLBs.
 */
export function RoomHeroLod({ room, active }: { room: RoomDefinition; active: boolean }) {
  const group = useRef<Group>(null);

  useFrame(({ clock }, delta) => {
    if (!active || !group.current) return;
    const time = clock.getElapsedTime();
    group.current.rotation.y += delta * 0.18;
    group.current.position.y = 0.42 + Math.sin(time * 0.72) * 0.06;
  });

  const isBuildingNode = room.id === '04';

  return (
    <group ref={group} position={[0, 0.42, 0]}>
      <mesh castShadow>
        {isBuildingNode
          ? <boxGeometry args={[2.3, 2.8, 2.3]} />
          : <octahedronGeometry args={[1.65, 0]} />}
        <meshStandardMaterial
          color={room.color}
          emissive={room.color}
          emissiveIntensity={active ? 0.34 : 0.08}
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, -1.58, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.35, 1.75, 28]} />
        <meshBasicMaterial color={room.secondaryColor} toneMapped={false} />
      </mesh>
    </group>
  );
}

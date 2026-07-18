import { AdditiveBlending } from 'three';
import { rooms } from '../data/rooms';
import { useExperienceStore } from '../state/useExperienceStore';

function TowerFloor({
  index,
  active,
  destination,
}: {
  index: number;
  active: boolean;
  destination: boolean;
}) {
  const room = rooms[index]!;
  const opacity = active ? 0.24 : destination ? 0.18 : 0.075;
  const scale = active ? 1.04 : destination ? 1.02 : 1;

  return (
    <group position={[0, room.y, 0]} scale={[scale, 1, scale]}>
      <mesh position={[0, -1.64, 0]}>
        <boxGeometry args={[9.6, 0.035, 9.9]} />
        <meshBasicMaterial color={room.color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.35, -4.75]}>
        <boxGeometry args={[9.2, 2.6, 0.035]} />
        <meshBasicMaterial color={room.secondaryColor} transparent opacity={opacity * 0.6} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.48, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.18, 0.012, 4, 48]} />
        <meshBasicMaterial
          color={active ? room.secondaryColor : room.color}
          transparent
          opacity={opacity + 0.03}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export function TowerOverview() {
  const activeRoom = useExperienceStore((state) => state.activeRoom);
  const requestedRoom = useExperienceStore((state) => state.requestedRoom);
  const isTransitioning = useExperienceStore((state) => state.isTransitioning);

  return (
    <group name="persistent-building-tower">
      {rooms.map((room, index) => (
        <TowerFloor
          key={`tower-${room.id}`}
          index={index}
          active={index === activeRoom}
          destination={isTransitioning && index === requestedRoom}
        />
      ))}
    </group>
  );
}

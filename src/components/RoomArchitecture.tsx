import type { RoomDefinition, RoomArchitecture as RoomArchitectureKind } from '../types/room';

// A few dimensional tweaks so authored rooms don't feel identical.
function profile(kind: RoomArchitectureKind) {
  switch (kind) {
    case 'gallery':
      return { floor: 7.0, wall: 5.4, pillar: 5.6 };
    case 'academy':
      return { floor: 6.4, wall: 5.0, pillar: 6.0 };
    case 'studio':
      return { floor: 6.0, wall: 4.6, pillar: 5.0 };
    case 'living-building':
      return { floor: 6.6, wall: 5.8, pillar: 6.4 };
    case 'neighborhood':
      return { floor: 7.4, wall: 4.4, pillar: 5.2 };
    default:
      return { floor: 6.2, wall: 4.8, pillar: 5.4 };
  }
}

function Signature({ room, active }: { room: RoomDefinition; active: boolean }) {
  const emissive = active ? 0.9 : 0.2;
  switch (room.architecture) {
    case 'gallery':
      return (
        <>
          {[-2.4, 0, 2.4].map((x) => (
            <mesh key={x} position={[x, 2.6, -3.7]}>
              <planeGeometry args={[1.5, 2.1]} />
              <meshStandardMaterial
                color={room.secondaryColor}
                emissive={room.color}
                emissiveIntensity={emissive}
                metalness={0.3}
                roughness={0.4}
              />
            </mesh>
          ))}
        </>
      );
    case 'neighborhood':
      return (
        <group position={[0, -1.32, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          {Array.from({ length: 5 }, (_, gx) =>
            Array.from({ length: 5 }, (_, gz) => (
              <mesh key={`${gx}-${gz}`} position={[(gx - 2) * 1.15, (gz - 2) * 1.15, 0]}>
                <planeGeometry args={[1.0, 1.0]} />
                <meshBasicMaterial
                  color={(gx + gz) % 2 ? room.color : room.secondaryColor}
                  transparent
                  opacity={active ? 0.32 : 0.1}
                />
              </mesh>
            )),
          )}
        </group>
      );
    case 'living-building':
      return (
        <mesh position={[0, 2.4, -3.4]}>
          <boxGeometry args={[5.2, 4.4, 0.1]} />
          <meshStandardMaterial color={room.color} emissive={room.color} emissiveIntensity={emissive * 0.6} wireframe />
        </mesh>
      );
    default:
      return (
        <mesh position={[0, 3.4, -3.6]} rotation={[0, 0, Math.PI / 4]}>
          <torusGeometry args={[1.1, 0.06, 8, 32]} />
          <meshStandardMaterial color={room.secondaryColor} emissive={room.color} emissiveIntensity={emissive} />
        </mesh>
      );
  }
}

export function RoomArchitecture({ room, active }: { room: RoomDefinition; active: boolean }) {
  const dims = profile(room.architecture);
  const stripEmissive = active ? 1.4 : 0.3;

  return (
    <group>
      {/* Floor platform */}
      <mesh position={[0, -1.5, 0]} receiveShadow>
        <cylinderGeometry args={[dims.floor, dims.floor + 0.4, 0.4, 56]} />
        <meshStandardMaterial color="#10151f" metalness={0.55} roughness={0.42} />
      </mesh>
      <mesh position={[0, -1.29, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[dims.floor - 1.1, dims.floor - 0.7, 64]} />
        <meshBasicMaterial color={room.color} transparent opacity={active ? 0.5 : 0.14} toneMapped={false} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, dims.wall / 2 - 1.2, -4]}>
        <boxGeometry args={[dims.floor * 1.7, dims.wall, 0.3]} />
        <meshStandardMaterial color="#0c1017" metalness={0.4} roughness={0.6} />
      </mesh>
      {[-2.9, 2.9].map((x) => (
        <mesh key={x} position={[x, dims.wall / 2 - 1.2, -3.83]}>
          <boxGeometry args={[0.16, dims.wall - 0.6, 0.06]} />
          <meshStandardMaterial
            color={room.secondaryColor}
            emissive={room.color}
            emissiveIntensity={stripEmissive}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Side pillars */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (dims.floor - 0.5), dims.pillar / 2 - 1.3, -1.6]}>
          <boxGeometry args={[0.4, dims.pillar, 0.4]} />
          <meshStandardMaterial color="#161c28" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}

      {/* Overhead beam with accent glow */}
      <mesh position={[0, dims.pillar - 1.2, -1.6]}>
        <boxGeometry args={[dims.floor * 2 - 0.6, 0.32, 0.5]} />
        <meshStandardMaterial color="#12affb" opacity={0} transparent />
      </mesh>
      <mesh position={[0, dims.pillar - 1.34, -1.4]}>
        <boxGeometry args={[dims.floor * 2 - 1.2, 0.06, 0.1]} />
        <meshBasicMaterial color={room.color} transparent opacity={active ? 0.8 : 0.2} toneMapped={false} />
      </mesh>

      <Signature room={room} active={active} />
    </group>
  );
}

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { RoomDefinition } from '../types/room';

function GalleryArchitecture({ room, active }: { room: RoomDefinition; active: boolean }) {
  const ringRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    ringRef.current.rotation.z = Math.sin(clock.getElapsedTime() * 0.22) * (active ? 0.05 : 0.015);
  });

  return (
    <group>
      <mesh position={[0, -1.82, 0]} receiveShadow>
        <cylinderGeometry args={[5.9, 6.25, 0.42, 48]} />
        <meshStandardMaterial color="#11151c" metalness={0.48} roughness={0.34} />
      </mesh>
      <mesh position={[0, -1.58, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.8, 5.8, 64]} />
        <meshBasicMaterial color={room.color} transparent opacity={active ? 0.09 : 0.035} />
      </mesh>
      <group ref={ringRef} position={[0, 0.62, -2.65]}>
        {[4.9, 4.15, 3.42].map((radius, index) => (
          <mesh key={radius} scale={[1, 1.04 - index * 0.04, 1]}>
            <torusGeometry args={[radius, 0.055 + index * 0.018, 8, 96]} />
            <meshStandardMaterial
              color={index === 1 ? room.secondaryColor : room.color}
              emissive={index === 1 ? room.secondaryColor : room.color}
              emissiveIntensity={active ? 0.82 : 0.22}
              transparent
              opacity={active ? 0.76 - index * 0.13 : 0.22}
            />
          </mesh>
        ))}
      </group>
      {[-4.75, 4.75].map((x) => (
        <group key={x} position={[x, 0.4, -1.7]}>
          <mesh>
            <boxGeometry args={[0.22, 5.7, 0.22]} />
            <meshStandardMaterial color="#222a34" metalness={0.7} roughness={0.22} />
          </mesh>
          <mesh position={[x > 0 ? -0.16 : 0.16, 0.6, 0]}>
            <boxGeometry args={[0.035, 4.1, 0.05]} />
            <meshBasicMaterial color={room.secondaryColor} transparent opacity={active ? 0.85 : 0.25} />
          </mesh>
        </group>
      ))}
      {[-3.55, 0, 3.55].map((x, index) => (
        <mesh key={x} position={[x, 0.2 + index * 0.12, -3.55]}>
          <boxGeometry args={[2.85, 4.7, 0.18]} />
          <meshStandardMaterial
            color={index === 1 ? '#161d26' : '#11171f'}
            emissive={room.color}
            emissiveIntensity={index === 1 && active ? 0.08 : 0.02}
            metalness={0.25}
            roughness={0.56}
          />
        </mesh>
      ))}
    </group>
  );
}

function AcademyArchitecture({ room, active }: { room: RoomDefinition; active: boolean }) {
  const canopyRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!canopyRef.current) return;
    canopyRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.22) * (active ? 0.045 : 0.012);
  });

  return (
    <group>
      {[0, 1, 2].map((tier) => (
        <mesh key={tier} position={[0, -1.86 + tier * 0.25, 2.2 - tier * 1.35]} receiveShadow>
          <boxGeometry args={[11.8 - tier * 1.1, 0.25, 2.3]} />
          <meshStandardMaterial color={tier === 2 ? '#20252c' : '#151a20'} metalness={0.32} roughness={0.46} />
        </mesh>
      ))}
      <mesh position={[0, 0.55, -3.58]}>
        <boxGeometry args={[12.1, 5.4, 0.25]} />
        <meshStandardMaterial color="#111820" metalness={0.28} roughness={0.48} />
      </mesh>
      {[-4.3, -2.15, 0, 2.15, 4.3].map((x, index) => (
        <group key={x} position={[x, 0.7, -3.35]}>
          <mesh>
            <boxGeometry args={[1.68, 3.65 + (index % 2) * 0.42, 0.08]} />
            <meshBasicMaterial color="#18222d" transparent opacity={0.9} />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <planeGeometry args={[1.42, 3.12]} />
            <meshBasicMaterial color={index % 2 ? room.secondaryColor : room.color} transparent opacity={active ? 0.1 + index * 0.012 : 0.03} />
          </mesh>
          {[-0.95, -0.25, 0.45, 1.15].map((y, lineIndex) => (
            <mesh key={lineIndex} position={[0, y, 0.105]}>
              <planeGeometry args={[1.05 - lineIndex * 0.12, 0.018]} />
              <meshBasicMaterial color={room.secondaryColor} transparent opacity={active ? 0.72 : 0.16} />
            </mesh>
          ))}
        </group>
      ))}
      <group ref={canopyRef} position={[0, 3.42, -0.25]}>
        <mesh>
          <cylinderGeometry args={[2.35, 2.35, 0.16, 48]} />
          <meshStandardMaterial color="#111820" metalness={0.58} roughness={0.24} />
        </mesh>
        <mesh position={[0, -0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.58, 2.18, 64]} />
          <meshBasicMaterial color={room.secondaryColor} transparent opacity={active ? 0.5 : 0.12} />
        </mesh>
      </group>
      {[-5.55, 5.55].map((x) => (
        <mesh key={x} position={[x, 0.75, -0.2]}>
          <boxGeometry args={[0.24, 5.45, 6.3]} />
          <meshStandardMaterial color="#171e27" metalness={0.55} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function StudioArchitecture({ room, active }: { room: RoomDefinition; active: boolean }) {
  const gantryRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!gantryRef.current) return;
    gantryRef.current.position.x = Math.sin(clock.getElapsedTime() * 0.3) * (active ? 0.32 : 0.08);
  });

  return (
    <group>
      <mesh position={[0, -1.78, 0]} receiveShadow>
        <boxGeometry args={[12.2, 0.35, 8]} />
        <meshStandardMaterial color="#0e1218" metalness={0.46} roughness={0.44} />
      </mesh>
      <gridHelper args={[11.8, 18, room.color, '#242a32']} position={[0, -1.57, 0]} />
      <group ref={gantryRef}>
        <mesh position={[0, 3.85, -0.2]}>
          <boxGeometry args={[10.8, 0.25, 0.32]} />
          <meshStandardMaterial color="#222933" metalness={0.7} roughness={0.22} />
        </mesh>
        {[-4.9, 4.9].map((x) => (
          <mesh key={x} position={[x, 1.05, -0.2]}>
            <boxGeometry args={[0.28, 5.85, 0.32]} />
            <meshStandardMaterial color="#1b222c" metalness={0.68} roughness={0.25} />
          </mesh>
        ))}
        <mesh position={[1.55, 3.35, -0.2]}>
          <boxGeometry args={[0.85, 0.45, 0.6]} />
          <meshStandardMaterial color={room.color} emissive={room.color} emissiveIntensity={active ? 0.5 : 0.12} />
        </mesh>
      </group>
      {[-3.9, 3.9].map((x, sideIndex) => (
        <group key={x} position={[x, 0.25, -2.95]} rotation={[0, sideIndex === 0 ? 0.08 : -0.08, 0]}>
          <mesh>
            <boxGeometry args={[2.75, 4.75, 0.18]} />
            <meshStandardMaterial color="#131922" metalness={0.35} roughness={0.4} />
          </mesh>
          {[1.45, 0.45, -0.55, -1.55].map((y, index) => (
            <mesh key={y} position={[0, y, 0.12]}>
              <boxGeometry args={[2.1 - index * 0.18, 0.035, 0.04]} />
              <meshBasicMaterial color={sideIndex ? room.secondaryColor : room.color} transparent opacity={active ? 0.64 : 0.17} />
            </mesh>
          ))}
        </group>
      ))}
      {[[-2.9, 0.25, 1.5], [2.95, 1.25, 1.35], [-4.35, 2.6, 0.2], [4.15, 2.8, -0.5]].map((position, index) => (
        <mesh key={index} position={position as [number, number, number]} rotation={[0.15 * index, 0.22 * index, 0]}>
          <boxGeometry args={[0.75 + index * 0.12, 0.75 + index * 0.12, 0.08]} />
          <meshBasicMaterial color={index % 2 ? room.secondaryColor : room.color} wireframe transparent opacity={active ? 0.5 : 0.12} />
        </mesh>
      ))}
    </group>
  );
}

function LivingBuildingArchitecture({ room, active }: { room: RoomDefinition; active: boolean }) {
  const scanRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!scanRef.current) return;
    scanRef.current.position.x = -4.1 + ((clock.getElapsedTime() * (active ? 0.42 : 0.08)) % 8.2);
  });

  return (
    <group>
      <mesh position={[0, -1.8, 0]} receiveShadow>
        <boxGeometry args={[12.25, 0.38, 8.15]} />
        <meshStandardMaterial color="#101419" metalness={0.42} roughness={0.44} />
      </mesh>
      <mesh position={[0, 0.72, -3.52]} receiveShadow>
        <boxGeometry args={[12.1, 5.5, 0.28]} />
        <meshStandardMaterial color="#11161c" metalness={0.3} roughness={0.46} />
      </mesh>
      {Array.from({ length: 13 }, (_, index) => (
        <mesh key={index} position={[-5.5 + index * 0.92, 3.66, -0.05]}>
          <boxGeometry args={[0.12, 0.24, 7.4]} />
          <meshStandardMaterial color="#222831" metalness={0.62} roughness={0.24} />
        </mesh>
      ))}
      {[-5.72, 5.72].map((x) => (
        <mesh key={x} position={[x, 0.95, 0]}>
          <boxGeometry args={[0.28, 5.8, 7.55]} />
          <meshStandardMaterial color="#151b22" metalness={0.52} roughness={0.32} />
        </mesh>
      ))}
      <group ref={scanRef} position={[-4.1, 0.5, -3.3]}>
        <mesh>
          <planeGeometry args={[0.035, 4.2]} />
          <meshBasicMaterial color={room.secondaryColor} transparent opacity={active ? 0.72 : 0.12} />
        </mesh>
        <pointLight color={room.secondaryColor} intensity={active ? 1.9 : 0.2} distance={2.8} />
      </group>
      <mesh position={[-5.33, 0.6, -2.9]}>
        <boxGeometry args={[0.5, 4.2, 1.2]} />
        <meshStandardMaterial color="#173021" roughness={0.72} />
      </mesh>
      <mesh position={[5.1, 0.7, -2.9]}>
        <boxGeometry args={[1.45, 4.35, 1.05]} />
        <meshStandardMaterial color="#171c22" metalness={0.45} roughness={0.38} />
      </mesh>
    </group>
  );
}

function NeighborhoodArchitecture({ room, active }: { room: RoomDefinition; active: boolean }) {
  const scanRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!scanRef.current) return;
    const time = clock.getElapsedTime();
    scanRef.current.position.z = -2.85 + ((time * (active ? 0.34 : 0.06)) % 5.7);
  });

  return (
    <group>
      <mesh position={[0, -1.8, 0]} receiveShadow>
        <boxGeometry args={[12.25, 0.38, 8.15]} />
        <meshStandardMaterial color="#111712" metalness={0.28} roughness={0.58} />
      </mesh>
      <gridHelper args={[11.8, 20, room.color, '#263027']} position={[0, -1.58, 0]} />
      <mesh position={[0, 0.72, -3.52]}>
        <boxGeometry args={[12.1, 5.5, 0.28]} />
        <meshStandardMaterial color="#121914" metalness={0.22} roughness={0.58} />
      </mesh>
      <mesh position={[0, 0.75, -3.34]}>
        <planeGeometry args={[7.2, 3.5, 12, 8]} />
        <meshBasicMaterial color={room.color} wireframe transparent opacity={active ? 0.18 : 0.04} />
      </mesh>
      {[-5.72, 5.72].map((x) => (
        <mesh key={x} position={[x, 0.95, 0]}>
          <boxGeometry args={[0.3, 5.8, 7.6]} />
          <meshStandardMaterial color="#182019" metalness={0.38} roughness={0.46} />
        </mesh>
      ))}
      {Array.from({ length: 8 }, (_, index) => (
        <mesh key={index} position={[-4.9 + index * 1.4, 3.72, 0]}>
          <boxGeometry args={[0.12, 0.24, 7.35]} />
          <meshStandardMaterial color={index % 2 ? '#29352b' : '#202a22'} metalness={0.35} roughness={0.42} />
        </mesh>
      ))}
      <group ref={scanRef} position={[0, 0.4, -2.85]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <planeGeometry args={[0.035, 9.4]} />
          <meshBasicMaterial color={room.secondaryColor} transparent opacity={active ? 0.68 : 0.1} />
        </mesh>
        <pointLight color={room.secondaryColor} intensity={active ? 1.5 : 0.15} distance={2.4} />
      </group>
      {[-4.95, 4.95].map((x) => (
        <group key={x} position={[x, -0.22, -2.85]}>
          <mesh>
            <boxGeometry args={[0.58, 2.7, 0.62]} />
            <meshStandardMaterial color="#17301f" roughness={0.78} />
          </mesh>
          <mesh position={[0, 1.55, 0]}>
            <sphereGeometry args={[0.52, 14, 10]} />
            <meshStandardMaterial color="#3d7d49" roughness={0.82} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function GenericLabArchitecture({ room, active }: { room: RoomDefinition; active: boolean }) {
  const accentCount = Number.parseInt(room.id, 10) % 3 + 3;

  return (
    <group>
      <mesh position={[0, -1.82, 0]} receiveShadow>
        <boxGeometry args={[12.3, 0.38, 8.2]} />
        <meshStandardMaterial color="#0e1319" metalness={0.46} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.8, -3.55]} receiveShadow>
        <boxGeometry args={[12.2, 5.55, 0.3]} />
        <meshStandardMaterial color="#10161e" metalness={0.28} roughness={0.52} />
      </mesh>
      {Array.from({ length: accentCount }, (_, index) => {
        const x = (index - (accentCount - 1) / 2) * (9.2 / Math.max(1, accentCount - 1));
        return (
          <mesh key={index} position={[x, 0.7, -3.34]}>
            <planeGeometry args={[0.08, 4.1 - (index % 2) * 0.65]} />
            <meshBasicMaterial color={index % 2 ? room.secondaryColor : room.color} transparent opacity={active ? 0.58 : 0.14} />
          </mesh>
        );
      })}
      {[-5.75, 5.75].map((x) => (
        <mesh key={x} position={[x, 0.95, 0]}>
          <boxGeometry args={[0.3, 5.8, 7.6]} />
          <meshStandardMaterial color="#151b23" metalness={0.52} roughness={0.32} />
        </mesh>
      ))}
      <mesh position={[0, 3.78, 0]}>
        <boxGeometry args={[11.8, 0.22, 7.4]} />
        <meshStandardMaterial color="#171e27" metalness={0.58} roughness={0.25} />
      </mesh>
    </group>
  );
}

export function RoomArchitecture({ room, active }: { room: RoomDefinition; active: boolean }) {
  if (room.architecture === 'gallery') return <GalleryArchitecture room={room} active={active} />;
  if (room.architecture === 'academy') return <AcademyArchitecture room={room} active={active} />;
  if (room.architecture === 'studio') return <StudioArchitecture room={room} active={active} />;
  if (room.architecture === 'living-building') return <LivingBuildingArchitecture room={room} active={active} />;
  if (room.architecture === 'neighborhood') return <NeighborhoodArchitecture room={room} active={active} />;
  return <GenericLabArchitecture room={room} active={active} />;
}

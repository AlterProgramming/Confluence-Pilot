import type { ReactNode } from 'react';
import type { RoomDefinition } from '../types/room';

type V3 = [number, number, number];
type StructureProps = {
  at: V3;
  size: V3;
  color?: string;
  glow?: string;
  intensity?: number;
  opacity?: number;
  rotation?: V3;
};

function Structure({ at, size, color = '#252d37', glow = '#000000', intensity = 0, opacity = 1, rotation = [0, 0, 0] }: StructureProps) {
  return (
    <mesh position={at} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        metalness={0.48}
        roughness={0.36}
        emissive={glow}
        emissiveIntensity={intensity}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}

function Grouped({ children }: { children: ReactNode }) {
  return <group>{children}</group>;
}

/**
 * Room 06-12's authored program identities.
 * All objects are deterministic geometry, in room-local coordinates. The floor is
 * at approximately y=-1.6; the navigation/camera system owns world placement.
 * These remain visible even when a future authored GLB cannot be loaded.
 */
export function ProgramFixtures({ room, active }: { room: RoomDefinition; active: boolean }) {
  const light = active ? 0.48 : 0.08;
  const accent = room.color;
  const secondary = room.secondaryColor;

  switch (room.architecture) {
    case 'infrastructure':
      return (
        <Grouped>
          {/* A walkable scale bridge on engineering pedestals. */}
          {[-1, 1].map((side) => (
            <group key={side}>
              <Structure at={[0, -0.25, side * 1.15]} size={[8.8, 0.13, 0.17]} color="#a1acb6" />
              {Array.from({ length: 7 }, (_, i) => (
                <group key={i}>
                  <Structure at={[-3.9 + i * 1.3, 0.45, side * 1.15]} size={[0.13, 1.4, 0.13]} color="#6f7d8c" />
                  {i < 6 && <Structure at={[-3.25 + i * 1.3, 0.95, side * 1.15]} size={[1.62, 0.11, 0.11]} rotation={[0, 0, i % 2 ? -0.75 : 0.75]} color={secondary} />}
                </group>
              ))}
            </group>
          ))}
          <Structure at={[0, -0.38, 0]} size={[8.75, 0.12, 2.4]} color="#505b64" />
          {[-3.8, 3.8].map((x) => <Structure key={x} at={[x, -1.08, 0]} size={[0.46, 1.05, 2.7]} color="#737f8b" />)}
          <Structure at={[0, -0.28, 0]} size={[8.4, 0.025, 0.08]} glow={accent} color={accent} intensity={light} />
        </Grouped>
      );

    case 'vault':
      return (
        <Grouped>
          {/* Evaluation core, guarded by physically separated server banks. */}
          {[-4.25, 4.25].map((x) => (
            <group key={x}>
              {Array.from({ length: 5 }, (_, i) => (
                <group key={i}>
                  <Structure at={[x, -0.42, -2.2 + i * 1.02]} size={[1.0, 2.25, 0.79]} color="#151b2a" />
                  {Array.from({ length: 5 }, (_, j) => (
                    <Structure key={j} at={[x + (x < 0 ? 0.514 : -0.514), -1.25 + j * 0.35, -2.2 + i * 1.02]} size={[0.025, 0.055, 0.5]} color={secondary} glow={accent} intensity={light} />
                  ))}
                </group>
              ))}
            </group>
          ))}
          <Structure at={[0, -0.76, -0.3]} size={[3.0, 1.4, 3.0]} color="#18253a" />
          <Structure at={[0, 0.18, -0.3]} size={[2.25, 0.25, 2.25]} color={secondary} glow={accent} intensity={light} />
          <Structure at={[0, 0.85, -0.3]} size={[1.46, 1.1, 1.46]} color={secondary} opacity={0.24} glow={accent} intensity={light * 0.6} />
        </Grouped>
      );

    case 'hangar':
      return (
        <Grouped>
          {/* Runway markings, three maintenance bays and suspended drone frames. */}
          <Structure at={[0, -1.56, -0.2]} size={[5.4, 0.035, 6.7]} color="#313e4c" />
          {Array.from({ length: 6 }, (_, i) => <Structure key={i} at={[0, -1.52, -3.0 + i * 1.05]} size={[0.13, 0.012, 0.56]} color="#e2ebef" />)}
          {[-3.7, 3.7].map((x) => (
            <group key={x}>
              <Structure at={[x, -1.39, 0]} size={[1.75, 0.17, 3.0]} color="#253747" />
              <Structure at={[x, -0.8, 0]} size={[1.2, 0.28, 1.65]} color={secondary} glow={accent} intensity={light * 0.5} />
            </group>
          ))}
          {[-2, 0, 2].map((z) => (
            <group key={z} position={[0, 0.18, z]}>
              <Structure at={[0, 0, 0]} size={[0.86, 0.26, 0.48]} color="#e4edf1" />
              <Structure at={[0, 0, 0]} size={[2.5, 0.07, 0.13]} color="#687d90" />
              <Structure at={[0, 0, 0]} size={[0.13, 0.07, 1.35]} color="#687d90" />
              {[-1.17, 1.17].map((x) => <Structure key={x} at={[x, 0.14, 0]} size={[0.65, 0.028, 0.65]} color={secondary} opacity={0.6} />)}
            </group>
          ))}
        </Grouped>
      );

    case 'communications':
      return (
        <Grouped>
          {/* Distinct relay masts, network cabinets and signal-path light bars. */}
          {[-3.6, 0, 3.6].map((x, i) => (
            <group key={x}>
              <Structure at={[x, -0.78, -0.35]} size={[1.18, 1.1, 1.18]} color="#202936" />
              <Structure at={[x, 0.95, -0.35]} size={[0.13, 2.7 + i * 0.45, 0.13]} color="#a2b4c6" />
              {[-0.55, 0.55].map((offset) => (
                <Structure key={offset} at={[x + offset, 1.06, -0.35]} size={[0.15, 1.95, 0.11]} rotation={[0, 0, offset < 0 ? -0.35 : 0.35]} color={secondary} />
              ))}
              <Structure at={[x, 2.05, -0.35]} size={[1.2, 0.075, 0.075]} color={accent} glow={accent} intensity={light} />
            </group>
          ))}
          {Array.from({ length: 5 }, (_, i) => <Structure key={i} at={[-4.2 + i * 2.1, -1.0, 2.3]} size={[1.25, 1.0, 0.75]} color="#151c27" />)}
          <Structure at={[0, -1.45, 1.55]} size={[9.5, 0.035, 0.11]} color={secondary} glow={accent} intensity={light} />
        </Grouped>
      );

    case 'cold-chain':
      return (
        <Grouped>
          {/* Temperature-controlled storage and a central traceability conveyor. */}
          {[-3.9, 3.9].map((x) => (
            <group key={x}>
              {[-2.4, -0.6, 1.2].map((z) => (
                <group key={z}>
                  <Structure at={[x, -0.22, z]} size={[1.85, 2.65, 1.35]} color="#d5e5e9" />
                  {[-0.95, -0.17, 0.6].map((y) => (
                    <Structure key={y} at={[x + (x < 0 ? 0.94 : -0.94), y, z]} size={[0.045, 0.08, 1.05]} color={secondary} glow={accent} intensity={light} />
                  ))}
                </group>
              ))}
            </group>
          ))}
          <Structure at={[0, -0.98, -0.35]} size={[2.55, 0.32, 6.3]} color="#24333a" />
          {Array.from({ length: 7 }, (_, i) => <Structure key={i} at={[0, -0.78, -3.0 + i * 0.88]} size={[1.8, 0.055, 0.33]} color="#8ca6ad" />)}
          {[-3.0, 3.0].map((z) => <Structure key={z} at={[0, -0.67, z]} size={[1.25, 0.32, 0.7]} color={secondary} />)}
        </Grouped>
      );

    case 'fintech':
      return (
        <Grouped>
          {/* Paired audit desks surrounding a transparent risk-monitoring model. */}
          {[-3.6, 3.6].map((x) => (
            <group key={x}>
              {[-1.9, 0, 1.9].map((z) => (
                <group key={z}>
                  <Structure at={[x, -0.85, z]} size={[1.7, 0.16, 0.93]} color="#3b3444" />
                  <Structure at={[x, -0.3, z - 0.29]} size={[1.05, 0.78, 0.08]} color="#101521" />
                  <Structure at={[x, -0.3, z - 0.24]} size={[0.92, 0.64, 0.016]} color={secondary} glow={accent} intensity={light} />
                </group>
              ))}
            </group>
          ))}
          <Structure at={[0, -1.0, -0.15]} size={[2.45, 0.4, 3.55]} color="#242330" />
          {Array.from({ length: 9 }, (_, i) => {
            const height = 0.3 + (i * 7 % 6) * 0.22;
            return <Structure key={i} at={[-0.92 + i * 0.23, -0.65 + height / 2, -0.15]} size={[0.14, height, 0.45]} color={secondary} glow={accent} intensity={light} />;
          })}
        </Grouped>
      );

    case 'main-street':
      return (
        <Grouped>
          {/* Three small storefronts with individual service counters. */}
          {[-3.65, 0, 3.65].map((x, i) => (
            <group key={x}>
              <Structure at={[x, -0.45, -1.85]} size={[3.1, 2.2, 0.22]} color={i % 2 ? '#26323a' : '#3c3132'} />
              <Structure at={[x, 0.9, -1.45]} size={[3.2, 0.48, 0.95]} color={secondary} />
              <Structure at={[x, -0.57, -0.65]} size={[2.85, 0.15, 0.87]} color="#767a77" />
              <Structure at={[x, -1.12, -0.65]} size={[0.14, 0.95, 0.8]} color="#303740" />
              <Structure at={[x, -0.2, -1.72]} size={[1.85, 0.66, 0.06]} color={accent} glow={accent} intensity={light} opacity={0.7} />
              <Structure at={[x, -1.51, 1.5]} size={[2.8, 0.025, 0.15]} color={secondary} />
            </group>
          ))}
        </Grouped>
      );

    default:
      return null;
  }
}

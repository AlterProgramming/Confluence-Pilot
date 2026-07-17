import type { RoomDefinition } from '../types/room';
import { RoomShell } from './kit/RoomShell';
import { LedWall } from './kit/LedWall';
import { Seating } from './kit/Seating';
import { Glazing } from './kit/Glazing';
import { CeilingRig } from './kit/CeilingRig';

/** A low presentation dais ring around the centrepiece. */
function Dais({ accent }: { accent: string }) {
  return (
    <group position={[0, -1.44, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.45, 2.05, 64]} />
        <meshStandardMaterial color="#5b4637" metalness={0.08} roughness={0.72} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <ringGeometry args={[1.98, 2.08, 64]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.16} roughness={0.5} />
      </mesh>
    </group>
  );
}

function ExhibitPod({
  position,
  accent,
  tall = false,
}: {
  position: [number, number, number];
  accent: string;
  tall?: boolean;
}) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.05, tall ? 1.5 : 1.15, 1.05]} />
        <meshStandardMaterial color="#afa69b" roughness={0.72} metalness={0.04} />
      </mesh>
      <mesh position={[0, tall ? 0.9 : 0.72, 0]} castShadow>
        <icosahedronGeometry args={[0.32, 1]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.14} roughness={0.42} metalness={0.24} />
      </mesh>
      <pointLight color={accent} intensity={0.16} distance={2.6} decay={2} position={[0, tall ? 1.0 : 0.82, 0.5]} />
    </group>
  );
}

function SideExhibits({ accent }: { accent: string }) {
  return (
    <group>
      <ExhibitPod position={[6.15, -0.7, -2.45]} accent={accent} tall />
      <ExhibitPod position={[6.15, -0.87, -0.75]} accent={accent} />
    </group>
  );
}

/** Room 01 — Confluence Forum & AI Experience Gallery: warm forum with a curved
 * LED wall, tiered seating, daylight windows, and a secondary exhibit zone. */
export function GalleryForum({ room }: { room: RoomDefinition; active: boolean }) {
  return (
    <group>
      <RoomShell
        width={17}
        depth={16}
        height={6.4}
        floor="wood-floor"
        wall="plaster"
        wallColor="#e8ddcb"
        ceilingColor="#efe8da"
        floorRepeat={[5, 5]}
        floorRoughness={0.7}
      />
      <LedWall url="/assets/screens/room-01-wall-art.svg" radius={7.55} arc={1.78} height={3.55} y={1.45} />
      <Seating
        baseRadius={4.45}
        rows={3}
        rowGap={1.18}
        riseGap={0.32}
        span={1.82}
        perRow={7}
        perRowGrowth={2}
        centerAisle={0.11}
      />
      <Glazing side="left" x={8.0} width={12} />
      <CeilingRig y={4.7} accent={room.color} />
      <Dais accent={room.color} />
      <SideExhibits accent={room.secondaryColor} />
    </group>
  );
}

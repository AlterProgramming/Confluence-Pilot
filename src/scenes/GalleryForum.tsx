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
        <ringGeometry args={[1.7, 2.4, 64]} />
        <meshStandardMaterial color="#231810" metalness={0.35} roughness={0.35} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[2.32, 2.42, 64]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Room 01 — Confluence Forum & AI Experience Gallery: warm forum with a curved
 *  LED wall, tiered seating, daylight windows, wood floor, warm plaster walls. */
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
      <LedWall url="/assets/screens/room-01-wall.webp" radius={8.4} arc={2.3} height={4.4} y={1.55} />
      <Seating baseRadius={3.9} rows={3} />
      <Glazing side="left" x={8.0} width={12} />
      <CeilingRig y={4.7} accent={room.color} />
      <Dais accent={room.color} />
    </group>
  );
}

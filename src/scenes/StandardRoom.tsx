import type { RoomDefinition } from '../types/room';
import { RoomShell } from './kit/RoomShell';
import { LedWall } from './kit/LedWall';
import { CeilingRig } from './kit/CeilingRig';
import { Glazing } from './kit/Glazing';
import { defaultConfig, sceneConfigs } from './sceneConfigs';

/** Low presentation dais ring under the centrepiece. */
function Dais({ accent }: { accent: string }) {
  return (
    <group position={[0, -1.44, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.7, 2.4, 64]} />
        <meshStandardMaterial color="#1a1e26" metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[2.32, 2.42, 64]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
    </group>
  );
}

/**
 * Config-driven room: real PBR shell (floor/walls/ceiling) + optional curved LED
 * wall + ceiling light rig + optional daylight windows + a dais under the hero.
 * Used for every room except the fully bespoke Room 01.
 */
export function StandardRoom({ room }: { room: RoomDefinition; active: boolean }) {
  const cfg = sceneConfigs[room.id] ?? defaultConfig;
  return (
    <group>
      <RoomShell
        width={16}
        depth={15}
        height={6.2}
        floor={cfg.floor}
        wall={cfg.wall}
        wallColor={cfg.wallColor}
        floorRepeat={cfg.floorRepeat}
        floorRoughness={cfg.floorRoughness}
      />
      {cfg.ledWall && <LedWall url={cfg.ledWall} radius={8.2} arc={2.2} height={4.2} y={1.5} />}
      {cfg.glazing && <Glazing side={cfg.glazing} x={7.6} width={11} />}
      <CeilingRig y={4.5} accent={room.color} />
      <Dais accent={room.color} />
    </group>
  );
}

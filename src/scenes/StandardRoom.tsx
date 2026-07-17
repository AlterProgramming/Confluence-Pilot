import { Suspense } from 'react';
import type { RoomDefinition } from '../types/room';
import { useExperienceStore } from '../state/useExperienceStore';
import { RoomShell } from './kit/RoomShell';
import { LedWall } from './kit/LedWall';
import { CeilingRig } from './kit/CeilingRig';
import { Glazing } from './kit/Glazing';
import { Platform } from './kit/Furnishings';
import { CeilingPendants, Lounge, ReceptionZone, Workstations } from './kit/Furniture';
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
export function StandardRoom({ room, active }: { room: RoomDefinition; active: boolean }) {
  const cfg = sceneConfigs[room.id] ?? defaultConfig;
  const layout = cfg.layout ?? 'default';
  const low = useExperienceStore((s) => s.qualityTier) === 'low';
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
      {cfg.glazing && !low && <Glazing side={cfg.glazing} x={7.6} width={11} />}
      <CeilingRig y={4.5} accent={room.color} />
      {/* Real overhead pendant fixtures so the ceiling reads inhabited (a repeated
          complaint that rooms 2-12 "gruesomely lack" ceilings). Cheap Clones,
          dropped on the low tier. */}
      {!low && (
        <Suspense fallback={null}>
          <CeilingPendants />
        </Suspense>
      )}

      {/* Layout-specific furnishing with real CC0 furniture. Heavy layers mount
          only for the active/destination room and thin out on the low tier. */}
      {layout === 'platform' && <Platform accent={room.color} />}
      {layout !== 'platform' && <Dais accent={room.color} />}
      {/* Furniture uses drei <Clone> (shared geometry/materials), so mounting is
          cheap; gated to the active/destination room to keep idle light. */}
      {active && (
        <Suspense fallback={null}>
          {layout === 'workbenches' && (
            <Workstations accent={room.color} secondary={room.secondaryColor} rows={low ? 1 : 2} perRow={low ? 2 : 3} />
          )}
          {layout === 'default' && <Lounge />}
          {!low && <ReceptionZone side={cfg.glazing === 'right' ? 'left' : 'right'} />}
        </Suspense>
      )}
    </group>
  );
}

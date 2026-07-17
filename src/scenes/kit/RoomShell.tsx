import { DoubleSide } from 'three';
import type { MaterialName } from '../../materials/catalog';
import { usePbr } from '../../materials/usePbr';

type ShellProps = {
  width?: number;
  depth?: number;
  height?: number;
  floorY?: number;
  floor?: MaterialName;
  wall?: MaterialName;
  ceiling?: MaterialName;
  floorRepeat?: [number, number];
  wallRepeat?: [number, number];
  floorRoughness?: number;
  wallColor?: string;
  ceilingColor?: string;
  backWall?: boolean;
  sideWalls?: boolean;
  ceilingOn?: boolean;
};

/**
 * Real PBR-textured room shell: floor + back wall + side walls + ceiling.
 * Front (camera side) is left open. Materials come from the CC0 catalog and are
 * lit by the global <Environment> IBL. This replaces the procedural primitives.
 */
export function RoomShell({
  width = 16,
  depth = 15,
  height = 6.2,
  floorY = -1.5,
  floor = 'wood-floor',
  wall = 'plaster',
  ceiling = 'plaster',
  floorRepeat,
  wallRepeat,
  floorRoughness,
  wallColor,
  ceilingColor = '#e9e9ec',
  backWall = true,
  sideWalls = true,
  ceilingOn = true,
}: ShellProps) {
  const floorMat = usePbr(floor, floorRepeat, floorRoughness != null ? { roughness: floorRoughness } : undefined);
  const wallMat = usePbr(wall, wallRepeat, wallColor ? { color: wallColor } : undefined);
  const ceilMat = usePbr(ceiling, [4, 3], { color: ceilingColor });
  wallMat.side = DoubleSide;
  ceilMat.side = DoubleSide;

  const topY = floorY + height;

  return (
    <group>
      <mesh position={[0, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]} material={floorMat} receiveShadow>
        <planeGeometry args={[width, depth]} />
      </mesh>

      {backWall && (
        <mesh position={[0, floorY + height / 2, -depth / 2]} material={wallMat} receiveShadow>
          <planeGeometry args={[width, height]} />
        </mesh>
      )}

      {sideWalls &&
        [-1, 1].map((side) => (
          <mesh
            key={side}
            position={[(side * width) / 2, floorY + height / 2, 0]}
            rotation={[0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}
            material={wallMat}
            receiveShadow
          >
            <planeGeometry args={[depth, height]} />
          </mesh>
        ))}

      {ceilingOn && (
        <mesh position={[0, topY, 0]} rotation={[Math.PI / 2, 0, 0]} material={ceilMat}>
          <planeGeometry args={[width, depth]} />
        </mesh>
      )}
    </group>
  );
}

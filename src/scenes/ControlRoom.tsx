import type { RoomDefinition } from '../types/room';
import { RoomShell } from './kit/RoomShell';
import { LedWall } from './kit/LedWall';
import { CeilingFan, FurnitureItem, Workstations } from './kit/Furniture';

/** Room 04 — Living AI Building & Smart Infrastructure Lab. A dark industrial
 *  operations room: a large curved data-viz wall, operator stations facing it,
 *  a central ops table, planters (living building), and teal accent lighting. */
export function ControlRoom({ room }: { room: RoomDefinition; active: boolean }) {
  return (
    <group>
      <RoomShell
        width={17}
        depth={16}
        height={6.4}
        floor="metal-panel"
        wall="concrete"
        wallColor="#454b54"
        ceilingColor="#2c313a"
        floorRepeat={[4, 4]}
        floorRoughness={0.5}
      />

      {/* Big curved operations data wall. */}
      <LedWall url="/assets/screens/room-04-wall.webp" radius={8.7} arc={2.55} height={4.7} y={1.75} />

      {/* Operator stations facing the wall (front rows, clear of the centre hero). */}
      <Workstations accent={room.color} secondary={room.secondaryColor} rows={2} perRow={3} />

      {/* Slowly turning ceiling fans — real overhead motion so the ops room reads
          alive, not frozen. Ceiling is at floorY(-1.5)+height(6.4) = 4.9. */}
      <CeilingFan ceilingY={4.86} position={[-4.6, 1.4]} scale={1.35} speed={0.7} />
      <CeilingFan ceilingY={4.86} position={[4.6, 1.4]} scale={1.35} speed={0.62} />

      {/* Central ops table in front of the hero. */}
      <FurnitureItem asset="table" position={[0, -1.5, 3.4]} scale={1.15} />

      {/* Planters (living building) + side cabinet. */}
      <FurnitureItem asset="planter" position={[-6.4, -1.5, 3.6]} scale={1.15} />
      <FurnitureItem asset="planter" position={[6.4, -1.5, 3.6]} scale={1.15} />
      <FurnitureItem asset="cabinet" position={[6.3, -1.5, -1.2]} rotationY={-Math.PI / 2} />

      {/* Dais under the centre hero. */}
      <mesh position={[0, -1.48, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.7, 2.35, 64]} />
        <meshStandardMaterial color="#12161d" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[0, -1.46, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.28, 2.4, 64]} />
        <meshBasicMaterial color={room.color} toneMapped={false} />
      </mesh>

      {/* Teal accent + rim lighting for the industrial mood. */}
      <pointLight color={room.color} intensity={2.4} distance={16} decay={2} position={[0, 3.4, 5]} />
      <pointLight color={room.secondaryColor} intensity={1.8} distance={14} decay={2} position={[0, 3.9, -4]} />
    </group>
  );
}

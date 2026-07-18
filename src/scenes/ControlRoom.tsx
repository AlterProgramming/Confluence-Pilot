import type { RoomDefinition } from '../types/room';
import { RoomShell } from './kit/RoomShell';
import { LedWall } from './kit/LedWall';
import { CeilingFan, FurnitureItem, Workstations } from './kit/Furniture';

const SENSOR_COLUMN_Z = [-3.7, -1.1, 1.5, 4.1] as const;
const HVAC_VENT_Z = [-5.4, -2.4, 0.6, 3.6] as const;
const TOWER_FLOORS = [0, 1, 2, 3] as const;
const TELEMETRY_ROWS = [0, 1, 2] as const;

/** Room 04 - Living AI Building & Smart Infrastructure Lab. A dark industrial
 * operations room with a curved data-viz wall, operator stations, central ops
 * table, living-building planters, and visible smart-building control cues. */
export function ControlRoom({ room }: { room: RoomDefinition; active: boolean }) {
  return (
    <group name="room-04-control-room">
      <group name="industrial-shell">
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
      </group>

      <group name="curved-operations-data-wall">
        <LedWall url="/assets/screens/room-04-wall.webp" radius={8.7} arc={2.55} height={4.7} y={1.75} />
      </group>

      <group name="operator-workstations">
        <Workstations accent={room.color} secondary={room.secondaryColor} rows={2} perRow={3} />
      </group>

      <group name="hvac-and-airflow-control">
        <mesh name="main-hvac-duct" position={[0, 4.64, 0]} castShadow={false} receiveShadow={false}>
          <boxGeometry args={[2.6, 0.18, 13.4]} />
          <meshStandardMaterial color="#343a42" metalness={0.62} roughness={0.42} />
        </mesh>
        {HVAC_VENT_Z.map((z, index) => (
          <mesh key={z} name={`supply-vent-${index + 1}`} position={[0, 4.53, z]} castShadow={false}>
            <boxGeometry args={[2.1, 0.035, 0.24]} />
            <meshStandardMaterial color="#151a20" metalness={0.45} roughness={0.5} />
          </mesh>
        ))}
        {/* Ceiling is at floorY(-1.5)+height(6.4) = 4.9. Fans stay clear of the duct. */}
        <CeilingFan ceilingY={4.86} position={[-4.6, 1.4]} scale={1.35} speed={0.7} />
        <CeilingFan ceilingY={4.86} position={[4.6, 1.4]} scale={1.35} speed={0.62} />
      </group>

      <group name="central-ops-table">
        <FurnitureItem asset="table" position={[0, -1.5, 3.4]} scale={1.15} />
        <group name="procedural-building-digital-twin" position={[0, -0.62, 3.4]}>
          <mesh name="twin-base" position={[0, 0.02, 0]} castShadow>
            <cylinderGeometry args={[0.58, 0.7, 0.08, 24]} />
            <meshStandardMaterial color="#11171d" metalness={0.5} roughness={0.35} />
          </mesh>
          {TOWER_FLOORS.map((floor) => (
            <mesh key={floor} name={`twin-floor-${floor + 1}`} position={[0, 0.2 + floor * 0.28, 0]} castShadow>
              <boxGeometry args={[0.52 - floor * 0.045, 0.18, 0.42 - floor * 0.035]} />
              <meshStandardMaterial color="#27313a" metalness={0.38} roughness={0.48} />
            </mesh>
          ))}
          {[-0.23, 0.23].map((x) => (
            <mesh key={x} name={`twin-sensor-riser-${x > 0 ? 'east' : 'west'}`} position={[x, 0.64, 0.24]}>
              <cylinderGeometry args={[0.018, 0.018, 0.9, 8]} />
              <meshBasicMaterial color={room.color} toneMapped={false} />
            </mesh>
          ))}
          <mesh name="twin-rooftop-node" position={[0, 1.31, 0]}>
            <sphereGeometry args={[0.09, 16, 12]} />
            <meshBasicMaterial color={room.secondaryColor} toneMapped={false} />
          </mesh>
        </group>
      </group>

      <group name="living-building-planters">
        <FurnitureItem asset="planter" position={[-6.4, -1.5, 3.6]} scale={1.15} />
        <FurnitureItem asset="planter" position={[6.4, -1.5, 3.6]} scale={1.15} />
      </group>

      <group name="building-management-cabinet">
        <FurnitureItem asset="cabinet" position={[6.3, -1.5, -1.2]} rotationY={-Math.PI / 2} />
        <mesh name="cabinet-status-screen" position={[6.18, 0.1, -1.2]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[0.78, 0.46]} />
          <meshBasicMaterial color={room.secondaryColor} toneMapped={false} />
        </mesh>
        {TELEMETRY_ROWS.map((row) => (
          <mesh
            key={row}
            name={`cabinet-telemetry-bar-${row + 1}`}
            position={[6.16, -0.08 - row * 0.13, -1.2]}
            rotation={[0, -Math.PI / 2, 0]}
          >
            <planeGeometry args={[0.56 - row * 0.1, 0.035]} />
            <meshBasicMaterial color={row === 1 ? room.color : '#7fd0c2'} toneMapped={false} />
          </mesh>
        ))}
      </group>

      <group name="sensor-column-array">
        {SENSOR_COLUMN_Z.map((z, index) => (
          <group key={z} name={`sensor-column-${index + 1}`} position={[-7.55, 0.55, z]}>
            <mesh name="sensor-column-body" castShadow>
              <boxGeometry args={[0.16, 3.9, 0.16]} />
              <meshStandardMaterial color="#252b32" metalness={0.64} roughness={0.34} />
            </mesh>
            <mesh name="sensor-status-light" position={[0.084, 1.72, 0]}>
              <sphereGeometry args={[0.055, 12, 8]} />
              <meshBasicMaterial color={index % 2 === 0 ? room.color : room.secondaryColor} toneMapped={false} />
            </mesh>
            <mesh name="sensor-label-plate" position={[0.088, 0.84, 0]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[0.5, 0.12]} />
              <meshStandardMaterial color="#8aa4aa" metalness={0.25} roughness={0.52} />
            </mesh>
          </group>
        ))}
      </group>

      <group name="hero-dais">
        <mesh name="dais-fill" position={[0, -1.48, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.7, 2.35, 64]} />
          <meshStandardMaterial color="#12161d" metalness={0.5} roughness={0.35} />
        </mesh>
        <mesh name="dais-accent-ring" position={[0, -1.46, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.28, 2.4, 64]} />
          <meshBasicMaterial color={room.color} toneMapped={false} />
        </mesh>
      </group>

      <group name="teal-industrial-lighting">
        <pointLight name="front-teal-key" color={room.color} intensity={2.4} distance={16} decay={2} position={[0, 3.4, 5]} />
        <pointLight name="rear-teal-fill" color={room.secondaryColor} intensity={1.8} distance={14} decay={2} position={[0, 3.9, -4]} />
      </group>
    </group>
  );
}

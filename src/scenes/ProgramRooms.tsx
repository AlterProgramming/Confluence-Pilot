import type { ReactNode } from 'react';
import type { RoomDefinition } from '../types/room';
import { useExperienceStore } from '../state/useExperienceStore';
import { RoomShell } from './kit/RoomShell';
import { LedWall } from './kit/LedWall';
import { CeilingRig } from './kit/CeilingRig';
import { Glazing } from './kit/Glazing';
import { Platform, Workbenches } from './kit/Furnishings';
import type { MaterialName } from '../materials/catalog';

export type ProgramRoomProps = { room: RoomDefinition; active: boolean };

type Profile = {
  floor: MaterialName;
  wall: MaterialName;
  wallColor: string;
  ledWall: string;
  glazing?: 'left' | 'right';
  width?: number;
  depth?: number;
  height?: number;
};

const profiles: Record<string, Profile> = {
  '02': { floor: 'wood-floor', wall: 'plaster', wallColor: '#e7dccb', ledWall: '/assets/screens/room-02-wall.webp', glazing: 'left' },
  '03': { floor: 'concrete', wall: 'plaster', wallColor: '#dcdfe4', ledWall: '/assets/screens/room-03-wall.webp', width: 17 },
  '05': { floor: 'concrete', wall: 'concrete', wallColor: '#b2b8c0', ledWall: '/assets/screens/room-05-wall.webp', width: 17, depth: 16 },
  '06': { floor: 'concrete', wall: 'metal-panel', wallColor: '#c8ccd0', ledWall: '/assets/screens/room-06-wall.webp', width: 18 },
  '07': { floor: 'metal-panel', wall: 'concrete', wallColor: '#bac0cc', ledWall: '/assets/screens/room-07-wall.webp' },
  '08': { floor: 'concrete', wall: 'metal-panel', wallColor: '#c6ced6', ledWall: '/assets/screens/room-08-wall.webp', width: 19, depth: 17, height: 7 },
  '09': { floor: 'metal-panel', wall: 'plaster', wallColor: '#d8dae2', ledWall: '/assets/screens/room-09-wall.webp', width: 17 },
  '10': { floor: 'metal-panel', wall: 'metal-panel', wallColor: '#ccd2d8', ledWall: '/assets/screens/room-10-wall.webp', width: 17 },
  '11': { floor: 'marble', wall: 'marble', wallColor: '#ece9e4', ledWall: '/assets/screens/room-11-wall.webp', glazing: 'right' },
  '12': { floor: 'wood-floor', wall: 'plaster', wallColor: '#ece0cd', ledWall: '/assets/screens/room-12-wall.webp', glazing: 'left', width: 18 },
};

function AccentStrip({ position, scale, color }: { position: [number, number, number]; scale: [number, number, number]; color: string }) {
  return (
    <mesh position={position} scale={scale}>
      <boxGeometry />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} roughness={0.48} />
    </mesh>
  );
}

function FramedPanel({ position, rotation = [0, 0, 0], color, width = 1.5, height = 1 }: {
  position: [number, number, number];
  rotation?: [number, number, number];
  color: string;
  width?: number;
  height?: number;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, 0.1]} />
        <meshStandardMaterial color="#2c3138" metalness={0.24} roughness={0.48} />
      </mesh>
      <mesh position={[0, 0, 0.065]}>
        <boxGeometry args={[width - 0.16, height - 0.16, 0.035]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.1} roughness={0.62} />
      </mesh>
    </group>
  );
}

function ProgramShell({ room, active, children }: ProgramRoomProps & { children: ReactNode }) {
  const profile = profiles[room.id];
  const low = useExperienceStore((state) => state.qualityTier) === 'low';
  return (
    <group>
      <RoomShell
        width={profile.width ?? 16}
        depth={profile.depth ?? 15}
        height={profile.height ?? 6.2}
        floor={profile.floor}
        wall={profile.wall}
        wallColor={profile.wallColor}
        floorRepeat={[5, 5]}
        floorRoughness={room.id === '11' ? 0.3 : 0.68}
      />
      <LedWall url={profile.ledWall} radius={(profile.width ?? 16) / 2 + 0.2} arc={2.05} height={4} y={1.5} />
      {profile.glazing && !low && <Glazing side={profile.glazing} x={(profile.width ?? 16) / 2 - 0.4} width={11} />}
      <CeilingRig y={(profile.height ?? 6.2) - 1.7} accent={room.color} />
      {active && children}
    </group>
  );
}

function AcademyCue({ room }: { room: RoomDefinition }) {
  return (
    <>
      <Workbenches accent={room.color} secondary={room.secondaryColor} rows={2} perRow={3} spacingX={2.55} z0={2.1} rowGap={2.15} />
      <group position={[5.15, 0.3, -2.4]} rotation={[0, -0.32, 0]}>
        {[0, 1, 2, 3].map((index) => (
          <FramedPanel key={index} position={[0, index * 1.05, 0]} color={index % 2 ? room.secondaryColor : room.color} width={1.5} height={0.8} />
        ))}
      </group>
      <group position={[-5.1, -1.05, -1.4]} rotation={[0, 0.35, 0]}>
        <mesh castShadow receiveShadow><cylinderGeometry args={[1.25, 1.4, 0.72, 28]} /><meshStandardMaterial color="#654f42" roughness={0.78} /></mesh>
        <AccentStrip position={[0, 0.39, 0]} scale={[1.15, 0.035, 1.15]} color={room.color} />
        {[0, 1, 2].map((index) => (
          <mesh key={index} position={[(index - 1) * 0.9, -0.45, 0.95]} castShadow>
            <cylinderGeometry args={[0.24, 0.3, 0.72, 16]} />
            <meshStandardMaterial color="#3b4148" metalness={0.18} roughness={0.55} />
          </mesh>
        ))}
      </group>
    </>
  );
}

function MakerspaceCue({ room }: { room: RoomDefinition }) {
  return (
    <>
      <Workbenches accent={room.color} secondary={room.secondaryColor} rows={2} perRow={3} spacingX={3} z0={2.5} rowGap={3.2} />
      <group position={[-5.7, -0.25, -1.7]}>
        <mesh castShadow><boxGeometry args={[1.2, 2.3, 1.2]} /><meshStandardMaterial color="#343942" metalness={0.3} roughness={0.48} /></mesh>
        <mesh position={[0, 0.6, 0.66]}><boxGeometry args={[0.84, 0.78, 0.06]} /><meshStandardMaterial color={room.secondaryColor} emissive={room.color} emissiveIntensity={0.16} /></mesh>
        <mesh position={[0, -0.45, 0.7]}><boxGeometry args={[0.7, 0.5, 0.15]} /><meshStandardMaterial color="#161a20" metalness={0.42} roughness={0.4} /></mesh>
      </group>
      <group position={[5.6, 1.1, -2.4]} rotation={[0, -0.28, 0]}>
        {[-1.3, 0, 1.3].map((x, index) => <FramedPanel key={x} position={[x, 0, 0]} color={index === 1 ? room.color : room.secondaryColor} width={1.1} height={1.4} />)}
      </group>
      <group position={[5.6, -0.9, 1.4]}>
        {[0, 1, 2, 3].map((index) => (
          <mesh key={index} position={[(index % 2) * 0.9 - 0.45, Math.floor(index / 2) * 0.7, 0]} castShadow>
            <boxGeometry args={[0.72, 0.55, 0.72]} />
            <meshStandardMaterial color={index % 2 ? '#9d8f82' : '#6d7681'} roughness={0.72} />
          </mesh>
        ))}
      </group>
    </>
  );
}

function NeighborhoodCue({ room }: { room: RoomDefinition }) {
  const homes = [
    [-1.6, -0.6, -0.8], [-0.55, -0.6, 0.3], [0.65, -0.6, -0.65], [1.55, -0.6, 0.65], [0, -0.6, 1.35],
  ] as const;
  return (
    <>
      <Platform accent={room.color} radius={3.7} height={0.3} />
      <group position={[0, -0.75, 0]}>
        {homes.map(([x, y, z], index) => (
          <group key={index} position={[x, y, z]}>
            <mesh castShadow><boxGeometry args={[0.9, 0.7 + (index % 2) * 0.3, 0.8]} /><meshStandardMaterial color={index % 2 ? '#b7aa96' : '#7f8a78'} roughness={0.76} /></mesh>
            <mesh position={[0, 0.55 + (index % 2) * 0.15, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[0.72, 0.5, 4]} /><meshStandardMaterial color="#5a493f" roughness={0.74} /></mesh>
          </group>
        ))}
        <mesh position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[2.5, 0.055, 8, 64]} /><meshStandardMaterial color={room.color} emissive={room.color} emissiveIntensity={0.2} /></mesh>
      </group>
      <group position={[5.25, 0.6, -2.1]} rotation={[0, -0.3, 0]}>
        <FramedPanel position={[0, 0, 0]} color={room.secondaryColor} width={2.8} height={2.2} />
        {[[-0.7, 0.45], [0.55, 0.6], [-0.25, -0.45], [0.8, -0.55]].map(([x, y], index) => (
          <mesh key={index} position={[x, y, 0.1]}><sphereGeometry args={[0.09, 14, 10]} /><meshStandardMaterial color={room.color} emissive={room.color} emissiveIntensity={0.3} /></mesh>
        ))}
      </group>
    </>
  );
}

function InfrastructureCue({ room }: { room: RoomDefinition }) {
  return (
    <>
      <Platform accent={room.color} radius={3.1} height={0.22} />
      <group position={[0, -0.25, -0.4]}>
        {[-2.3, 2.3].map((x) => <mesh key={x} position={[x, 0.4, 0]} castShadow><boxGeometry args={[0.28, 3.6, 0.32]} /><meshStandardMaterial color="#555d64" metalness={0.42} roughness={0.44} /></mesh>)}
        <mesh position={[0, 2.05, 0]} castShadow><boxGeometry args={[5, 0.28, 0.32]} /><meshStandardMaterial color="#555d64" metalness={0.42} roughness={0.44} /></mesh>
        {[-1.6, -0.8, 0, 0.8, 1.6].map((x) => <mesh key={x} position={[x, 1.5, 0]} rotation={[0, 0, x * 0.03]}><boxGeometry args={[0.08, 1.1, 0.12]} /><meshStandardMaterial color={room.color} emissive={room.color} emissiveIntensity={0.13} /></mesh>)}
      </group>
      <group position={[-5.5, -0.65, -1.2]}>
        {[0, 1, 2].map((index) => <mesh key={index} position={[0, index * 0.72, 0]} castShadow><boxGeometry args={[1.9, 0.55, 0.85]} /><meshStandardMaterial color={index === 1 ? '#aa8d61' : '#747d84'} roughness={0.68} /></mesh>)}
      </group>
      <group position={[5.4, -0.15, 0.8]}>
        <mesh castShadow><cylinderGeometry args={[0.18, 0.28, 2.7, 14]} /><meshStandardMaterial color="#333941" metalness={0.38} roughness={0.46} /></mesh>
        <mesh position={[0, 1.55, 0]} rotation={[0, 0, 0.3]}><boxGeometry args={[0.9, 0.22, 0.3]} /><meshStandardMaterial color={room.secondaryColor} emissive={room.color} emissiveIntensity={0.18} /></mesh>
      </group>
    </>
  );
}

function TrustCue({ room }: { room: RoomDefinition }) {
  return (
    <>
      <Platform accent={room.color} radius={2.8} height={0.24} />
      {[-3.8, 0, 3.8].map((x, index) => (
        <group key={x} position={[x, -0.45, index === 1 ? 1.9 : 0.6]} rotation={[0, index === 0 ? 0.35 : index === 2 ? -0.35 : Math.PI, 0]}>
          <mesh castShadow receiveShadow><cylinderGeometry args={[1.05, 1.2, 1.5, 28]} /><meshStandardMaterial color="#333944" metalness={0.35} roughness={0.48} /></mesh>
          <mesh position={[0, 0.45, 0.76]}><boxGeometry args={[1.25, 0.7, 0.06]} /><meshStandardMaterial color={room.secondaryColor} emissive={room.color} emissiveIntensity={0.12} /></mesh>
          <mesh position={[0, 1.15, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.6, 0.055, 10, 40]} /><meshStandardMaterial color={room.color} emissive={room.color} emissiveIntensity={0.2} /></mesh>
        </group>
      ))}
      <group position={[0, 0.45, -1]}>
        {[0.55, 0.9, 1.25].map((radius, index) => <mesh key={radius} rotation={[Math.PI / 2, 0, index * 0.35]}><torusGeometry args={[radius, 0.035, 8, 48]} /><meshStandardMaterial color={index === 1 ? room.secondaryColor : room.color} emissive={room.color} emissiveIntensity={0.12} /></mesh>)}
      </group>
    </>
  );
}

function HangarCue({ room }: { room: RoomDefinition }) {
  return (
    <>
      <group position={[0, -1.42, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[6.5, 12]} /><meshStandardMaterial color="#30363c" roughness={0.74} /></mesh>
        {[-2.2, 0, 2.2].map((x) => <AccentStrip key={x} position={[x, 0.025, 0]} scale={[0.06, 0.02, 5.4]} color={x === 0 ? room.color : room.secondaryColor} />)}
      </group>
      <group position={[0, 1.85, -1.5]}>
        <mesh castShadow><boxGeometry args={[9.5, 0.25, 0.3]} /><meshStandardMaterial color="#505860" metalness={0.45} roughness={0.42} /></mesh>
        {[-4.5, 4.5].map((x) => <mesh key={x} position={[x, -1.5, 0]} castShadow><boxGeometry args={[0.25, 3.25, 0.3]} /><meshStandardMaterial color="#505860" metalness={0.45} roughness={0.42} /></mesh>)}
      </group>
      {[-5.8, 5.8].map((x) => (
        <group key={x} position={[x, -0.9, 1.7]}>
          <mesh castShadow><boxGeometry args={[1.45, 0.55, 1.05]} /><meshStandardMaterial color="#68737d" metalness={0.3} roughness={0.52} /></mesh>
          {[-0.48, 0.48].map((dx) => <mesh key={dx} position={[dx, -0.34, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.22, 0.08, 10, 24]} /><meshStandardMaterial color="#20252b" roughness={0.65} /></mesh>)}
        </group>
      ))}
    </>
  );
}

function CommunicationsCue({ room }: { room: RoomDefinition }) {
  return (
    <>
      <Platform accent={room.color} radius={3.2} height={0.22} />
      <group position={[0, -0.2, 0]} rotation={[0, -0.35, 0]}>
        <mesh rotation={[0.3, 0, 0]} castShadow><cylinderGeometry args={[0.08, 0.5, 2.4, 20]} /><meshStandardMaterial color="#545d67" metalness={0.36} roughness={0.48} /></mesh>
        <mesh position={[0, 1.25, 0]} rotation={[0.55, 0, 0]}><circleGeometry args={[1.55, 48]} /><meshStandardMaterial color="#9ba5af" side={2} metalness={0.25} roughness={0.54} /></mesh>
        <mesh position={[0, 1.25, 0.15]} rotation={[0.55, 0, 0]}><torusGeometry args={[1.2, 0.045, 8, 48]} /><meshStandardMaterial color={room.color} emissive={room.color} emissiveIntensity={0.18} /></mesh>
      </group>
      {[-5.6, -4.5, 4.5, 5.6].map((x, index) => (
        <group key={x} position={[x, -0.15, index % 2 ? -1.8 : 1.1]}>
          <mesh castShadow><cylinderGeometry args={[0.07, 0.12, 3, 10]} /><meshStandardMaterial color="#343a42" metalness={0.42} /></mesh>
          {[0.3, 0.8, 1.3].map((y) => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.35, 0.035, 8, 30]} /><meshStandardMaterial color={room.secondaryColor} emissive={room.color} emissiveIntensity={0.12} /></mesh>)}
        </group>
      ))}
    </>
  );
}

function ColdChainCue({ room }: { room: RoomDefinition }) {
  return (
    <>
      <Workbenches accent={room.color} secondary={room.secondaryColor} rows={1} perRow={3} spacingX={3.1} z0={2.3} />
      {[-5.7, 5.7].map((x) => (
        <group key={x} position={[x, -0.05, -1.6]}>
          <mesh castShadow><boxGeometry args={[1.8, 3.1, 1.05]} /><meshStandardMaterial color="#d5dde3" metalness={0.16} roughness={0.44} /></mesh>
          {[0.65, -0.25, -1.05].map((y, index) => <mesh key={y} position={[0, y, 0.57]}><boxGeometry args={[1.45, 0.08, 0.05]} /><meshStandardMaterial color={index === 0 ? room.color : '#7b858e'} emissive={index === 0 ? room.color : '#000000'} emissiveIntensity={0.12} /></mesh>)}
        </group>
      ))}
      <group position={[0, -0.85, -1.4]}>
        {[-1.4, -0.45, 0.5, 1.45].map((x, index) => <mesh key={x} position={[x, 0, index % 2 ? 0.45 : -0.2]} castShadow><boxGeometry args={[0.8, 0.65, 0.8]} /><meshStandardMaterial color={index % 2 ? '#83956c' : '#a9875e'} roughness={0.78} /></mesh>)}
        <mesh position={[0, 1.15, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[2.1, 0.08, 10, 48]} /><meshStandardMaterial color={room.secondaryColor} emissive={room.color} emissiveIntensity={0.14} /></mesh>
      </group>
    </>
  );
}

function FintechCue({ room }: { room: RoomDefinition }) {
  return (
    <>
      <Workbenches accent={room.color} secondary={room.secondaryColor} rows={2} perRow={2} spacingX={4.2} z0={2.2} rowGap={2.6} />
      <group position={[0, -0.9, -1.25]}>
        {[-2.2, 0, 2.2].map((x, index) => (
          <group key={x} position={[x, index * 0.25, 0]}>
            <mesh castShadow><cylinderGeometry args={[0.62, 0.76, 1.2 + index * 0.35, 24]} /><meshStandardMaterial color={index === 1 ? '#5d5062' : '#77717b'} metalness={0.22} roughness={0.56} /></mesh>
            <mesh position={[0, 0.72 + index * 0.18, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.58, 0.045, 8, 36]} /><meshStandardMaterial color={index === 1 ? room.color : room.secondaryColor} emissive={room.color} emissiveIntensity={0.14} /></mesh>
          </group>
        ))}
        {[-1.1, 1.1].map((x) => <AccentStrip key={x} position={[x, 0.05, 0]} scale={[0.7, 0.035, 0.035]} color={room.secondaryColor} />)}
      </group>
      <group position={[5.35, 0.55, -2.1]} rotation={[0, -0.32, 0]}>
        <FramedPanel position={[0, 0.75, 0]} color={room.secondaryColor} width={2.5} height={1.1} />
        <FramedPanel position={[0, -0.55, 0]} color={room.color} width={2.5} height={1.1} />
      </group>
    </>
  );
}

function MainStreetCue({ room }: { room: RoomDefinition }) {
  return (
    <>
      {[-5.4, -2.8, 2.8, 5.4].map((x, index) => (
        <group key={x} position={[x, -0.1, -2.1]}>
          <mesh castShadow receiveShadow><boxGeometry args={[2.15, 2.9, 1]} /><meshStandardMaterial color={index % 2 ? '#c8ad91' : '#a99d8a'} roughness={0.72} /></mesh>
          <mesh position={[0, 0.55, 0.54]}><boxGeometry args={[1.7, 0.95, 0.06]} /><meshStandardMaterial color={index % 2 ? room.secondaryColor : room.color} emissive={room.color} emissiveIntensity={0.08} /></mesh>
          <mesh position={[0, -0.75, 0.55]}><boxGeometry args={[0.75, 1, 0.07]} /><meshStandardMaterial color="#454a50" metalness={0.2} roughness={0.54} /></mesh>
          <mesh position={[0, 1.25, 0.65]}><boxGeometry args={[1.65, 0.16, 0.5]} /><meshStandardMaterial color={index % 2 ? room.color : room.secondaryColor} roughness={0.55} /></mesh>
        </group>
      ))}
      <group position={[0, -1, 1.4]}>
        <mesh castShadow receiveShadow><cylinderGeometry args={[2.1, 2.35, 0.78, 36]} /><meshStandardMaterial color="#6a5142" roughness={0.78} /></mesh>
        <mesh position={[0, 0.42, 0]}><cylinderGeometry args={[2.05, 2.05, 0.08, 36]} /><meshStandardMaterial color={room.secondaryColor} emissive={room.color} emissiveIntensity={0.08} roughness={0.6} /></mesh>
        {[-1.3, 0, 1.3].map((x) => <mesh key={x} position={[x, -0.62, 1.25]} castShadow><cylinderGeometry args={[0.28, 0.34, 0.72, 16]} /><meshStandardMaterial color="#3b4046" metalness={0.16} roughness={0.58} /></mesh>)}
      </group>
    </>
  );
}

export function WorkforceAcademy({ room, active }: ProgramRoomProps) {
  return <ProgramShell room={room} active={active}><AcademyCue room={room} /></ProgramShell>;
}

export function StudentMakerspace({ room, active }: ProgramRoomProps) {
  return <ProgramShell room={room} active={active}><MakerspaceCue room={room} /></ProgramShell>;
}

export function NeighborhoodStudio({ room, active }: ProgramRoomProps) {
  return <ProgramShell room={room} active={active}><NeighborhoodCue room={room} /></ProgramShell>;
}

export function InfrastructureTestbed({ room, active }: ProgramRoomProps) {
  return <ProgramShell room={room} active={active}><InfrastructureCue room={room} /></ProgramShell>;
}

export function TrustworthyAILab({ room, active }: ProgramRoomProps) {
  return <ProgramShell room={room} active={active}><TrustCue room={room} /></ProgramShell>;
}

export function MobilityHangar({ room, active }: ProgramRoomProps) {
  return <ProgramShell room={room} active={active}><HangarCue room={room} /></ProgramShell>;
}

export function CommunicationsLab({ room, active }: ProgramRoomProps) {
  return <ProgramShell room={room} active={active}><CommunicationsCue room={room} /></ProgramShell>;
}

export function ColdChainLab({ room, active }: ProgramRoomProps) {
  return <ProgramShell room={room} active={active}><ColdChainCue room={room} /></ProgramShell>;
}

export function FintechStudio({ room, active }: ProgramRoomProps) {
  return <ProgramShell room={room} active={active}><FintechCue room={room} /></ProgramShell>;
}

export function MainStreetStudio({ room, active }: ProgramRoomProps) {
  return <ProgramShell room={room} active={active}><MainStreetCue room={room} /></ProgramShell>;
}

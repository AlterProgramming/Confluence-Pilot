import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Object3D, type Group, type InstancedMesh } from 'three';
import type { RoomDefinition } from '../types/room';

type Vec3 = [number, number, number];
type Transform = { position: Vec3; rotation?: Vec3; scale?: Vec3 };

type InstancesProps = {
  transforms: Transform[];
  size?: Vec3;
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  metalness?: number;
  roughness?: number;
  opacity?: number;
};

function Boxes({ transforms, size = [1, 1, 1], color, emissive = '#000', emissiveIntensity = 0, metalness = 0.2, roughness = 0.55, opacity = 1 }: InstancesProps) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const object = new Object3D();
    transforms.forEach((item, index) => {
      object.position.set(...item.position);
      object.rotation.set(...(item.rotation ?? [0, 0, 0]));
      object.scale.set(...(item.scale ?? [1, 1, 1]));
      object.updateMatrix();
      mesh.setMatrixAt(index, object.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [transforms]);
  if (!transforms.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, transforms.length]} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emissiveIntensity} metalness={metalness} roughness={roughness} transparent={opacity < 1} opacity={opacity} />
    </instancedMesh>
  );
}

function Cylinders({ transforms, size = [.5, 1, 12], color, emissive = '#000', emissiveIntensity = 0, metalness = 0.2, roughness = 0.55, opacity = 1 }: InstancesProps) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const object = new Object3D();
    transforms.forEach((item, index) => {
      object.position.set(...item.position);
      object.rotation.set(...(item.rotation ?? [0, 0, 0]));
      object.scale.set(...(item.scale ?? [1, 1, 1]));
      object.updateMatrix();
      mesh.setMatrixAt(index, object.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [transforms]);
  if (!transforms.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, transforms.length]} castShadow receiveShadow>
      <cylinderGeometry args={[size[0], size[0], size[1], Math.max(6, size[2])]} />
      <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emissiveIntensity} metalness={metalness} roughness={roughness} transparent={opacity < 1} opacity={opacity} />
    </instancedMesh>
  );
}

function local(position: Vec3, yaw: number, offset: Vec3): Vec3 {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [position[0] + offset[0] * c + offset[2] * s, position[1] + offset[1], position[2] - offset[0] * s + offset[2] * c];
}

type Chair = { position: Vec3; yaw: number; scale?: number };
function Chairs({ items, accent }: { items: Chair[]; accent: string }) {
  const seats = useMemo<Transform[]>(() => items.map(({ position, yaw, scale = 1 }) => ({ position, rotation: [0, yaw, 0], scale: [scale, scale, scale] })), [items]);
  const backs = useMemo<Transform[]>(() => items.map(({ position, yaw, scale = 1 }) => ({ position: local(position, yaw, [0, .45 * scale, .27 * scale]), rotation: [-.1, yaw, 0], scale: [scale, scale, scale] })), [items]);
  const stems = useMemo<Transform[]>(() => items.map(({ position, yaw, scale = 1 }) => ({ position: local(position, yaw, [0, -.34 * scale, 0]), scale: [scale, scale, scale] })), [items]);
  return <group><Boxes transforms={seats} size={[.62,.14,.62]} color="#151a22" metalness={.38} roughness={.4}/><Boxes transforms={backs} size={[.62,.72,.12]} color="#11161d" metalness={.34} roughness={.42}/><Cylinders transforms={stems} size={[.055,.64,8]} color="#303946" metalness={.72} roughness={.2}/><Boxes transforms={stems} size={[.5,.045,.08]} color={accent} emissive={accent} emissiveIntensity={.2}/></group>;
}

type Desk = { position: Vec3; yaw?: number; scale?: number };
function Workstations({ items, accent, secondary }: { items: Desk[]; accent: string; secondary: string }) {
  const tops = useMemo<Transform[]>(() => items.map(({ position, yaw = 0, scale = 1 }) => ({ position, rotation: [0,yaw,0], scale: [scale,scale,scale] })), [items]);
  const legs = useMemo<Transform[]>(() => items.flatMap(({ position, yaw = 0, scale = 1 }) => [-1,1].map(side => ({ position: local(position,yaw,[.78*side*scale,-.54*scale,0]), rotation: [0,yaw,0] as Vec3, scale: [scale,scale,scale] as Vec3 }))), [items]);
  const monitors = useMemo<Transform[]>(() => items.map(({ position, yaw = 0, scale = 1 }) => ({ position: local(position,yaw,[0,.48*scale,-.22*scale]), rotation: [0,yaw,0], scale: [scale,scale,scale] })), [items]);
  return <group><Boxes transforms={tops} size={[1.85,.13,.82]} color="#24272c" metalness={.28} roughness={.48}/><Boxes transforms={legs} size={[.13,1.05,.65]} color="#10151b" metalness={.5} roughness={.35}/><Boxes transforms={monitors} size={[1.04,.62,.08]} color="#070b10" metalness={.42} roughness={.24}/><Boxes transforms={monitors} size={[.91,.49,.018]} color={secondary} emissive={accent} emissiveIntensity={.85}/></group>;
}

function Gallery({ room, active }: { room: RoomDefinition; active: boolean }) {
  const chairs = useMemo<Chair[]>(() => Array.from({ length: 18 }, (_, index) => { const angle = index / 18 * Math.PI * 2; return { position: [Math.cos(angle)*3.65,-.72,Math.sin(angle)*2.65+.18], yaw: -angle+Math.PI/2, scale:.92 }; }), []);
  const plinths = useMemo<Transform[]>(() => [[-4.65,-.82,1.55],[-4.55,-.82,-.45],[4.55,-.82,1.72],[4.65,-.82,-.32]].map((position,index)=>({ position: position as Vec3, scale:[.72+index%2*.1,.85+index%3*.15,.72] })), []);
  return <group><mesh position={[0,-.72,.08]} scale={[1.35,1,1]}><torusGeometry args={[2.05,.72,12,64]}/><meshStandardMaterial color="#302821" metalness={.32} roughness={.38}/></mesh><mesh position={[0,-.58,.08]} scale={[1.35,1,1]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[1.7,2.5,64]}/><meshBasicMaterial color={room.color} transparent opacity={active?.22:.05}/></mesh><Chairs items={chairs} accent={room.color}/><Boxes transforms={plinths} size={[.82,1.6,.82]} color="#151a20" metalness={.48} roughness={.32}/><mesh position={[0,1.05,-3.2]}><boxGeometry args={[6.4,2.7,.2]}/><meshStandardMaterial color="#070a0e" emissive={room.color} emissiveIntensity={active?.18:.03}/></mesh></group>;
}

function Academy({ room, active }: { room: RoomDefinition; active: boolean }) {
  const desks = useMemo<Desk[]>(() => Array.from({length:8},(_,i)=>({position:[-3.7+(i%4)*2.45,-.82,-.3+Math.floor(i/4)*1.75],scale:.78})),[]);
  const chairs = useMemo<Chair[]>(()=>desks.map(d=>({position:local(d.position,d.yaw??0,[0,.08,.7]),yaw:Math.PI,scale:.74})),[desks]);
  const lounge = useMemo<Transform[]>(()=>Array.from({length:6},(_,i)=>({position:[-3.8+i*1.5,-.82,2.65] as Vec3,rotation:[0,(i%2?-.12:.12),0] as Vec3})),[]);
  return <group><Workstations items={desks} accent={room.color} secondary={room.secondaryColor}/><Chairs items={chairs} accent={room.color}/><Boxes transforms={lounge} size={[1.05,.42,.9]} color="#183149" roughness={.58}/><mesh position={[0,1.05,-3.18]}><boxGeometry args={[6.5,2.6,.18]}/><meshStandardMaterial color="#08101a" emissive={room.color} emissiveIntensity={active?.18:.03}/></mesh></group>;
}

function Studio({ room, active }: { room: RoomDefinition; active: boolean }) {
  const benches = useMemo<Transform[]>(()=>Array.from({length:8},(_,i)=>({position:[-3.45+(i%4)*2.3,-.78,-.35+Math.floor(i/4)*1.9] as Vec3})),[]);
  const stools = useMemo<Chair[]>(()=>benches.map(b=>({position:[b.position[0],-.78,b.position[2]+.72],yaw:Math.PI,scale:.66})),[benches]);
  const printers = useMemo<Transform[]>(()=>[{position:[4.65,-.38,-2.65] as Vec3},{position:[3.45,-.38,-2.65] as Vec3}],[]);
  return <group><Boxes transforms={benches} size={[1.7,.18,.82]} color="#2a2d31" metalness={.42} roughness={.46}/><Boxes transforms={benches.map(b=>({...b,position:[b.position[0],-1.28,b.position[2]]}))} size={[.12,1,.65]} color="#11161c" metalness={.6}/><Chairs items={stools} accent={room.color}/><Boxes transforms={printers} size={[.85,1.55,.85]} color="#11161c" metalness={.46}/><Boxes transforms={printers.map(p=>({...p,position:[p.position[0],.05,p.position[2]]}))} size={[.62,.62,.62]} color={room.secondaryColor} emissive={room.color} emissiveIntensity={active?.45:.08} opacity={.35}/><mesh position={[-3.9,.85,-3.2]}><boxGeometry args={[3.4,2.8,.18]}/><meshStandardMaterial color="#101419"/></mesh></group>;
}

function LivingBuilding({ room, active }: { room: RoomDefinition; active: boolean }) {
  const desks = useMemo<Desk[]>(()=>[[-3.8,-.86,1.15],[-1.95,-.86,1.55],[1.95,-.86,1.55],[3.8,-.86,1.15],[-3.05,-.86,-.15],[3.05,-.86,-.15]].map(position=>({position:position as Vec3,scale:.76})),[]);
  const chairs = useMemo<Chair[]>(()=>desks.map(d=>({position:local(d.position,0,[0,.08,.72]),yaw:Math.PI,scale:.72})),[desks]);
  const buildings = useMemo<Transform[]>(()=>Array.from({length:35},(_,i)=>{const h=.22+(i*13%9)*.08;return{position:[(i%7-3)*.25,-.6+h/2,(Math.floor(i/7)-2)*.25] as Vec3,scale:[.75,h,.75] as Vec3}}),[]);
  const pipes = useMemo<Transform[]>(()=>Array.from({length:7},(_,i)=>({position:[4.62,-.05+i*.42,-2.85] as Vec3,rotation:[0,0,Math.PI/2] as Vec3})),[]);
  return <group><Workstations items={desks} accent={room.color} secondary={room.secondaryColor}/><Chairs items={chairs} accent={room.color}/><mesh position={[0,-.86,.15]}><boxGeometry args={[2.9,.18,2.05]}/><meshStandardMaterial color="#171b20" metalness={.42}/></mesh><Boxes transforms={buildings} size={[.2,1,.2]} color={room.secondaryColor} emissive={room.color} emissiveIntensity={active?1.3:.25} opacity={.72}/><Cylinders transforms={pipes} size={[.065,2.2,10]} color="#9aa6ad" metalness={.8}/></group>;
}

function Neighborhood({ room, active }: { room: RoomDefinition; active: boolean }) {
  const houses = useMemo<Transform[]>(()=>Array.from({length:24},(_,i)=>{const h=.48+(i*7%5)*.08;return{position:[(i%6-2.5)*.62,-.88+h/2,(Math.floor(i/6)-1.5)*.72] as Vec3,scale:[.78,h,.82] as Vec3}}),[]);
  const roofs = useMemo<Transform[]>(()=>houses.map((h,i)=>({position:[h.position[0],h.position[1]+.35,h.position[2]],rotation:[0,0,Math.PI/4],scale:[.55,.55,.72]})),[houses]);
  const desks = useMemo<Desk[]>(()=>[[-4.15,-.86,1.65],[4.15,-.86,1.65],[-4.15,-.86,-.65],[4.15,-.86,-.65]].map(position=>({position:position as Vec3,scale:.72})),[]);
  const trees = useMemo<Transform[]>(()=>Array.from({length:16},(_,i)=>({position:[(i%2?1:-1)*(2.05+i%3*.24),-.45,-1.4+Math.floor(i/2)*.36] as Vec3})),[]);
  return <group><mesh position={[0,-.92,.25]}><boxGeometry args={[6.4,.16,4.8]}/><meshStandardMaterial color="#161c17"/></mesh><Boxes transforms={houses} size={[.48,.58,.5]} color="#d7d4c8" emissive={room.color} emissiveIntensity={active?.06:.01}/><Boxes transforms={roofs} size={[.46,.46,.58]} color="#38413b"/><Cylinders transforms={trees} size={[.05,.5,8]} color="#72563a"/><Cylinders transforms={trees.map(t=>({...t,position:[t.position[0],t.position[1]+.45,t.position[2]],scale:[1.8,.8,1.8]}))} size={[.16,.24,8]} color="#4f8d55"/><Workstations items={desks} accent={room.color} secondary={room.secondaryColor}/></group>;
}

export function RoomFixtures({ room, active }: { room: RoomDefinition; active: boolean }) {
  if (room.architecture === 'gallery') return <Gallery room={room} active={active}/>;
  if (room.architecture === 'academy') return <Academy room={room} active={active}/>;
  if (room.architecture === 'studio') return <Studio room={room} active={active}/>;
  if (room.architecture === 'living-building') return <LivingBuilding room={room} active={active}/>;
  if (room.architecture === 'neighborhood') return <Neighborhood room={room} active={active}/>;
  return null;
}

import { useMemo, useRef } from 'react';
import { Clone, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Box3, Vector3, type Group } from 'three';

const FURN = '/assets/furniture';
const FLOOR = -1.5;

/** One real CC0 furniture GLB, native-scale, centred horizontally with its base
 *  on the floor. Uses drei <Clone> so repeated pieces SHARE geometry/materials
 *  (cheap to mount) instead of a deep scene.clone(true) per instance. */
export function FurnitureItem({
  asset,
  position,
  rotationY = 0,
  scale = 1,
}: {
  asset: string;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
}) {
  const { scene } = useGLTF(`${FURN}/${asset}.glb`, false, true);
  const offset = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const center = box.getCenter(new Vector3());
    return [-center.x * scale, -box.min.y * scale, -center.z * scale] as [number, number, number];
  }, [scene, scale]);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Clone object={scene} scale={scale} position={offset} />
    </group>
  );
}

/** Emissive monitor perched on a desk (Poly Haven has no monitor model). The
 *  glow comes from the emissive screen + global IBL — NO per-monitor point light
 *  (rooms had 6+ of them, a big per-frame + mount cost). */
function Monitor({ position, rotationY, secondary }: { position: [number, number, number]; rotationY: number; secondary: string }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[0.62, 0.38, 0.04]} />
        <meshStandardMaterial color="#0a0d12" metalness={0.4} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.32, 0.023]}>
        <planeGeometry args={[0.56, 0.32]} />
        <meshBasicMaterial color={secondary} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Rows of real desks + task chairs + glowing monitors (workbench rooms). */
export function Workstations({ secondary, rows = 2, perRow = 3 }: { accent: string; secondary: string; rows?: number; perRow?: number }) {
  const spots = useMemo(() => {
    const out: { x: number; z: number }[] = [];
    for (let r = 0; r < rows; r += 1) for (let i = 0; i < perRow; i += 1) {
      out.push({ x: (i - (perRow - 1) / 2) * 2.9, z: 1.6 - r * 2.6 });
    }
    return out;
  }, [rows, perRow]);
  return (
    <group>
      {spots.map((s, i) => (
        <group key={i}>
          <FurnitureItem asset="office-desk" position={[s.x, FLOOR, s.z]} rotationY={Math.PI} scale={0.92} />
          <Monitor position={[s.x, FLOOR + 0.78, s.z - 0.1]} rotationY={Math.PI} secondary={secondary} />
          <FurnitureItem asset="task-chair" position={[s.x, FLOOR, s.z + 0.95]} rotationY={0} scale={0.95} />
        </group>
      ))}
    </group>
  );
}

/** Pendant lamps hanging from the ceiling — real overhead fixtures so the
 *  ceiling plane reads inhabited instead of bare. Each pendant hangs by its
 *  own mount (model's top sits at the ceiling). drei <Clone> shares geometry,
 *  and IBL lights them, so this adds overhead detail at ~zero per-frame cost. */
export function CeilingPendants({
  asset = 'modern_ceiling_lamp_01',
  ceilingY = 4.66,
  spots = [
    [-3.6, -2.2],
    [3.6, -2.2],
    [0, 2.4],
  ],
  scale = 1,
}: {
  asset?: string;
  ceilingY?: number;
  spots?: [number, number][];
  scale?: number;
}) {
  const { scene } = useGLTF(`${FURN}/${asset}.glb`, false, true);
  const offset = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const center = box.getCenter(new Vector3());
    // Hang from the top: the model's highest point (the ceiling mount) is pinned
    // to the ceiling plane, so the globe drops down into the room below.
    return [-center.x * scale, -box.max.y * scale, -center.z * scale] as [number, number, number];
  }, [scene, scale]);
  return (
    <group>
      {spots.map(([x, z], i) => (
        <group key={i} position={[x, ceilingY, z]}>
          <Clone object={scene} scale={scale} position={offset} />
        </group>
      ))}
    </group>
  );
}

/** Ceiling fan hung from the ceiling with blades slowly turning — real motion so
 *  an industrial room reads alive instead of frozen. The whole clone spins on Y
 *  (the flat mount disc turning is invisible; only the blades read as motion). */
export function CeilingFan({
  ceilingY,
  position,
  scale = 1.2,
  speed = 0.7,
}: {
  ceilingY: number;
  position: [number, number];
  scale?: number;
  speed?: number;
}) {
  const spin = useRef<Group>(null);
  const { scene } = useGLTF(`${FURN}/ceiling_fan.glb`, false, true);
  const offset = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const center = box.getCenter(new Vector3());
    // Pin the top (mount) to the ceiling; centre X/Z so spin is about the axis.
    return [-center.x * scale, -box.max.y * scale, -center.z * scale] as [number, number, number];
  }, [scene, scale]);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * speed;
  });
  return (
    <group position={[position[0], ceilingY, position[1]]}>
      <group ref={spin}>
        <Clone object={scene} scale={scale} position={offset} />
      </group>
    </group>
  );
}

/** A lounge seating group: sofa + mixed seating around a coffee table. Mixes a
 *  generic armchair with a premium mid-century lounge chair so the group reads
 *  curated, not stamped from one asset. */
export function Lounge() {
  return (
    <group>
      <FurnitureItem asset="sofa" position={[0, FLOOR, 2.9]} rotationY={Math.PI} scale={1.05} />
      <FurnitureItem asset="armchair" position={[-2.3, FLOOR, 1.4]} rotationY={0.9} />
      <FurnitureItem asset="mid_century_lounge_chair" position={[2.3, FLOOR, 1.4]} rotationY={-0.9} />
      <FurnitureItem asset="coffee-table" position={[0, FLOOR, 1.5]} scale={0.95} />
    </group>
  );
}

/** Secondary program zone from real pieces: cabinet + bookshelf + planter. */
export function ReceptionZone({ side = 'right' }: { side?: 'left' | 'right' }) {
  const sx = side === 'right' ? 1 : -1;
  return (
    <group>
      <FurnitureItem asset="cabinet" position={[sx * 6.0, FLOOR, 2.4]} rotationY={sx * -Math.PI / 2} />
      <FurnitureItem asset="bookshelf" position={[sx * 6.2, FLOOR, -1.6]} rotationY={sx * -Math.PI / 2} scale={1.05} />
      <FurnitureItem asset="planter" position={[sx * 5.5, FLOOR, 3.9]} scale={1.1} />
    </group>
  );
}

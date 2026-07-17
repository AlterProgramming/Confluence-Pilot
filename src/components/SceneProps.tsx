import { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';
import { roomProps, type PropPlacement } from '../data/roomProps';
import type { RoomDefinition } from '../types/room';

/** One generated prop, normalized so its base sits on the floor at the given spot. */
function Prop({ placement, active }: { placement: PropPlacement; active: boolean }) {
  const url = `/assets/props/${placement.asset}.glb`;
  const { scene } = useGLTF(url, false, true);
  const size = placement.size ?? 1.2;

  const norm = useMemo(() => {
    const clone = scene.clone(true);
    clone.updateMatrixWorld(true);
    const box = new Box3().setFromObject(clone);
    const dims = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const maxDim = Math.max(dims.x, dims.y, dims.z) || 1;
    const scale = size / maxDim;
    // Offset (in parent space) so the scaled prop is horizontally centred with its base at y=0.
    const offset: [number, number, number] = [-center.x * scale, -box.min.y * scale, -center.z * scale];
    return { clone, scale, offset };
  }, [scene, size]);

  return (
    <group position={placement.position} rotation={[0, placement.rotationY ?? 0, 0]}>
      <primitive object={norm.clone} scale={norm.scale} position={norm.offset} />
      {placement.lamp && (
        <pointLight color="#ffd7a3" intensity={active ? 9 : 2.4} distance={8} decay={2} position={[0, 1.75, 0]} />
      )}
    </group>
  );
}

/** Places the room's generated props to compose a furnished scene. */
export function SceneProps({ room, active }: { room: RoomDefinition; active: boolean }) {
  const placements = roomProps[room.id] ?? roomProps.default;
  return (
    <group>
      {placements.map((placement, index) => (
        <Suspense key={`${placement.asset}-${index}`} fallback={null}>
          <Prop placement={placement} active={active} />
        </Suspense>
      ))}
    </group>
  );
}

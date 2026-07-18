import { Suspense, useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Vector3, type Group } from 'three';
import { roomProps, type PropPlacement } from '../data/roomProps';
import type { RoomDefinition } from '../types/room';

type PreparedProp = {
  template: Group;
  scale: number;
  offset: [number, number, number];
};

const preparedProps = new Map<string, PreparedProp>();

function preparePropTemplate(url: string, scene: Group, size: number): PreparedProp {
  const key = `${url}::${size}`;
  const cached = preparedProps.get(key);
  if (cached) return cached;

  const template = scene.clone(true);
  template.updateMatrixWorld(true);
  const box = new Box3().setFromObject(template);
  const dims = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const maxDim = Math.max(dims.x, dims.y, dims.z) || 1;
  const scale = size / maxDim;
  const prepared = {
    template,
    scale,
    offset: [-center.x * scale, -box.min.y * scale, -center.z * scale] as [number, number, number],
  };
  preparedProps.set(key, prepared);
  return prepared;
}

/** One generated prop, normalized so its base sits on the floor at the given spot. */
function Prop({ placement, active }: { placement: PropPlacement; active: boolean }) {
  const url = `/assets/props/${placement.asset}.glb`;
  const { scene } = useGLTF(url, false, true);
  const size = placement.size ?? 1.2;

  const norm = useMemo(() => {
    const prepared = preparePropTemplate(url, scene, size);
    return {
      clone: prepared.template.clone(true),
      scale: prepared.scale,
      offset: prepared.offset,
    };
  }, [scene, size, url]);

  return (
    <group position={placement.position} rotation={[0, placement.rotationY ?? 0, 0]}>
      <primitive object={norm.clone} scale={norm.scale} position={norm.offset} />
      {placement.lamp && (
        <pointLight color="#ffd7a3" intensity={active ? 9 : 2.4} distance={8} decay={2} position={[0, 1.75, 0]} />
      )}
    </group>
  );
}

export function ScenePropPreparer({ placement, onPrepared }: { placement: PropPlacement; onPrepared: (key: string) => void }) {
  const url = `/assets/props/${placement.asset}.glb`;
  const { scene } = useGLTF(url, false, true);
  const size = placement.size ?? 1.2;
  useEffect(() => {
    preparePropTemplate(url, scene, size);
    onPrepared(`prop:${url}:${size}`);
  }, [onPrepared, scene, size, url]);
  return null;
}

/** Places the room's generated props to compose a furnished scene. */
export function SceneProps({ room, active }: { room: RoomDefinition; active: boolean }) {
  const placements = roomProps[room.id] ?? roomProps.default ?? [];
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

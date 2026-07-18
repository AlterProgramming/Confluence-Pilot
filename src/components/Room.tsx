import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { Group } from 'three';
import type { RoomDefinition } from '../types/room';
import { RoomArchitecture } from './RoomArchitecture';
import { RoomAsset } from './RoomAsset';
import { RoomCore } from './RoomCore';
import { RoomDisplays } from './RoomDisplays';
import { RoomFixtures } from './RoomFixtures';
import { RoomGrounding } from './RoomGrounding';
import { LifeMotes } from './LifeMotes';
import { RoomLighting } from './RoomLighting';
import { SceneProps } from './SceneProps';
import { SceneStage } from './SceneStage';
import { roomScenes } from '../scenes/registry';

const HEAVY_HERO_ROOMS = new Set(['03', '04']);

function revealOffset(room: RoomDefinition): [number, number, number] {
  if (room.architecture === 'academy') return [0, -0.24, 0.16];
  if (room.architecture === 'studio') return [-0.22, -0.1, 0.08];
  if (room.architecture === 'living-building') return [0.14, -0.12, 0.2];
  if (room.architecture === 'neighborhood') return [0, -0.22, 0.28];
  return [0, -0.14, 0.12];
}

export function Room({ room, active, settled }: { room: RoomDefinition; active: boolean; settled: boolean }) {
  const contentRef = useRef<Group>(null);
  const BespokeScene = roomScenes[room.id];
  const usesRoomSet = ['gallery', 'academy', 'studio', 'living-building', 'neighborhood'].includes(room.architecture);
  const fallback = HEAVY_HERO_ROOMS.has(room.id)
    ? <RoomCore room={room} active={active} />
    : usesRoomSet
      ? null
      : <RoomCore room={room} active={active} />;

  useEffect(() => {
    if (!settled || !contentRef.current) return;
    const [x, y, z] = revealOffset(room);
    const group = contentRef.current;
    gsap.killTweensOf(group.position);
    gsap.killTweensOf(group.scale);
    gsap.killTweensOf(group.rotation);
    group.position.set(x, y, z);
    group.scale.setScalar(0.985);
    group.rotation.y = room.architecture === 'studio' ? -0.018 : room.architecture === 'living-building' ? 0.014 : 0;

    const timeline = gsap.timeline({ defaults: { overwrite: true } });
    timeline.to(group.position, { x: 0, y: 0, z: 0, duration: 1.15, ease: 'power3.out' }, 0);
    timeline.to(group.scale, { x: 1, y: 1, z: 1, duration: 1.25, ease: 'power2.out' }, 0);
    timeline.to(group.rotation, { y: 0, duration: 1.35, ease: 'power2.out' }, 0);
    return () => {
      timeline.kill();
    };
  }, [room, settled]);

  return (
    <group position={[0, room.y, 0]}>
      <RoomGrounding room={room} active={active} />
      <SceneStage room={room} active={active} />
      <group ref={contentRef}>
        {BespokeScene ? (
          <BespokeScene room={room} active={active} />
        ) : (
          <>
            <RoomArchitecture room={room} active={active} />
            <RoomDisplays room={room} active={active} />
            <RoomFixtures room={room} active={active} />
            <SceneProps room={room} active={active} />
          </>
        )}
        <RoomAsset
          roomId={room.id}
          assetUrl={room.assetUrl}
          assetScale={room.assetScale}
          assetPosition={room.assetPosition}
          assetRotation={room.assetRotation}
          assetTargetSize={room.assetTargetSize}
          assetMaterialTuning={room.assetMaterialTuning}
          active={active}
          fallback={fallback}
        />
      </group>
      {active && <LifeMotes color={room.color} />}
      <RoomLighting room={room} active={active} />
    </group>
  );
}

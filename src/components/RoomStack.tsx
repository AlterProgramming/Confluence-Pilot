import { useEffect } from 'react';
import { useGLTF, useTexture } from '@react-three/drei';
import { rooms } from '../data/rooms';
import { sceneConfigs } from '../scenes/sceneConfigs';
import { useExperienceStore } from '../state/useExperienceStore';
import { Room } from './Room';
import { preloadRoomAsset } from './RoomAsset';

// Shared furniture is reused by every room — parse it once, up front, so no
// room ever pays a load/parse hitch when its furniture mounts mid-transition.
const FURNITURE = [
  'armchair', 'task-chair', 'office-desk', 'coffee-table', 'table',
  'sofa', 'bookshelf', 'planter', 'cabinet', 'ceiling-lamp',
  'modern_ceiling_lamp_01', 'ceiling_fan', 'mid_century_lounge_chair',
];
let furnitureQueued = false;

export function RoomStack() {
  const activeRoom = useExperienceStore((state) => state.activeRoom);
  const requestedRoom = useExperienceStore((state) => state.requestedRoom);
  const warmingRoom = useExperienceStore((state) => state.warmingRoom);
  const isTransitioning = useExperienceStore((state) => state.isTransitioning);

  useEffect(() => {
    if (furnitureQueued) return;
    furnitureQueued = true;
    FURNITURE.forEach((name) => useGLTF.preload(`/assets/furniture/${name}.glb`));
  }, []);

  useEffect(() => {
    const candidates = new Set([
      activeRoom,
      requestedRoom,
      warmingRoom ?? activeRoom,
      activeRoom - 1,
      activeRoom + 1,
      requestedRoom - 1,
      requestedRoom + 1,
    ]);
    candidates.forEach((index) => {
      const room = rooms[index];
      if (!room) return;
      if (room.assetUrl) preloadRoomAsset(room.assetUrl);
      const led = sceneConfigs[room.id]?.ledWall;
      if (led) useTexture.preload(led);
    });
  }, [activeRoom, requestedRoom, warmingRoom]);

  return (
    <group>
      {rooms.map((room, index) => {
        const nearActive = Math.abs(index - activeRoom) <= 1;
        const nearDestination = isTransitioning && Math.abs(index - requestedRoom) <= 1;
        const isWarming = warmingRoom === index && !isTransitioning && index !== activeRoom;
        const shouldRender = nearActive || nearDestination || isWarming;
        if (!shouldRender) return null;

        const active = index === activeRoom || (isTransitioning && index === requestedRoom);
        return (
          <Room
            key={room.id}
            room={room}
            active={active}
            warming={isWarming}
            settled={!isTransitioning && index === activeRoom}
          />
        );
      })}
    </group>
  );
}

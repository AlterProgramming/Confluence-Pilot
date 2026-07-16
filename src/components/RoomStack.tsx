import { useEffect } from 'react';
import { rooms } from '../data/rooms';
import { useExperienceStore } from '../state/useExperienceStore';
import { Room } from './Room';
import { preloadRoomAsset } from './RoomAsset';

export function RoomStack() {
  const activeRoom = useExperienceStore((state) => state.activeRoom);
  const requestedRoom = useExperienceStore((state) => state.requestedRoom);
  const isTransitioning = useExperienceStore((state) => state.isTransitioning);

  useEffect(() => {
    const candidates = new Set([
      activeRoom,
      requestedRoom,
      activeRoom - 1,
      activeRoom + 1,
      requestedRoom - 1,
      requestedRoom + 1,
    ]);
    candidates.forEach((index) => {
      const room = rooms[index];
      if (room?.assetUrl) preloadRoomAsset(room.assetUrl);
    });
  }, [activeRoom, requestedRoom]);

  return (
    <group>
      {rooms.map((room, index) => {
        const nearActive = Math.abs(index - activeRoom) <= 1;
        const nearDestination = isTransitioning && Math.abs(index - requestedRoom) <= 1;
        const shouldRender = nearActive || nearDestination;
        if (!shouldRender) return null;
        return (
          <Room
            key={room.id}
            room={room}
            active={index === activeRoom || (isTransitioning && index === requestedRoom)}
            settled={!isTransitioning && index === activeRoom}
          />
        );
      })}
    </group>
  );
}

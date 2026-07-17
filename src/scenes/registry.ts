import type { ComponentType } from 'react';
import type { RoomDefinition } from '../types/room';
import { GalleryForum } from './GalleryForum';
import { StandardRoom } from './StandardRoom';

export type RoomSceneProps = { room: RoomDefinition; active: boolean };

/**
 * Reference-matched room scenes keyed by room id. A room listed here replaces
 * the generic procedural stack with a real PBR-shell scene. Room 01 is fully
 * bespoke (GalleryForum); the rest use the config-driven StandardRoom.
 */
export const roomScenes: Record<string, ComponentType<RoomSceneProps>> = {
  '01': GalleryForum,
  '02': StandardRoom,
  '03': StandardRoom,
  '04': StandardRoom,
  '05': StandardRoom,
  '06': StandardRoom,
  '07': StandardRoom,
  '08': StandardRoom,
  '09': StandardRoom,
  '10': StandardRoom,
  '11': StandardRoom,
  '12': StandardRoom,
};

import type { ComponentType } from 'react';
import type { RoomDefinition } from '../types/room';
import { GalleryForum } from './GalleryForum';

export type RoomSceneProps = { room: RoomDefinition; active: boolean };

/**
 * Bespoke, reference-matched room scenes keyed by room id. A room listed here
 * replaces the generic procedural stack (architecture/displays/fixtures/props)
 * with a purpose-built scene. Rooms not listed fall back to the generic stack.
 */
export const roomScenes: Record<string, ComponentType<RoomSceneProps>> = {
  '01': GalleryForum,
};

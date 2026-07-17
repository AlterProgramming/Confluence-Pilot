import type { MaterialName } from '../materials/catalog';

export type RoomLayout = 'workbenches' | 'platform' | 'default';

export type SceneConfig = {
  floor: MaterialName;
  wall: MaterialName;
  wallColor?: string;
  floorRepeat?: [number, number];
  floorRoughness?: number;
  /** LED wall content image (only some rooms have one generated) */
  ledWall?: string;
  glazing?: 'left' | 'right';
  /** furniture arrangement archetype */
  layout?: RoomLayout;
};

const wall = (n: string) => `/assets/screens/room-${n}-wall.webp`;

/**
 * Per-room scene configuration for StandardRoom. Materials are matched to each
 * room's theme; wall colours are kept light so no room reads as a dark void.
 * Room 01 is fully bespoke (GalleryForum) and not listed here.
 */
export const sceneConfigs: Record<string, SceneConfig> = {
  '02': { floor: 'wood-floor', wall: 'plaster', wallColor: '#e7dccb', ledWall: wall('02'), glazing: 'left', layout: 'workbenches' },
  '03': { floor: 'concrete', wall: 'plaster', wallColor: '#dcdfe4', ledWall: wall('03'), layout: 'workbenches' },
  '04': { floor: 'metal-panel', wall: 'concrete', wallColor: '#bcc4cc', ledWall: wall('04'), layout: 'workbenches' },
  '05': { floor: 'concrete', wall: 'concrete', wallColor: '#b2b8c0', ledWall: wall('05'), layout: 'platform' },
  '06': { floor: 'concrete', wall: 'metal-panel', wallColor: '#c8ccd0', ledWall: wall('06'), layout: 'platform' },
  '07': { floor: 'metal-panel', wall: 'concrete', wallColor: '#bac0cc', ledWall: wall('07'), layout: 'platform' },
  '08': { floor: 'concrete', wall: 'metal-panel', wallColor: '#c6ced6', ledWall: wall('08'), layout: 'platform' },
  '09': { floor: 'metal-panel', wall: 'plaster', wallColor: '#d8dae2', ledWall: wall('09'), layout: 'platform' },
  '10': { floor: 'metal-panel', wall: 'metal-panel', wallColor: '#ccd2d8', ledWall: wall('10'), layout: 'workbenches' },
  '11': { floor: 'marble', wall: 'marble', wallColor: '#ece9e4', floorRoughness: 0.3, ledWall: wall('11'), glazing: 'right', layout: 'workbenches' },
  '12': { floor: 'wood-floor', wall: 'plaster', wallColor: '#ece0cd', ledWall: wall('12'), glazing: 'left', layout: 'default' },
};

export const defaultConfig: SceneConfig = { floor: 'concrete', wall: 'plaster', wallColor: '#d6d8de' };

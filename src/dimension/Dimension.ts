import type { RoomDefinition } from '../types/room';
import { rooms } from '../data/rooms';

export type DimensionLayerKind = 'sky' | 'memory' | 'inhabited' | 'foreground';
export type DimensionAnchorKind = 'anchor' | 'portal' | 'archive' | 'city' | 'heart';

export interface DimensionLayer {
  id: string;
  label: string;
  kind: DimensionLayerKind;
  depth: number;
  parallax: number;
  opacity: number;
}

export interface DimensionAnchor {
  id: string;
  label: string;
  kind: DimensionAnchorKind;
  position: [number, number, number];
  radius: number;
  color: string;
  description: string;
}

export interface DimensionPath {
  id: string;
  label: string;
  color: string;
  points: Array<[number, number, number]>;
}

export interface DimensionPortal {
  id: string;
  label: string;
  position: [number, number, number];
  radius: number;
  destination: string;
}

export interface DimensionSceneSpec {
  id: string;
  title: string;
  subtitle: string;
  law: string;
  roomCode: string;
  seedImageUrl: string;
  palette: {
    void: string;
    memory: string;
    thread: string;
    violet: string;
    blue: string;
  };
  camera: {
    position: [number, number, number];
    target: [number, number, number];
  };
  layers: DimensionLayer[];
  anchors: DimensionAnchor[];
  paths: DimensionPath[];
  portals: DimensionPortal[];
}

const rememberingSpec: Omit<DimensionSceneSpec, 'roomCode'> = {
  id: 'the-weight-of-remembering',
  title: 'The Weight of Remembering',
  subtitle: 'A living memory realm bound by love, thread, and light',
  law: 'What is remembered becomes real. What is loved stays.',
  seedImageUrl: '/reference/dimensions/the-weight-of-remembering.webp',
  palette: {
    void: '#030712',
    memory: '#ffbf71',
    thread: '#ffd9a0',
    violet: '#9f7cff',
    blue: '#6dc9ff',
  },
  camera: {
    position: [0, 0.6, 13.5],
    target: [0, 0, -2.8],
  },
  layers: [
    { id: 'sky-vault', label: 'Sky vault and celestial drift', kind: 'sky', depth: -10, parallax: 0.05, opacity: 1 },
    { id: 'memory-shell', label: 'Memory shell and floating constellations', kind: 'memory', depth: -7.4, parallax: 0.11, opacity: 0.2 },
    { id: 'thread-realm', label: 'Filament river and archive terraces', kind: 'inhabited', depth: -4.6, parallax: 0.22, opacity: 0.16 },
    { id: 'lantern-basin', label: 'Lantern city basin', kind: 'inhabited', depth: -2.2, parallax: 0.34, opacity: 0.11 },
    { id: 'chain-field', label: 'Foreground chain field', kind: 'foreground', depth: 0, parallax: 0.55, opacity: 0.08 },
  ],
  anchors: [
    {
      id: 'memory-shell',
      label: 'Memory shell',
      kind: 'anchor',
      position: [-6.25, 2.65, -2.1],
      radius: 0.42,
      color: '#ffbf71',
      description: 'An orb of carried moments. It bends the whole dimension around what cannot be put down.',
    },
    {
      id: 'heart-light',
      label: 'Heart-light nexus',
      kind: 'heart',
      position: [-3.05, 0.2, 0.2],
      radius: 0.36,
      color: '#ffe0a8',
      description: 'The source of connection. Threads gain strength when they pass through this point.',
    },
    {
      id: 'beloved-anchor',
      label: 'Beloved anchor',
      kind: 'anchor',
      position: [5.65, 1.55, -1.25],
      radius: 0.4,
      color: '#ffd7a2',
      description: 'A distant stable presence receiving the light without carrying its full weight.',
    },
    {
      id: 'photo-constellation',
      label: 'Photo constellations',
      kind: 'archive',
      position: [0.55, 2.8, -4.4],
      radius: 0.3,
      color: '#b69cff',
      description: 'Memory fragments held in orbit. Each can become an explorable scene rather than a flat frame.',
    },
    {
      id: 'archive-terraces',
      label: 'Archive terraces',
      kind: 'archive',
      position: [3.55, -1.4, -2.35],
      radius: 0.34,
      color: '#9f7cff',
      description: 'Layered repositories where remembered places become traversable architecture.',
    },
    {
      id: 'lantern-city',
      label: 'Lantern city basin',
      kind: 'city',
      position: [0.45, -3.2, -4.1],
      radius: 0.46,
      color: '#ffad5d',
      description: 'A city built from kept memories. Its lights persist only while pathways remain connected.',
    },
    {
      id: 'portal-horizon',
      label: 'Portal horizon',
      kind: 'portal',
      position: [7.15, 0.1, -4.9],
      radius: 0.5,
      color: '#7fc9ff',
      description: 'A threshold to parallel remembrances and future dimensions.',
    },
  ],
  paths: [
    {
      id: 'primary-thread',
      label: 'Primary memory filament',
      color: '#ffd9a0',
      points: [
        [-6.2, 2.4, -2.4],
        [-4.8, 1.1, -0.8],
        [-3.05, 0.2, 0.2],
        [-0.6, 0.8, -0.8],
        [2.6, 1.4, -1.0],
        [5.65, 1.55, -1.25],
      ],
    },
    {
      id: 'archive-current',
      label: 'Archive current',
      color: '#a68cff',
      points: [
        [-2.9, 0.15, -0.1],
        [-0.7, -0.8, -1.7],
        [1.2, -1.5, -2.5],
        [3.55, -1.4, -2.35],
        [5.6, 0.2, -1.5],
      ],
    },
    {
      id: 'lantern-descent',
      label: 'Lantern descent',
      color: '#ffad5d',
      points: [
        [-3.0, 0.1, 0],
        [-1.2, -1.0, -1.1],
        [-0.2, -2.1, -2.7],
        [0.45, -3.2, -4.1],
      ],
    },
    {
      id: 'portal-drift',
      label: 'Portal drift',
      color: '#6dc9ff',
      points: [
        [5.65, 1.55, -1.25],
        [6.5, 1.2, -2.7],
        [7.15, 0.1, -4.9],
      ],
    },
  ],
  portals: [
    {
      id: 'portal-horizon',
      label: 'Portal horizon',
      position: [7.15, 0.1, -4.9],
      radius: 0.78,
      destination: 'parallel-remembrance',
    },
  ],
};

const sceneByRoomCode: Record<string, Omit<DimensionSceneSpec, 'roomCode'>> = {
  '02': rememberingSpec,
};

function cloneSceneSpec(spec: DimensionSceneSpec): DimensionSceneSpec {
  return {
    ...spec,
    palette: { ...spec.palette },
    camera: {
      position: [...spec.camera.position] as [number, number, number],
      target: [...spec.camera.target] as [number, number, number],
    },
    layers: spec.layers.map((layer) => ({ ...layer })),
    anchors: spec.anchors.map((anchor) => ({
      ...anchor,
      position: [...anchor.position] as [number, number, number],
    })),
    paths: spec.paths.map((path) => ({
      ...path,
      points: path.points.map((point) => [...point] as [number, number, number]),
    })),
    portals: spec.portals.map((portal) => ({
      ...portal,
      position: [...portal.position] as [number, number, number],
    })),
  };
}

export class Dimension {
  readonly room: RoomDefinition;
  readonly roomCode: string;
  private readonly sceneSpec: DimensionSceneSpec;

  constructor(roomCode: string) {
    const room = rooms.find((candidate) => candidate.id === roomCode);
    if (!room) {
      throw new Error(`Unknown room code "${roomCode}".`);
    }

    const seededScene = sceneByRoomCode[roomCode];
    if (!seededScene) {
      throw new Error(`Room ${roomCode} does not have a dimension scene yet.`);
    }

    this.room = room;
    this.roomCode = roomCode;
    this.sceneSpec = { ...seededScene, roomCode };
  }

  buildScene(): DimensionSceneSpec {
    return cloneSceneSpec(this.sceneSpec);
  }

  static supports(roomCode: string): boolean {
    return roomCode in sceneByRoomCode;
  }
}

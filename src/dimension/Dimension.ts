export type DimensionLayerKind = 'sky' | 'memory' | 'inhabited' | 'foreground';
export type DimensionAnchorKind = 'anchor' | 'portal' | 'archive' | 'city' | 'heart';
export type DimensionEntranceKind = 'room' | 'route' | 'external';

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

export interface DimensionEntrance {
  id: string;
  kind: DimensionEntranceKind;
  sourceId: string;
  label: string;
  dimensionId: string;
  portalId?: string;
}

export interface DimensionDestinationNode {
  id: string;
  label: string;
  position: [number, number, number];
  radius: number;
  description: string;
}

export interface DimensionDestination {
  id: string;
  title: string;
  subtitle: string;
  law: string;
  returnPortalId: string;
  camera: {
    position: [number, number, number];
    target: [number, number, number];
  };
  palette: {
    primary: string;
    secondary: string;
    ambient: string;
  };
  nodes: DimensionDestinationNode[];
}

export interface DimensionSceneSpec {
  id: string;
  title: string;
  subtitle: string;
  law: string;
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
  destinations: DimensionDestination[];
  entrances: DimensionEntrance[];
}

const rememberingSpec: DimensionSceneSpec = {
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
    position: [0, 0.45, 13.8],
    target: [0, -0.05, -2.9],
  },
  layers: [
    { id: 'sky-vault', label: 'Sky vault and celestial drift', kind: 'sky', depth: -10, parallax: 0.035, opacity: 1 },
    { id: 'memory-shell', label: 'Memory shell and floating constellations', kind: 'memory', depth: -7.5, parallax: 0.08, opacity: 0.04 },
    { id: 'thread-realm', label: 'Filament river and archive terraces', kind: 'inhabited', depth: -4.8, parallax: 0.15, opacity: 0.032 },
    { id: 'lantern-basin', label: 'Lantern city basin', kind: 'inhabited', depth: -2.4, parallax: 0.22, opacity: 0.024 },
    { id: 'chain-field', label: 'Foreground chain field', kind: 'foreground', depth: 0, parallax: 0.32, opacity: 0.016 },
  ],
  anchors: [
    {
      id: 'memory-shell',
      label: 'Memory shell',
      kind: 'anchor',
      position: [-5.9, 2.55, -2.25],
      radius: 0.23,
      color: '#ffbf71',
      description: 'An orb of carried moments. It bends the whole dimension around what cannot be put down.',
    },
    {
      id: 'heart-light',
      label: 'Heart-light nexus',
      kind: 'heart',
      position: [-3.2, 0.15, 0.05],
      radius: 0.2,
      color: '#ffe0a8',
      description: 'The source of connection. Threads gain strength when they pass through this point.',
    },
    {
      id: 'beloved-anchor',
      label: 'Beloved anchor',
      kind: 'anchor',
      position: [4.85, 1.45, -1.45],
      radius: 0.22,
      color: '#ffd7a2',
      description: 'A distant stable presence receiving the light without carrying its full weight.',
    },
    {
      id: 'photo-constellation',
      label: 'Photo constellations',
      kind: 'archive',
      position: [0.35, 2.6, -4.5],
      radius: 0.17,
      color: '#b69cff',
      description: 'Memory fragments held in orbit. Each can become an explorable scene rather than a flat frame.',
    },
    {
      id: 'archive-terraces',
      label: 'Archive terraces',
      kind: 'archive',
      position: [3.35, -1.35, -2.6],
      radius: 0.18,
      color: '#9f7cff',
      description: 'Layered repositories where remembered places become traversable architecture.',
    },
    {
      id: 'lantern-city',
      label: 'Lantern city basin',
      kind: 'city',
      position: [0.25, -3.05, -4.2],
      radius: 0.24,
      color: '#ffad5d',
      description: 'A city built from kept memories. Its lights persist only while pathways remain connected.',
    },
    {
      id: 'portal-horizon',
      label: 'Portal horizon',
      kind: 'portal',
      position: [6.55, 0.0, -4.95],
      radius: 0.1,
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
        [-5.9, 2.45, -2.4],
        [-4.7, 1.15, -0.9],
        [-3.2, 0.15, 0.05],
        [-0.75, 0.7, -0.95],
        [2.3, 1.25, -1.15],
        [4.85, 1.45, -1.45],
      ],
    },
    {
      id: 'archive-current',
      label: 'Archive current',
      color: '#a68cff',
      points: [
        [-3.1, 0.08, -0.1],
        [-0.8, -0.75, -1.65],
        [1.1, -1.45, -2.55],
        [3.35, -1.35, -2.6],
        [4.8, 0.15, -1.6],
      ],
    },
    {
      id: 'lantern-descent',
      label: 'Lantern descent',
      color: '#ffad5d',
      points: [
        [-3.1, 0.08, -0.05],
        [-1.25, -0.95, -1.2],
        [-0.35, -2.0, -2.8],
        [0.25, -3.05, -4.2],
      ],
    },
    {
      id: 'portal-drift',
      label: 'Portal drift',
      color: '#6dc9ff',
      points: [
        [4.85, 1.45, -1.45],
        [5.75, 1.0, -2.9],
        [6.55, 0.0, -4.95],
      ],
    },
  ],
  portals: [
    {
      id: 'portal-horizon',
      label: 'Portal horizon',
      position: [6.55, 0.0, -4.95],
      radius: 0.15,
      destination: 'parallel-remembrance',
    },
  ],
  destinations: [
    {
      id: 'parallel-remembrance',
      title: 'Parallel Remembrance',
      subtitle: 'A realm where every memory continues along paths not taken',
      law: 'What might have been is not false. It is simply unchosen.',
      returnPortalId: 'portal-horizon',
      camera: {
        position: [6.55, 0.6, -11.8],
        target: [6.55, 0.0, -15.2],
      },
      palette: {
        primary: '#bda7ff',
        secondary: '#79d8ff',
        ambient: '#150d34',
      },
      nodes: [
        {
          id: 'unwritten-archive',
          label: 'Unwritten archive',
          position: [4.4, 1.25, -15.1],
          radius: 0.22,
          description: 'Pages for memories that never became history, preserved without pretending they occurred.',
        },
        {
          id: 'echo-bridge',
          label: 'Echo bridge',
          position: [6.55, -0.75, -16.4],
          radius: 0.2,
          description: 'A crossing between what was lived and what was possible, stable only while both truths remain distinct.',
        },
        {
          id: 'unlived-garden',
          label: 'Unlived garden',
          position: [8.75, 0.9, -15.4],
          radius: 0.22,
          description: 'A growing field of futures released from obligation, where possibility can exist without becoming a demand.',
        },
      ],
    },
  ],
  entrances: [
    {
      id: 'room-02-memory-threshold',
      kind: 'room',
      sourceId: '02',
      label: 'Room 02 memory threshold',
      dimensionId: 'the-weight-of-remembering',
      portalId: 'portal-horizon',
    },
    {
      id: 'standalone-dimension-route',
      kind: 'route',
      sourceId: '/dimension',
      label: 'Standalone dimension review route',
      dimensionId: 'the-weight-of-remembering',
    },
  ],
};

const sceneByDimensionId: Record<string, DimensionSceneSpec> = {
  [rememberingSpec.id]: rememberingSpec,
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
    destinations: spec.destinations.map((destination) => ({
      ...destination,
      camera: {
        position: [...destination.camera.position] as [number, number, number],
        target: [...destination.camera.target] as [number, number, number],
      },
      palette: { ...destination.palette },
      nodes: destination.nodes.map((node) => ({
        ...node,
        position: [...node.position] as [number, number, number],
      })),
    })),
    entrances: spec.entrances.map((entrance) => ({ ...entrance })),
  };
}

function findEntrance(kind: DimensionEntranceKind, sourceId: string): DimensionEntrance | null {
  for (const scene of Object.values(sceneByDimensionId)) {
    const entrance = scene.entrances.find((candidate) => candidate.kind === kind && candidate.sourceId === sourceId);
    if (entrance) return entrance;
  }
  return null;
}

export class Dimension {
  readonly id: string;
  private readonly sceneSpec: DimensionSceneSpec;

  constructor(dimensionId: string) {
    const scene = sceneByDimensionId[dimensionId];
    if (!scene) {
      throw new Error(`Unknown dimension "${dimensionId}".`);
    }

    this.id = dimensionId;
    this.sceneSpec = scene;
  }

  buildScene(): DimensionSceneSpec {
    return cloneSceneSpec(this.sceneSpec);
  }

  static fromEntrance(kind: DimensionEntranceKind, sourceId: string): Dimension {
    const entrance = findEntrance(kind, sourceId);
    if (!entrance) {
      throw new Error(`No dimension entrance is registered for ${kind} "${sourceId}".`);
    }
    return new Dimension(entrance.dimensionId);
  }

  static supports(dimensionId: string): boolean {
    return dimensionId in sceneByDimensionId;
  }

  static list(): string[] {
    return Object.keys(sceneByDimensionId);
  }

  static entrancesFor(dimensionId: string): DimensionEntrance[] {
    const scene = sceneByDimensionId[dimensionId];
    return scene ? scene.entrances.map((entrance) => ({ ...entrance })) : [];
  }
}

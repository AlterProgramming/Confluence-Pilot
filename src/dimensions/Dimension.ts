import type { RoomDefinition } from '../types/room';

export type DimensionMotion =
  | 'sway'
  | 'drift'
  | 'flutter'
  | 'orbit'
  | 'spiral'
  | 'ripple'
  | 'flicker'
  | 'glow'
  | 'pulse';

export type DimensionNodeKind =
  | 'star'
  | 'photo'
  | 'chain'
  | 'thread'
  | 'petal'
  | 'moth'
  | 'lantern'
  | 'city-light'
  | 'mist'
  | 'portal'
  | 'anchor'
  | 'memory-orb';

export type DimensionNode = {
  id: string;
  label: string;
  kind: DimensionNodeKind;
  motion: DimensionMotion;
  x: number;
  y: number;
  depth: number;
  radius: number;
  speed: number;
  phase: number;
  amplitude: number;
  color: string;
  interactive?: boolean;
};

export type DimensionZone = {
  id: string;
  label: string;
  role: string;
  center: [number, number];
  radius: number;
};

export type DimensionLayer = {
  id: string;
  label: string;
  depth: number;
  parallax: number;
  opacity: number;
};

export type DimensionPath = {
  id: string;
  label: string;
  points: Array<[number, number]>;
  color: string;
  speed: number;
};

export type DimensionManifest = {
  id: string;
  title: string;
  subtitle: string;
  seedImage: string;
  room: RoomDefinition;
  law: string;
  layers: DimensionLayer[];
  zones: DimensionZone[];
  paths: DimensionPath[];
  nodes: DimensionNode[];
};

export type DimensionRuntimeSnapshot = {
  id: string;
  title: string;
  roomId: string;
  nodeCount: number;
  activeNodeCount: number;
  layerCount: number;
  zoneCount: number;
  pathCount: number;
  pointer: [number, number];
  elapsedSeconds: number;
};

export class Dimension {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly law: string;
  readonly seedImage: string;
  readonly room: RoomDefinition;
  readonly layers: readonly DimensionLayer[];
  readonly zones: readonly DimensionZone[];
  readonly paths: readonly DimensionPath[];
  readonly nodes: readonly DimensionNode[];

  private pointer: [number, number] = [0, 0];
  private elapsedSeconds = 0;

  private constructor(manifest: DimensionManifest) {
    this.id = manifest.id;
    this.title = manifest.title;
    this.subtitle = manifest.subtitle;
    this.law = manifest.law;
    this.seedImage = manifest.seedImage;
    this.room = manifest.room;
    this.layers = manifest.layers;
    this.zones = manifest.zones;
    this.paths = manifest.paths;
    this.nodes = manifest.nodes;
  }

  static fromRoom(room: RoomDefinition, manifest: Omit<DimensionManifest, 'room'>) {
    if (manifest.nodes.length < 40) {
      throw new Error(`Dimension ${manifest.id} requires at least 40 independently addressable nodes.`);
    }
    const ids = new Set<string>();
    for (const node of manifest.nodes) {
      if (ids.has(node.id)) throw new Error(`Duplicate dimension node: ${node.id}`);
      ids.add(node.id);
      if (![node.x, node.y, node.depth, node.radius, node.speed, node.phase, node.amplitude].every(Number.isFinite)) {
        throw new Error(`Non-finite values in dimension node: ${node.id}`);
      }
    }
    return new Dimension({ ...manifest, room });
  }

  setPointer(x: number, y: number) {
    this.pointer = [Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))];
  }

  tick(deltaSeconds: number) {
    this.elapsedSeconds += Math.max(0, Math.min(deltaSeconds, 0.1));
  }

  snapshot(): DimensionRuntimeSnapshot {
    return {
      id: this.id,
      title: this.title,
      roomId: this.room.id,
      nodeCount: this.nodes.length,
      activeNodeCount: this.nodes.length,
      layerCount: this.layers.length,
      zoneCount: this.zones.length,
      pathCount: this.paths.length,
      pointer: this.pointer,
      elapsedSeconds: this.elapsedSeconds,
    };
  }

  sampleNode(node: DimensionNode) {
    const t = this.elapsedSeconds * node.speed + node.phase;
    const pointerX = this.pointer[0] * node.depth * 0.018;
    const pointerY = this.pointer[1] * node.depth * 0.012;
    let dx = 0;
    let dy = 0;
    let rotation = 0;
    let alpha = 1;
    let scale = 1;

    switch (node.motion) {
      case 'sway':
        dx = Math.sin(t) * node.amplitude;
        rotation = Math.sin(t * 0.7) * 0.08;
        break;
      case 'drift':
        dx = Math.sin(t * 0.63) * node.amplitude;
        dy = Math.cos(t * 0.47) * node.amplitude * 0.75;
        break;
      case 'flutter':
        dx = Math.sin(t * 2.1) * node.amplitude;
        dy = Math.cos(t * 1.7) * node.amplitude * 0.8;
        rotation = Math.sin(t * 3.2) * 0.35;
        break;
      case 'orbit':
        dx = Math.cos(t) * node.amplitude;
        dy = Math.sin(t) * node.amplitude;
        break;
      case 'spiral': {
        const radius = node.amplitude * (0.55 + 0.45 * Math.sin(t * 0.21));
        dx = Math.cos(t) * radius;
        dy = Math.sin(t) * radius;
        rotation = t;
        break;
      }
      case 'ripple':
        scale = 0.85 + 0.25 * (0.5 + 0.5 * Math.sin(t));
        alpha = 0.45 + 0.45 * (0.5 + 0.5 * Math.sin(t));
        break;
      case 'flicker':
        alpha = 0.45 + 0.55 * Math.abs(Math.sin(t * 2.7) * Math.cos(t * 0.9));
        scale = 0.92 + alpha * 0.12;
        break;
      case 'glow':
        alpha = 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(t));
        scale = 0.9 + 0.18 * (0.5 + 0.5 * Math.sin(t));
        break;
      case 'pulse':
        scale = 0.82 + 0.32 * (0.5 + 0.5 * Math.sin(t));
        alpha = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(t));
        break;
    }

    return {
      x: node.x + dx + pointerX,
      y: node.y + dy + pointerY,
      rotation,
      alpha,
      scale,
    };
  }
}

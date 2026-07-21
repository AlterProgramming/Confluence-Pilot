import type { DimensionAnchor, DimensionAnchorKind, DimensionSceneSpec } from './Dimension';

export type WorldFabricBiome =
  | 'memory-meadow'
  | 'archive-ridge'
  | 'lantern-basin'
  | 'thread-marsh'
  | 'void-highland';

export type WorldFabricLod = 'near' | 'middle' | 'horizon';

export interface WorldFabricCell {
  id: string;
  grid: [number, number];
  center: [number, number, number];
  elevation: number;
  moisture: number;
  density: number;
  biome: WorldFabricBiome;
  lod: WorldFabricLod;
  nearestAnchorId: string | null;
}

export interface WorldFabricRoute {
  id: string;
  label: string;
  color: string;
  points: Array<[number, number, number]>;
}

export interface WorldFabricSettlement {
  id: string;
  label: string;
  kind: DimensionAnchorKind;
  center: [number, number, number];
  radius: number;
  tiers: number;
}

export interface WorldFabricSpec {
  id: string;
  seed: number;
  origin: [number, number, number];
  gridRadius: number;
  gridDiameter: number;
  cellSize: number;
  cells: WorldFabricCell[];
  routes: WorldFabricRoute[];
  settlements: WorldFabricSettlement[];
  stats: {
    cellCount: number;
    biomeCount: number;
    routeCount: number;
    settlementCount: number;
    shapeFamilyCount: number;
  };
}

export interface WorldFabricOptions {
  seed?: number;
  gridRadius?: number;
  cellSize?: number;
  originZ?: number;
}

const DEFAULT_SEED = 7319;
const DEFAULT_GRID_RADIUS = 9;
const DEFAULT_CELL_SIZE = 1.35;
const DEFAULT_ORIGIN_Z = -5;

function fract(value: number): number {
  return value - Math.floor(value);
}

export function worldFabricRandom(seed: number, x: number, z: number): number {
  return fract(Math.sin(x * 127.1 + z * 311.7 + seed * 0.017) * 43758.5453123);
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function valueNoise(seed: number, x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = smoothstep(x - x0);
  const tz = smoothstep(z - z0);
  const a = worldFabricRandom(seed, x0, z0);
  const b = worldFabricRandom(seed, x0 + 1, z0);
  const c = worldFabricRandom(seed, x0, z0 + 1);
  const d = worldFabricRandom(seed, x0 + 1, z0 + 1);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * tz;
}

function fbm(seed: number, x: number, z: number): number {
  let value = 0;
  let amplitude = 0.58;
  let frequency = 0.2;
  let normalization = 0;
  for (let octave = 0; octave < 4; octave += 1) {
    value += valueNoise(seed + octave * 101, x * frequency, z * frequency) * amplitude;
    normalization += amplitude;
    amplitude *= 0.52;
    frequency *= 2.08;
  }
  return value / normalization;
}

function anchorHeightContribution(anchor: DimensionAnchor, x: number, z: number): number {
  const dx = x - anchor.position[0];
  const dz = z - anchor.position[2];
  const distanceSquared = dx * dx + dz * dz;
  const spread = anchor.kind === 'city' ? 13 : anchor.kind === 'archive' ? 9 : 7;
  const weight = Math.exp(-distanceSquared / spread);
  switch (anchor.kind) {
    case 'city':
      return -0.68 * weight;
    case 'archive':
      return 0.72 * weight;
    case 'heart':
      return 0.32 * weight;
    case 'portal':
      return -0.18 * weight;
    default:
      return 0.16 * weight;
  }
}

export function sampleWorldElevation(
  scene: DimensionSceneSpec,
  x: number,
  z: number,
  seed = DEFAULT_SEED,
): number {
  const broad = fbm(seed, x, z) - 0.5;
  const detail = fbm(seed + 9001, x * 1.75, z * 1.75) - 0.5;
  const semantic = scene.anchors.reduce(
    (sum, anchor) => sum + anchorHeightContribution(anchor, x, z),
    0,
  );
  const horizonRise = Math.max(0, (Math.hypot(x, z - DEFAULT_ORIGIN_Z) - 7.5) / 8.5);
  return -4.28 + broad * 2.35 + detail * 0.52 + semantic + horizonRise * 1.55;
}

function nearestAnchor(scene: DimensionSceneSpec, x: number, z: number): {
  anchor: DimensionAnchor | null;
  distance: number;
} {
  let result: DimensionAnchor | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const anchor of scene.anchors) {
    const nextDistance = Math.hypot(x - anchor.position[0], z - anchor.position[2]);
    if (nextDistance < distance) {
      result = anchor;
      distance = nextDistance;
    }
  }
  return { anchor: result, distance };
}

function classifyBiome(
  nearest: { anchor: DimensionAnchor | null; distance: number },
  elevation: number,
  moisture: number,
): WorldFabricBiome {
  if (nearest.anchor && nearest.distance < 3.7) {
    if (nearest.anchor.kind === 'city') return 'lantern-basin';
    if (nearest.anchor.kind === 'archive') return 'archive-ridge';
    if (nearest.anchor.kind === 'portal') return 'thread-marsh';
  }
  if (elevation > -3.05) return 'void-highland';
  if (moisture > 0.64) return 'thread-marsh';
  return 'memory-meadow';
}

function cellLod(gridX: number, gridZ: number): WorldFabricLod {
  const radius = Math.max(Math.abs(gridX), Math.abs(gridZ));
  if (radius <= 3) return 'near';
  if (radius <= 6) return 'middle';
  return 'horizon';
}

function buildRoutes(scene: DimensionSceneSpec, seed: number): WorldFabricRoute[] {
  return scene.paths.map((path) => ({
    id: `fabric-route-${path.id}`,
    label: path.label,
    color: path.color,
    points: path.points.map(([x, _y, z]) => [
      x,
      sampleWorldElevation(scene, x, z, seed) + 0.11,
      z,
    ]),
  }));
}

function buildSettlements(scene: DimensionSceneSpec, seed: number): WorldFabricSettlement[] {
  return scene.anchors
    .filter((anchor) => ['city', 'archive', 'heart', 'portal'].includes(anchor.kind))
    .map((anchor, index) => ({
      id: `fabric-settlement-${anchor.id}`,
      label: anchor.label,
      kind: anchor.kind,
      center: [
        anchor.position[0],
        sampleWorldElevation(scene, anchor.position[0], anchor.position[2], seed) + 0.04,
        anchor.position[2],
      ],
      radius: 0.75 + anchor.radius * 2.8,
      tiers: 3 + ((index + seed) % 4),
    }));
}

export function generateWorldFabric(
  scene: DimensionSceneSpec,
  options: WorldFabricOptions = {},
): WorldFabricSpec {
  const seed = options.seed ?? DEFAULT_SEED;
  const gridRadius = options.gridRadius ?? DEFAULT_GRID_RADIUS;
  const cellSize = options.cellSize ?? DEFAULT_CELL_SIZE;
  const originZ = options.originZ ?? DEFAULT_ORIGIN_Z;
  const gridDiameter = gridRadius * 2 + 1;
  const cells: WorldFabricCell[] = [];

  for (let gridZ = -gridRadius; gridZ <= gridRadius; gridZ += 1) {
    for (let gridX = -gridRadius; gridX <= gridRadius; gridX += 1) {
      const x = gridX * cellSize;
      const z = originZ + gridZ * cellSize;
      const elevation = sampleWorldElevation(scene, x, z, seed);
      const moisture = fbm(seed + 420, x * 0.72, z * 0.72);
      const density = worldFabricRandom(seed + 73, gridX, gridZ);
      const nearest = nearestAnchor(scene, x, z);
      cells.push({
        id: `world-cell-${gridX + gridRadius}-${gridZ + gridRadius}`,
        grid: [gridX, gridZ],
        center: [x, elevation, z],
        elevation,
        moisture,
        density,
        biome: classifyBiome(nearest, elevation, moisture),
        lod: cellLod(gridX, gridZ),
        nearestAnchorId: nearest.anchor?.id ?? null,
      });
    }
  }

  const routes = buildRoutes(scene, seed);
  const settlements = buildSettlements(scene, seed);
  return {
    id: `${scene.id}-world-fabric`,
    seed,
    origin: [0, -4.28, originZ],
    gridRadius,
    gridDiameter,
    cellSize,
    cells,
    routes,
    settlements,
    stats: {
      cellCount: cells.length,
      biomeCount: new Set(cells.map((cell) => cell.biome)).size,
      routeCount: routes.length,
      settlementCount: settlements.length,
      shapeFamilyCount: 5,
    },
  };
}

import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
} from 'three';
import type { AnchorProposal, ImageWorldDraft } from '../compiler/contracts';
import type {
  WorldFabricBiome,
  WorldFabricCell,
  WorldFabricSpec,
} from '../WorldFabric';

const BIOME_COLORS: Record<WorldFabricBiome, string> = {
  'memory-meadow': '#6e6684',
  'archive-ridge': '#9b83c8',
  'lantern-basin': '#9b613f',
  'thread-marsh': '#427894',
  'void-highland': '#42385f',
};

export interface TerrainBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface TraversableSpawn {
  cellId: string;
  routeId: string | null;
  nearestAnchorId: string | null;
  groundPosition: [number, number, number];
  facing: [number, number];
  respawnGroundPosition: [number, number, number];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function cellIndex(fabric: WorldFabricSpec, gridX: number, gridZ: number): number {
  return (gridZ + fabric.gridRadius) * fabric.gridDiameter + gridX + fabric.gridRadius;
}

function cellAtGrid(
  fabric: WorldFabricSpec,
  gridX: number,
  gridZ: number,
): WorldFabricCell | null {
  if (
    gridX < -fabric.gridRadius
    || gridX > fabric.gridRadius
    || gridZ < -fabric.gridRadius
    || gridZ > fabric.gridRadius
  ) return null;
  return fabric.cells[cellIndex(fabric, gridX, gridZ)] ?? null;
}

export function terrainBounds(fabric: WorldFabricSpec): TerrainBounds {
  const half = fabric.gridRadius * fabric.cellSize;
  return {
    minX: -half,
    maxX: half,
    minZ: fabric.origin[2] - half,
    maxZ: fabric.origin[2] + half,
  };
}

export function sampleTerrainHeight(fabric: WorldFabricSpec, x: number, z: number): number {
  const bounds = terrainBounds(fabric);
  const safeX = clamp(x, bounds.minX, bounds.maxX);
  const safeZ = clamp(z, bounds.minZ, bounds.maxZ);
  const floatingX = safeX / fabric.cellSize + fabric.gridRadius;
  const floatingZ = (safeZ - fabric.origin[2]) / fabric.cellSize + fabric.gridRadius;
  const x0Index = Math.floor(floatingX);
  const z0Index = Math.floor(floatingZ);
  const x1Index = Math.min(fabric.gridDiameter - 1, x0Index + 1);
  const z1Index = Math.min(fabric.gridDiameter - 1, z0Index + 1);
  const tx = floatingX - x0Index;
  const tz = floatingZ - z0Index;
  const gridX0 = x0Index - fabric.gridRadius;
  const gridX1 = x1Index - fabric.gridRadius;
  const gridZ0 = z0Index - fabric.gridRadius;
  const gridZ1 = z1Index - fabric.gridRadius;
  const fallback = fabric.origin[1];
  const h00 = cellAtGrid(fabric, gridX0, gridZ0)?.elevation ?? fallback;
  const h10 = cellAtGrid(fabric, gridX1, gridZ0)?.elevation ?? h00;
  const h01 = cellAtGrid(fabric, gridX0, gridZ1)?.elevation ?? h00;
  const h11 = cellAtGrid(fabric, gridX1, gridZ1)?.elevation ?? h10;
  const top = h00 + (h10 - h00) * tx;
  const bottom = h01 + (h11 - h01) * tx;
  return top + (bottom - top) * tz;
}

export function findCellAtWorld(
  fabric: WorldFabricSpec,
  x: number,
  z: number,
): WorldFabricCell | null {
  const gridX = Math.round(x / fabric.cellSize);
  const gridZ = Math.round((z - fabric.origin[2]) / fabric.cellSize);
  return cellAtGrid(fabric, gridX, gridZ);
}

export function activeDraftAnchors(draft: ImageWorldDraft): AnchorProposal[] {
  return draft.proposals.anchors.filter((anchor) => anchor.status !== 'rejected');
}

function pointDistanceToRoute(
  x: number,
  z: number,
  points: Array<[number, number, number]>,
): number {
  let best = Number.POSITIVE_INFINITY;
  for (const point of points) {
    best = Math.min(best, Math.hypot(x - point[0], z - point[2]));
  }
  return Number.isFinite(best) ? best : 0;
}

function localRelief(fabric: WorldFabricSpec, cell: WorldFabricCell): number {
  let relief = 0;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const neighbor = cellAtGrid(fabric, cell.grid[0] + dx, cell.grid[1] + dz);
    if (neighbor) relief = Math.max(relief, Math.abs(neighbor.elevation - cell.elevation));
  }
  return relief;
}

export function chooseTraversableSpawn(draft: ImageWorldDraft): TraversableSpawn {
  const fabric = draft.compiledFabric;
  const anchors = activeDraftAnchors(draft)
    .slice()
    .sort((a, b) => {
      const acceptedDelta = Number(b.status === 'accepted') - Number(a.status === 'accepted');
      if (acceptedDelta !== 0) return acceptedDelta;
      const portalDelta = Number(a.kind === 'portal') - Number(b.kind === 'portal');
      if (portalDelta !== 0) return portalDelta;
      return b.confidence - a.confidence;
    });
  const targetAnchor = anchors[0] ?? null;
  const mainRoute = fabric.routes.find((route) => route.id === 'image-route-main')
    ?? fabric.routes[0]
    ?? null;
  let bestCell = fabric.cells.find((cell) => cell.lod === 'near') ?? fabric.cells[0] ?? null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const cell of fabric.cells) {
    const anchorDistance = targetAnchor
      ? Math.hypot(cell.center[0] - targetAnchor.worldPosition[0], cell.center[2] - targetAnchor.worldPosition[2])
      : 0;
    const approachScore = targetAnchor ? Math.abs(anchorDistance - 1.8) : 0;
    const routeScore = mainRoute ? pointDistanceToRoute(cell.center[0], cell.center[2], mainRoute.points) * 0.24 : 0;
    const lodPenalty = cell.lod === 'horizon' ? 8 : cell.lod === 'middle' ? 0.6 : 0;
    const biomePenalty = cell.biome === 'void-highland' ? 2.8 : cell.biome === 'thread-marsh' ? 0.9 : 0;
    const reliefPenalty = localRelief(fabric, cell) * 2.3;
    const score = approachScore + routeScore + lodPenalty + biomePenalty + reliefPenalty;
    if (score < bestScore) {
      bestScore = score;
      bestCell = cell;
    }
  }

  if (!bestCell) {
    const fallbackY = sampleTerrainHeight(fabric, 0, fabric.origin[2]);
    return {
      cellId: 'world-cell-fallback',
      routeId: mainRoute?.id ?? null,
      nearestAnchorId: targetAnchor?.id ?? null,
      groundPosition: [0, fallbackY, fabric.origin[2]],
      facing: [0, -1],
      respawnGroundPosition: [0, fallbackY, fabric.origin[2]],
    };
  }

  const groundY = sampleTerrainHeight(fabric, bestCell.center[0], bestCell.center[2]);
  let facingX = 0;
  let facingZ = -1;
  if (targetAnchor) {
    facingX = targetAnchor.worldPosition[0] - bestCell.center[0];
    facingZ = targetAnchor.worldPosition[2] - bestCell.center[2];
    const length = Math.hypot(facingX, facingZ) || 1;
    facingX /= length;
    facingZ /= length;
  } else if (mainRoute && mainRoute.points.length > 1) {
    const first = mainRoute.points[0];
    const second = mainRoute.points[1];
    if (first && second) {
      facingX = second[0] - first[0];
      facingZ = second[2] - first[2];
      const length = Math.hypot(facingX, facingZ) || 1;
      facingX /= length;
      facingZ /= length;
    }
  }

  return {
    cellId: bestCell.id,
    routeId: mainRoute?.id ?? null,
    nearestAnchorId: targetAnchor?.id ?? null,
    groundPosition: [bestCell.center[0], groundY, bestCell.center[2]],
    facing: [facingX, facingZ],
    respawnGroundPosition: [bestCell.center[0], groundY, bestCell.center[2]],
  };
}

export function buildContinuousTerrainGeometry(fabric: WorldFabricSpec): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let gridZ = -fabric.gridRadius; gridZ <= fabric.gridRadius; gridZ += 1) {
    for (let gridX = -fabric.gridRadius; gridX <= fabric.gridRadius; gridX += 1) {
      const cell = cellAtGrid(fabric, gridX, gridZ);
      const x = gridX * fabric.cellSize;
      const z = fabric.origin[2] + gridZ * fabric.cellSize;
      const y = cell?.elevation ?? sampleTerrainHeight(fabric, x, z);
      const color = new Color(BIOME_COLORS[cell?.biome ?? 'memory-meadow']);
      positions.push(x, y, z);
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let z = 0; z < fabric.gridDiameter - 1; z += 1) {
    for (let x = 0; x < fabric.gridDiameter - 1; x += 1) {
      const a = z * fabric.gridDiameter + x;
      const b = a + 1;
      const c = a + fabric.gridDiameter;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

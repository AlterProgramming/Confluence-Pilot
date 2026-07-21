import type { DimensionAnchorKind } from '../Dimension';
import {
  worldFabricRandom,
  type WorldFabricBiome,
  type WorldFabricCell,
  type WorldFabricSpec,
} from '../WorldFabric';
import type {
  AnchorProposal,
  BiomeProposal,
  CompilerStyleBias,
  FocalObject,
  ImageWorldDraft,
  ImageWorldProposals,
  Point2D,
  PortalProposal,
  ProposalStatus,
  RouteProposal,
  SemanticRegion,
  SettlementProposal,
  TerrainProposal,
} from './contracts';

const GRID_RADIUS = 9;
const CELL_SIZE = 1.35;
const ORIGIN_Z = -5;
const WORLD_BACK = ORIGIN_Z - GRID_RADIUS * CELL_SIZE;
const WORLD_FRONT = ORIGIN_Z + GRID_RADIUS * CELL_SIZE;

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function projectImageToWorld(
  point: Point2D,
  imageWidth: number,
  imageHeight: number,
  horizonY: number,
): [number, number, number] {
  const nx = clamp(point.x / imageWidth);
  const depth = clamp((point.y - horizonY) / Math.max(1, imageHeight - horizonY));
  const perspectiveWidth = 6.4 + depth * 17.2;
  const x = (nx - 0.5) * perspectiveWidth;
  const z = WORLD_BACK + depth * (WORLD_FRONT - WORLD_BACK);
  return [x, -4.15, z];
}

function projectWorldToImage(
  x: number,
  z: number,
  imageWidth: number,
  imageHeight: number,
  horizonY: number,
): Point2D {
  const depth = clamp((z - WORLD_BACK) / (WORLD_FRONT - WORLD_BACK));
  const perspectiveWidth = 6.4 + depth * 17.2;
  return {
    x: clamp(x / perspectiveWidth + 0.5) * imageWidth,
    y: horizonY + depth * (imageHeight - horizonY),
  };
}

function regionAtPoint(regions: SemanticRegion[], point: Point2D): SemanticRegion | null {
  return regions.find((region) => (
    point.x >= region.bbox.x
    && point.x <= region.bbox.x + region.bbox.width
    && point.y >= region.bbox.y
    && point.y <= region.bbox.y + region.bbox.height
  )) ?? null;
}

function biomeForRegion(region: SemanticRegion): WorldFabricBiome {
  switch (region.kind) {
    case 'structure':
    case 'landmark':
      return 'archive-ridge';
    case 'path':
      return 'lantern-basin';
    case 'water':
      return 'thread-marsh';
    case 'sky':
      return 'void-highland';
    case 'vegetation':
    case 'ground':
      return 'memory-meadow';
    default:
      return region.metrics.blue > region.metrics.red ? 'thread-marsh' : 'memory-meadow';
  }
}

function anchorKindForObject(object: FocalObject, index: number, imageWidth: number): DimensionAnchorKind {
  const aspect = object.bbox.height / Math.max(1, object.bbox.width);
  const centerDistance = Math.abs(object.center.x / imageWidth - 0.5);
  if (index === 0 && centerDistance < 0.2 && object.saliency > 0.3) return 'heart';
  if (aspect > 1.15) return 'archive';
  if (aspect < 0.75) return 'city';
  return index % 2 === 0 ? 'city' : 'archive';
}

function styleObjectCount(styleBias: CompilerStyleBias): number {
  if (styleBias === 'literal') return 3;
  if (styleBias === 'interpretive') return 5;
  return 4;
}

export function proposeWorldStructure(args: {
  imageWidth: number;
  imageHeight: number;
  horizonY: number;
  styleBias: CompilerStyleBias;
  semanticRegions: SemanticRegion[];
  focalObjects: FocalObject[];
  traversableRegionIds: string[];
}): ImageWorldProposals {
  const {
    imageWidth,
    imageHeight,
    horizonY,
    styleBias,
    semanticRegions,
    focalObjects,
    traversableRegionIds,
  } = args;
  const selectedObjects = focalObjects.slice(0, styleObjectCount(styleBias));
  const anchors: AnchorProposal[] = selectedObjects.map((object, index) => {
    const kind = anchorKindForObject(object, index, imageWidth);
    return {
      id: `image-anchor-${index + 1}`,
      label: kind === 'city'
        ? `Settlement cluster ${index + 1}`
        : kind === 'archive'
          ? `Archive landmark ${index + 1}`
          : `Image heart ${index + 1}`,
      kind,
      imagePosition: object.center,
      worldPosition: projectImageToWorld(object.center, imageWidth, imageHeight, horizonY),
      confidence: object.confidence,
      rationale: `The source region has ${(object.saliency * 100).toFixed(0)}% relative saliency and a ${object.bbox.width.toFixed(0)} × ${object.bbox.height.toFixed(0)} analysis footprint.`,
      sourceRegionId: object.regionId,
      sourceObjectId: object.id,
      status: index < 2 ? 'accepted' : 'proposed',
    };
  });

  const traversableRegions = traversableRegionIds
    .map((id) => semanticRegions.find((region) => region.id === id))
    .filter((region): region is SemanticRegion => Boolean(region));
  const thresholdRegion = [...traversableRegions]
    .sort((a, b) => Math.abs(a.center.y - horizonY) - Math.abs(b.center.y - horizonY))[0];
  const portalImagePosition = thresholdRegion?.center ?? { x: imageWidth * 0.5, y: horizonY + imageHeight * 0.08 };
  const portalAnchor: AnchorProposal = {
    id: 'image-anchor-portal',
    label: 'Inferred horizon threshold',
    kind: 'portal',
    imagePosition: portalImagePosition,
    worldPosition: projectImageToWorld(portalImagePosition, imageWidth, imageHeight, horizonY),
    confidence: thresholdRegion ? Math.min(0.78, thresholdRegion.confidence + 0.08) : 0.42,
    rationale: thresholdRegion
      ? `Placed where traversable region ${thresholdRegion.id} approaches the inferred horizon.`
      : 'Placed at the image center because no strong traversable threshold was detected.',
    sourceRegionId: thresholdRegion?.id ?? null,
    sourceObjectId: null,
    status: 'proposed',
  };
  anchors.push(portalAnchor);

  const routeRegions = [...traversableRegions]
    .sort((a, b) => b.center.y - a.center.y)
    .filter((region, index, list) => {
      const previous = list[index - 1];
      return index === 0 || !previous
        || Math.abs(region.center.y - previous.center.y) > region.bbox.height * 0.35;
    })
    .slice(0, 5);
  const mainPoints: Point2D[] = [
    { x: imageWidth * 0.5, y: imageHeight * 0.96 },
    ...routeRegions.map((region) => region.center),
    portalImagePosition,
  ].sort((a, b) => b.y - a.y);
  const routes: RouteProposal[] = [{
    id: 'image-route-main',
    label: 'Foreground-to-horizon route',
    points2D: mainPoints,
    points3D: mainPoints.map((point) => projectImageToWorld(point, imageWidth, imageHeight, horizonY)),
    confidence: traversableRegions.length > 2 ? 0.72 : 0.5,
    rationale: `Connects ${traversableRegions.length} path or ground regions from the foreground to the inferred threshold.`,
    status: 'accepted',
  }];

  anchors
    .filter((anchor) => anchor.kind !== 'portal')
    .slice(0, styleBias === 'interpretive' ? 3 : 2)
    .forEach((anchor, index) => {
      const fallbackPoint = mainPoints[0] ?? portalImagePosition;
      const branchStart = mainPoints[Math.min(mainPoints.length - 1, Math.max(1, index + 1))] ?? fallbackPoint;
      const points2D: Point2D[] = [branchStart, anchor.imagePosition];
      routes.push({
        id: `image-route-branch-${index + 1}`,
        label: `Route to ${anchor.label}`,
        points2D,
        points3D: points2D.map((point) => projectImageToWorld(point, imageWidth, imageHeight, horizonY)),
        confidence: Math.min(0.76, anchor.confidence * 0.88),
        rationale: `Branches from the main traversable corridor toward ${anchor.id}.`,
        status: 'proposed',
      });
    });

  const biomes: BiomeProposal[] = semanticRegions.map((region) => ({
    id: `biome-${region.id}`,
    biome: biomeForRegion(region),
    regionId: region.id,
    confidence: region.confidence,
    rationale: `${region.kind} regions compile to the ${biomeForRegion(region)} grammar in V1.`,
    status: 'accepted',
  }));

  const terrain: TerrainProposal = {
    horizonY,
    elevationBias: semanticRegions.some((region) => region.kind === 'landmark')
      && traversableRegions.length > 0 ? 'mixed' : 'flat',
    traversableRegionIds,
    ridgeRegionIds: semanticRegions
      .filter((region) => region.kind === 'landmark' || region.kind === 'structure')
      .map((region) => region.id),
    basinRegionIds: traversableRegionIds,
    rationale: [
      `${traversableRegionIds.length} image regions lower terrain or preserve walkable corridors.`,
      `${semanticRegions.filter((region) => region.kind === 'landmark' || region.kind === 'structure').length} structure regions raise local relief.`,
    ],
  };

  const settlements: SettlementProposal[] = anchors
    .filter((anchor) => ['city', 'archive', 'heart'].includes(anchor.kind))
    .map((anchor, index) => ({
      id: `image-settlement-${index + 1}`,
      label: `${anchor.label} fabric`,
      kind: anchor.kind,
      anchorId: anchor.id,
      center: anchor.worldPosition,
      radius: anchor.kind === 'city' ? 1.8 : anchor.kind === 'archive' ? 1.35 : 1.05,
      confidence: anchor.confidence,
      rationale: `The settlement grammar inherits the position and review status of ${anchor.id}.`,
      status: anchor.status,
    }));

  const portals: PortalProposal[] = [{
    id: 'image-portal-threshold',
    anchorId: portalAnchor.id,
    imagePosition: portalAnchor.imagePosition,
    worldPosition: portalAnchor.worldPosition,
    confidence: portalAnchor.confidence,
    rationale: portalAnchor.rationale,
    status: portalAnchor.status,
  }];

  return { anchors, routes, terrain, biomes, settlements, portals };
}

function statusIncluded(status: ProposalStatus): boolean {
  return status !== 'rejected';
}

function nearestAnchor(
  anchors: AnchorProposal[],
  x: number,
  z: number,
): { anchor: AnchorProposal | null; distance: number } {
  let result: AnchorProposal | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const anchor of anchors) {
    const nextDistance = Math.hypot(anchor.worldPosition[0] - x, anchor.worldPosition[2] - z);
    if (nextDistance < distance) {
      distance = nextDistance;
      result = anchor;
    }
  }
  return { anchor: result, distance };
}

function anchorElevation(anchor: AnchorProposal, x: number, z: number): number {
  const distanceSquared = (
    (anchor.worldPosition[0] - x) ** 2
    + (anchor.worldPosition[2] - z) ** 2
  );
  const weight = Math.exp(-distanceSquared / (anchor.kind === 'city' ? 12 : 8));
  if (anchor.kind === 'city') return -0.55 * weight;
  if (anchor.kind === 'archive') return 0.65 * weight;
  if (anchor.kind === 'heart') return 0.32 * weight;
  if (anchor.kind === 'portal') return -0.22 * weight;
  return 0.12 * weight;
}

function biomeElevation(biome: WorldFabricBiome): number {
  if (biome === 'archive-ridge') return 0.42;
  if (biome === 'void-highland') return 0.68;
  if (biome === 'lantern-basin') return -0.3;
  if (biome === 'thread-marsh') return -0.12;
  return 0;
}

function biomeMoisture(biome: WorldFabricBiome, random: number): number {
  if (biome === 'thread-marsh') return 0.72 + random * 0.2;
  if (biome === 'lantern-basin') return 0.34 + random * 0.2;
  if (biome === 'void-highland') return 0.18 + random * 0.16;
  return 0.42 + random * 0.3;
}

function sampleCellElevation(
  seed: number,
  gridX: number,
  gridZ: number,
  biome: WorldFabricBiome,
  anchors: AnchorProposal[],
): number {
  const x = gridX * CELL_SIZE;
  const z = ORIGIN_Z + gridZ * CELL_SIZE;
  const broad = worldFabricRandom(seed, Math.floor(gridX / 2), Math.floor(gridZ / 2)) - 0.5;
  const detail = worldFabricRandom(seed + 887, gridX, gridZ) - 0.5;
  const semantic = anchors.reduce((sum, anchor) => sum + anchorElevation(anchor, x, z), 0);
  const horizonRise = Math.max(0, (Math.max(Math.abs(gridX), Math.abs(gridZ)) - 6) * 0.19);
  return -4.24 + broad * 0.72 + detail * 0.28 + biomeElevation(biome) + semantic + horizonRise;
}

export function compileProposalsToFabric(args: {
  worldId: string;
  seed: number;
  sourceWidth: number;
  sourceHeight: number;
  analysisWidth: number;
  analysisHeight: number;
  horizonY: number;
  semanticRegions: SemanticRegion[];
  proposals: ImageWorldProposals;
}): WorldFabricSpec {
  const {
    worldId,
    seed,
    sourceWidth,
    sourceHeight,
    analysisWidth,
    analysisHeight,
    horizonY,
    semanticRegions,
    proposals,
  } = args;
  void sourceWidth;
  void sourceHeight;
  const activeAnchors = proposals.anchors.filter((anchor) => statusIncluded(anchor.status));
  const activeBiomes = proposals.biomes.filter((biome) => statusIncluded(biome.status));
  const activeRoutes = proposals.routes.filter((route) => statusIncluded(route.status));
  const biomeByRegion = new Map<string, WorldFabricBiome>(
    activeBiomes.map((proposal) => [proposal.regionId, proposal.biome]),
  );
  const cells: WorldFabricCell[] = [];
  const gridDiameter = GRID_RADIUS * 2 + 1;

  for (let gridZ = -GRID_RADIUS; gridZ <= GRID_RADIUS; gridZ += 1) {
    for (let gridX = -GRID_RADIUS; gridX <= GRID_RADIUS; gridX += 1) {
      const x = gridX * CELL_SIZE;
      const z = ORIGIN_Z + gridZ * CELL_SIZE;
      const imagePoint = projectWorldToImage(x, z, analysisWidth, analysisHeight, horizonY);
      const region = regionAtPoint(semanticRegions, imagePoint);
      const fallbackBiome: WorldFabricBiome = Math.max(Math.abs(gridX), Math.abs(gridZ)) > 7
        ? 'void-highland'
        : 'memory-meadow';
      const biome: WorldFabricBiome = (region ? biomeByRegion.get(region.id) : undefined) ?? fallbackBiome;
      const elevation = sampleCellElevation(seed, gridX, gridZ, biome, activeAnchors);
      const density = worldFabricRandom(seed + 73, gridX, gridZ);
      const nearest = nearestAnchor(activeAnchors, x, z);
      const radius = Math.max(Math.abs(gridX), Math.abs(gridZ));
      cells.push({
        id: `compiled-cell-${gridX + GRID_RADIUS}-${gridZ + GRID_RADIUS}`,
        grid: [gridX, gridZ],
        center: [x, elevation, z],
        elevation,
        moisture: biomeMoisture(biome, worldFabricRandom(seed + 420, gridX, gridZ)),
        density,
        biome,
        lod: radius <= 3 ? 'near' : radius <= 6 ? 'middle' : 'horizon',
        nearestAnchorId: nearest.anchor?.id ?? null,
      });
    }
  }

  const elevationAt = (x: number, z: number): number => {
    const gridX = Math.max(-GRID_RADIUS, Math.min(GRID_RADIUS, Math.round(x / CELL_SIZE)));
    const gridZ = Math.max(-GRID_RADIUS, Math.min(GRID_RADIUS, Math.round((z - ORIGIN_Z) / CELL_SIZE)));
    const index = (gridZ + GRID_RADIUS) * gridDiameter + gridX + GRID_RADIUS;
    return cells[index]?.elevation ?? -4.2;
  };

  const routes = activeRoutes.map((route) => ({
    id: route.id,
    label: route.label,
    color: route.id === 'image-route-main' ? '#77d8ff' : '#d0a4ff',
    points: route.points3D.map(([x, _y, z]) => [x, elevationAt(x, z) + 0.12, z] as [number, number, number]),
  }));

  const activeSettlements = proposals.settlements.filter((settlement) => {
    const anchor = proposals.anchors.find((candidate) => candidate.id === settlement.anchorId);
    return statusIncluded(settlement.status) && Boolean(anchor && statusIncluded(anchor.status));
  });
  const settlements = activeSettlements.map((settlement, index) => ({
    id: settlement.id,
    label: settlement.label,
    kind: settlement.kind,
    center: [
      settlement.center[0],
      elevationAt(settlement.center[0], settlement.center[2]) + 0.04,
      settlement.center[2],
    ] as [number, number, number],
    radius: settlement.radius,
    tiers: 3 + ((seed + index) % 4),
  }));

  return {
    id: `${worldId}-compiled-world-fabric`,
    seed,
    origin: [0, -4.24, ORIGIN_Z],
    gridRadius: GRID_RADIUS,
    gridDiameter,
    cellSize: CELL_SIZE,
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

function allStatuses(proposals: ImageWorldProposals): ProposalStatus[] {
  return [
    ...proposals.anchors.map((proposal) => proposal.status),
    ...proposals.routes.map((proposal) => proposal.status),
    ...proposals.biomes.map((proposal) => proposal.status),
    ...proposals.settlements.map((proposal) => proposal.status),
    ...proposals.portals.map((proposal) => proposal.status),
  ];
}

export function recompileDraft(draft: ImageWorldDraft): ImageWorldDraft {
  const compiledFabric = compileProposalsToFabric({
    worldId: draft.id.replace(/-draft$/, ''),
    seed: draft.seed,
    sourceWidth: draft.sourceImage.width,
    sourceHeight: draft.sourceImage.height,
    analysisWidth: draft.sourceImage.analysisWidth,
    analysisHeight: draft.sourceImage.analysisHeight,
    horizonY: draft.interpretation.horizonY,
    semanticRegions: draft.interpretation.semanticRegions,
    proposals: draft.proposals,
  });
  const statuses = allStatuses(draft.proposals);
  const confidenceValues = [
    ...draft.proposals.anchors.filter((item) => item.status !== 'rejected').map((item) => item.confidence),
    ...draft.proposals.routes.filter((item) => item.status !== 'rejected').map((item) => item.confidence),
  ];
  const warnings = [...draft.review.warnings.filter((warning) => !warning.startsWith('Review contains'))];
  const rejectedCount = statuses.filter((status) => status === 'rejected').length;
  if (rejectedCount > 0) warnings.push(`Review contains ${rejectedCount} rejected proposal(s); the compiled fabric excludes them.`);

  return {
    ...draft,
    generatedAt: new Date().toISOString(),
    compiledFabric,
    review: {
      ...draft.review,
      confidence: confidenceValues.length
        ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
        : 0,
      acceptedCount: statuses.filter((status) => status === 'accepted').length,
      rejectedCount,
      warnings,
    },
  };
}

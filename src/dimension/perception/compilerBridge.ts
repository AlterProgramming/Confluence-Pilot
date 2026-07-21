import type { DimensionAnchorKind, DimensionSceneSpec } from '../Dimension';
import { generateWorldFabric } from '../WorldFabric';
import type { WorldFabricBiome } from '../WorldFabric';
import type {
  AnchorProposal,
  BiomeProposal,
  ImageWorldDraft,
  PortalProposal,
  RouteProposal,
  SemanticRegion,
  SettlementProposal,
} from '../compiler/contracts';
import { saveWorldDraftForPlay } from '../play/handoff';
import type { InstanceEvidence, PerceptionBundleV2, SurfaceEvidence } from './contracts';

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) || 7319;
}

function anchorKind(instance: InstanceEvidence): DimensionAnchorKind {
  const concept = instance.concept.toLowerCase();
  if (concept.includes('portal') || concept.includes('archway')) return 'portal';
  if (concept.includes('tower') || concept.includes('archive')) return 'archive';
  if (concept.includes('building') || concept.includes('city')) return 'city';
  if (concept.includes('heart')) return 'heart';
  return 'anchor';
}

function anchorColor(kind: DimensionAnchorKind): string {
  switch (kind) {
    case 'portal': return '#70d7ff';
    case 'archive': return '#b69cff';
    case 'city': return '#ffb05f';
    case 'heart': return '#ffd7a2';
    default: return '#d7ecff';
  }
}

function imageToWorld(x: number, y: number, depth: number): [number, number, number] {
  const worldX = (x - 0.5) * 13;
  const worldZ = -2.5 - depth * 10.5;
  const worldY = (0.58 - y) * 2.1;
  return [worldX, worldY, worldZ];
}

function instanceCenter(instance: InstanceEvidence, sourceWidth: number, sourceHeight: number): [number, number] {
  return [
    (instance.box[0] + instance.box[2]) / 2 / sourceWidth,
    (instance.box[1] + instance.box[3]) / 2 / sourceHeight,
  ];
}

function surfaceCenter(surface: SurfaceEvidence): [number, number] {
  const sum = surface.polygon.reduce<[number, number]>(
    (result, point) => [result[0] + point[0], result[1] + point[1]],
    [0, 0],
  );
  return [sum[0] / surface.polygon.length, sum[1] / surface.polygon.length];
}

function semanticKind(surface: SurfaceEvidence): SemanticRegion['kind'] {
  const concept = surface.concept.toLowerCase();
  if (concept.includes('water')) return 'water';
  if (concept.includes('path') || concept.includes('road') || concept.includes('bridge')) return 'path';
  if (concept.includes('tree') || concept.includes('vegetation')) return 'vegetation';
  if (concept.includes('building') || concept.includes('wall') || concept.includes('tower')) return 'structure';
  if (concept.includes('ground') || concept.includes('terrain') || concept.includes('floor')) return 'ground';
  return 'unknown';
}

function biomeForSurface(surface: SurfaceEvidence): WorldFabricBiome {
  const kind = semanticKind(surface);
  if (kind === 'water') return 'thread-marsh';
  if (kind === 'structure') return 'archive-ridge';
  if (kind === 'path') return 'lantern-basin';
  if (surface.walkability === 'uncertain') return 'void-highland';
  return 'memory-meadow';
}

export function compilePerceptionBundle(bundle: PerceptionBundleV2): ImageWorldDraft {
  const seed = hashSeed(bundle.source.sha256);
  const acceptedInstances = bundle.instances.filter((instance) => instance.status === 'accepted');
  const anchors: AnchorProposal[] = acceptedInstances.map((instance) => {
    const center = instanceCenter(instance, bundle.source.width, bundle.source.height);
    const kind = anchorKind(instance);
    return {
      id: `perception-anchor-${instance.id}`,
      label: instance.label,
      kind,
      imagePosition: { x: center[0], y: center[1] },
      worldPosition: imageToWorld(center[0], center[1], instance.medianDepth),
      confidence: Math.min(instance.confidence, instance.maskConfidence),
      rationale: `Evidence-backed ${instance.concept} from ${instance.maskRef}`,
      sourceRegionId: null,
      sourceObjectId: instance.id,
      status: 'accepted',
    };
  });

  const walkableSurfaces = bundle.surfaces.filter((surface) => surface.walkability === 'walkable');
  const routes: RouteProposal[] = walkableSurfaces.map((surface) => {
    const center = surfaceCenter(surface);
    const spawn = bundle.navigation.spawnCandidates.find((candidate) => candidate.surfaceId === surface.id);
    const start = spawn?.imagePosition ?? [center[0], Math.min(0.94, center[1] + 0.22)];
    const end: [number, number] = [center[0], Math.max(0.18, center[1] - 0.24)];
    return {
      id: `perception-route-${surface.id}`,
      label: surface.label,
      points2D: [{ x: start[0], y: start[1] }, { x: center[0], y: center[1] }, { x: end[0], y: end[1] }],
      points3D: [
        imageToWorld(start[0], start[1], Math.max(0.05, surface.medianDepth - 0.18)),
        imageToWorld(center[0], center[1], surface.medianDepth),
        imageToWorld(end[0], end[1], Math.min(0.98, surface.medianDepth + 0.22)),
      ],
      confidence: surface.confidence,
      rationale: surface.rationale.join('; '),
      status: 'accepted',
    };
  });

  const scene: DimensionSceneSpec = {
    id: `perception-${bundle.id}`,
    title: bundle.source.name,
    subtitle: 'Reviewed learned-perception world',
    law: 'Only reviewed evidence becomes physical.',
    seedImageUrl: bundle.source.url,
    palette: {
      void: '#06111d',
      memory: '#d8eeff',
      thread: '#94d9ff',
      violet: '#b69cff',
      blue: '#70d7ff',
    },
    camera: { position: [0, 1.4, 12], target: [0, -0.4, -6] },
    layers: [
      { id: 'perception-sky', label: 'Perception sky', kind: 'sky', depth: -10, parallax: 0.03, opacity: 1 },
      { id: 'perception-world', label: 'Learned world evidence', kind: 'inhabited', depth: -4, parallax: 0.15, opacity: 0.05 },
    ],
    anchors: anchors.map((anchor) => ({
      id: anchor.id,
      label: anchor.label,
      kind: anchor.kind,
      position: anchor.worldPosition,
      radius: 0.2,
      color: anchorColor(anchor.kind),
      description: anchor.rationale,
    })),
    paths: routes.map((route) => ({ id: route.id, label: route.label, color: '#9de6ff', points: route.points3D })),
    portals: anchors
      .filter((anchor) => anchor.kind === 'portal')
      .map((anchor) => ({ id: anchor.id, label: anchor.label, position: anchor.worldPosition, radius: 0.18, destination: 'perception-threshold' })),
    destinations: [],
    entrances: [],
  };

  const semanticRegions: SemanticRegion[] = bundle.surfaces.map((surface) => {
    const xs = surface.polygon.map((point) => point[0]);
    const ys = surface.polygon.map((point) => point[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const center = surfaceCenter(surface);
    return {
      id: surface.id,
      kind: semanticKind(surface),
      polygon: { points: surface.polygon.map(([x, y]) => ({ x, y })) },
      bbox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      center: { x: center[0], y: center[1] },
      confidence: surface.confidence,
      metrics: { brightness: 0.5, saturation: 0.5, edge: 0.5, red: 0.5, green: 0.5, blue: 0.5 },
    };
  });

  const biomes: BiomeProposal[] = bundle.surfaces.map((surface) => ({
    id: `perception-biome-${surface.id}`,
    biome: biomeForSurface(surface),
    regionId: surface.id,
    confidence: surface.confidence,
    rationale: surface.rationale.join('; '),
    status: surface.walkability === 'uncertain' ? 'proposed' : 'accepted',
  }));
  const settlements: SettlementProposal[] = anchors
    .filter((anchor) => anchor.kind !== 'anchor')
    .map((anchor) => ({
      id: `perception-settlement-${anchor.id}`,
      label: anchor.label,
      kind: anchor.kind,
      anchorId: anchor.id,
      center: anchor.worldPosition,
      radius: 1.15,
      confidence: anchor.confidence,
      rationale: anchor.rationale,
      status: 'accepted',
    }));
  const portals: PortalProposal[] = anchors
    .filter((anchor) => anchor.kind === 'portal')
    .map((anchor) => ({
      id: `perception-portal-${anchor.id}`,
      anchorId: anchor.id,
      imagePosition: anchor.imagePosition,
      worldPosition: anchor.worldPosition,
      confidence: anchor.confidence,
      rationale: anchor.rationale,
      status: 'accepted',
    }));

  const compiledFabric = generateWorldFabric(scene, { seed });
  return {
    schemaVersion: 1,
    id: `perception-draft-${bundle.id}`,
    seed,
    styleBias: 'literal',
    generatedAt: new Date().toISOString(),
    sourceImage: {
      name: bundle.source.name,
      url: bundle.source.url,
      width: bundle.source.width,
      height: bundle.source.height,
      analysisWidth: bundle.source.width,
      analysisHeight: bundle.source.height,
    },
    interpretation: {
      horizonY: 0.38,
      horizonConfidence: 0.7,
      depthBands: [
        { id: 'foreground', kind: 'foreground', yMin: 0.66, yMax: 1, confidence: 0.9 },
        { id: 'midground', kind: 'midground', yMin: 0.34, yMax: 0.66, confidence: 0.85 },
        { id: 'background', kind: 'background', yMin: 0, yMax: 0.34, confidence: 0.8 },
      ],
      semanticRegions,
      focalObjects: acceptedInstances.map((instance) => {
        const center = instanceCenter(instance, bundle.source.width, bundle.source.height);
        return {
          id: instance.id,
          bbox: {
            x: instance.box[0] / bundle.source.width,
            y: instance.box[1] / bundle.source.height,
            width: (instance.box[2] - instance.box[0]) / bundle.source.width,
            height: (instance.box[3] - instance.box[1]) / bundle.source.height,
          },
          center: { x: center[0], y: center[1] },
          confidence: instance.confidence,
          saliency: instance.maskConfidence,
          regionId: semanticRegions[0]?.id ?? 'perception-region',
        };
      }),
      traversableRegionIds: walkableSurfaces.map((surface) => surface.id),
    },
    proposals: {
      anchors,
      routes,
      terrain: {
        horizonY: 0.38,
        elevationBias: bundle.uncertainty.regions.length > 0 ? 'mixed' : 'valley',
        traversableRegionIds: walkableSurfaces.map((surface) => surface.id),
        ridgeRegionIds: bundle.surfaces.filter((surface) => surface.walkability === 'blocked').map((surface) => surface.id),
        basinRegionIds: walkableSurfaces.map((surface) => surface.id),
        rationale: ['Generated from reviewed depth, normals, masks, and walkability evidence'],
      },
      biomes,
      settlements,
      portals,
    },
    compiledFabric,
    review: {
      confidence: Math.max(0, 1 - bundle.uncertainty.regions.length * 0.16),
      warnings: bundle.navigation.spawnCandidates.length === 0 ? ['No approved spawn candidate exists.'] : bundle.validation.warnings,
      acceptedCount: anchors.length + routes.length,
      rejectedCount: bundle.instances.length - acceptedInstances.length,
      editable: true,
    },
  };
}

export function enterPerceptionWorld(bundle: PerceptionBundleV2): void {
  const draft = compilePerceptionBundle(bundle);
  saveWorldDraftForPlay(draft);
  window.location.assign('/dimension/play?source=perception');
}

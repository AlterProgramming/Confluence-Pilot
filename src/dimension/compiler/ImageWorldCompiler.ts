import {
  buildDepthBands,
  detectFocalObjects,
  estimateHorizon,
  inferTraversableRegions,
  normalizeImageSource,
  segmentSemanticRegions,
} from './analysis';
import type {
  CompilerStyleBias,
  FocalObject,
  ImageWorldCompilerRequest,
  ImageWorldCompilerResult,
  ImageWorldDraft,
  ProposalStatus,
  SemanticRegion,
} from './contracts';
import { compileProposalsToFabric, proposeWorldStructure } from './synthesis';
import { saveWorldDraftForPlay } from '../play/handoff';

function objectCount(styleBias: CompilerStyleBias): number {
  if (styleBias === 'literal') return 4;
  if (styleBias === 'interpretive') return 7;
  return 6;
}

function regionSaliency(region: SemanticRegion, imageWidth: number): number {
  return region.metrics.edge * 0.52
    + region.metrics.saturation * 0.22
    + region.metrics.brightness * 0.12
    + (1 - Math.abs(region.center.x / imageWidth - 0.5)) * 0.14;
}

function ensureFocalCoverage(
  detected: FocalObject[],
  regions: SemanticRegion[],
  imageWidth: number,
  requestedCount: number,
): FocalObject[] {
  const minimum = Math.min(3, requestedCount);
  if (detected.length >= minimum) return detected;

  const selected = [...detected];
  const selectedRegionIds = new Set(selected.map((object) => object.regionId));
  const candidates = regions
    .filter((region) => region.kind !== 'sky' && region.kind !== 'path')
    .filter((region) => !selectedRegionIds.has(region.id))
    .map((region) => ({ region, saliency: regionSaliency(region, imageWidth) }))
    .sort((a, b) => b.saliency - a.saliency);

  const append = (candidate: { region: SemanticRegion; saliency: number }) => {
    selectedRegionIds.add(candidate.region.id);
    selected.push({
      id: `focal-fallback-${selected.length + 1}`,
      bbox: candidate.region.bbox,
      center: candidate.region.center,
      confidence: Math.max(0.36, Math.min(0.72, 0.34 + candidate.saliency * 0.55)),
      saliency: candidate.saliency,
      regionId: candidate.region.id,
    });
  };

  for (const candidate of candidates) {
    if (selected.length >= requestedCount) break;
    const separated = selected.every((object) => (
      Math.abs(object.center.x - candidate.region.center.x) > imageWidth * 0.11
    ));
    if (separated) append(candidate);
  }

  for (const candidate of candidates) {
    if (selected.length >= requestedCount) break;
    if (!selectedRegionIds.has(candidate.region.id)) append(candidate);
  }

  return selected;
}

function proposalStatuses(draft: Pick<ImageWorldDraft, 'proposals'>): ProposalStatus[] {
  return [
    ...draft.proposals.anchors.map((proposal) => proposal.status),
    ...draft.proposals.routes.map((proposal) => proposal.status),
    ...draft.proposals.biomes.map((proposal) => proposal.status),
    ...draft.proposals.settlements.map((proposal) => proposal.status),
    ...draft.proposals.portals.map((proposal) => proposal.status),
  ];
}

export async function compileImageToWorldDraft(
  request: ImageWorldCompilerRequest,
): Promise<ImageWorldCompilerResult> {
  const seed = request.seed ?? 7319;
  const styleBias = request.styleBias ?? 'balanced';
  const worldId = request.worldId ?? 'image-conditioned-world';
  const requestedObjectCount = objectCount(styleBias);
  const normalized = await normalizeImageSource(request.imageSource, request.maxAnalysisWidth ?? 512);
  const horizon = estimateHorizon(normalized.image);
  const semanticRegions = segmentSemanticRegions(normalized.image, horizon.horizonY);
  const detectedFocalObjects = detectFocalObjects(
    normalized.image,
    semanticRegions,
    requestedObjectCount,
  );
  const focalObjects = ensureFocalCoverage(
    detectedFocalObjects,
    semanticRegions,
    normalized.image.width,
    requestedObjectCount,
  );
  const traversableRegionIds = inferTraversableRegions(semanticRegions);
  const proposals = proposeWorldStructure({
    imageWidth: normalized.image.width,
    imageHeight: normalized.image.height,
    horizonY: horizon.horizonY,
    styleBias,
    semanticRegions,
    focalObjects,
    traversableRegionIds,
  });
  const compiledFabric = compileProposalsToFabric({
    worldId,
    seed,
    sourceWidth: normalized.sourceWidth,
    sourceHeight: normalized.sourceHeight,
    analysisWidth: normalized.image.width,
    analysisHeight: normalized.image.height,
    horizonY: horizon.horizonY,
    semanticRegions,
    proposals,
  });

  const warnings: string[] = [];
  if (horizon.confidence < 0.5) warnings.push('The inferred horizon has low confidence and should be reviewed.');
  if (detectedFocalObjects.length < 3) warnings.push('Fallback anchors supplement sparse high-confidence structure detections and should be reviewed.');
  if (traversableRegionIds.length < 3) warnings.push('The source image exposes little clearly traversable ground.');
  if (compiledFabric.stats.biomeCount < 3) warnings.push('The compiled world contains limited biome diversity.');

  const draftWithoutReview = {
    schemaVersion: 1 as const,
    id: `${worldId}-draft`,
    seed,
    styleBias,
    generatedAt: new Date().toISOString(),
    sourceImage: {
      name: request.imageName ?? request.imageSource.split('/').pop() ?? 'world-source',
      url: request.imageSource,
      width: normalized.sourceWidth,
      height: normalized.sourceHeight,
      analysisWidth: normalized.image.width,
      analysisHeight: normalized.image.height,
    },
    interpretation: {
      horizonY: horizon.horizonY,
      horizonConfidence: horizon.confidence,
      depthBands: buildDepthBands(normalized.image.height, horizon.horizonY),
      semanticRegions,
      focalObjects,
      traversableRegionIds,
    },
    proposals,
    compiledFabric,
  };
  const statuses = proposalStatuses(draftWithoutReview);
  const confidenceValues = [
    horizon.confidence,
    ...proposals.anchors.map((anchor) => anchor.confidence),
    ...proposals.routes.map((route) => route.confidence),
  ];
  const draft: ImageWorldDraft = {
    ...draftWithoutReview,
    review: {
      confidence: confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length,
      warnings,
      acceptedCount: statuses.filter((status) => status === 'accepted').length,
      rejectedCount: statuses.filter((status) => status === 'rejected').length,
      editable: true,
    },
  };

  saveWorldDraftForPlay(draft);
  return { draft };
}

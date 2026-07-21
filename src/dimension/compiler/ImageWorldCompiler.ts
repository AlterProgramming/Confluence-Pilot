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
  ImageWorldCompilerRequest,
  ImageWorldCompilerResult,
  ImageWorldDraft,
  ProposalStatus,
} from './contracts';
import { compileProposalsToFabric, proposeWorldStructure } from './synthesis';

function objectCount(styleBias: CompilerStyleBias): number {
  if (styleBias === 'literal') return 4;
  if (styleBias === 'interpretive') return 7;
  return 6;
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
  const normalized = await normalizeImageSource(request.imageSource, request.maxAnalysisWidth ?? 512);
  const horizon = estimateHorizon(normalized.image);
  const semanticRegions = segmentSemanticRegions(normalized.image, horizon.horizonY);
  const focalObjects = detectFocalObjects(
    normalized.image,
    semanticRegions,
    objectCount(styleBias),
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
  if (focalObjects.length < 3) warnings.push('Fewer than three salient structures were found; anchor coverage may be sparse.');
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

  return { draft };
}

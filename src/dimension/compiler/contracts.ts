import type { DimensionAnchorKind } from '../Dimension';
import type { WorldFabricBiome, WorldFabricSpec } from '../WorldFabric';

export type SemanticRegionKind =
  | 'sky'
  | 'ground'
  | 'water'
  | 'vegetation'
  | 'structure'
  | 'path'
  | 'landmark'
  | 'unknown';

export type DepthBandKind = 'foreground' | 'midground' | 'background' | 'horizon';
export type ProposalStatus = 'proposed' | 'accepted' | 'rejected';
export type CompilerStyleBias = 'literal' | 'balanced' | 'interpretive';

export interface Point2D {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Polygon2D {
  points: Point2D[];
}

export interface DepthBand {
  id: string;
  kind: DepthBandKind;
  yMin: number;
  yMax: number;
  confidence: number;
}

export interface RegionMetrics {
  brightness: number;
  saturation: number;
  edge: number;
  red: number;
  green: number;
  blue: number;
}

export interface SemanticRegion {
  id: string;
  kind: SemanticRegionKind;
  polygon: Polygon2D;
  bbox: BoundingBox;
  center: Point2D;
  confidence: number;
  metrics: RegionMetrics;
}

export interface FocalObject {
  id: string;
  bbox: BoundingBox;
  center: Point2D;
  confidence: number;
  saliency: number;
  regionId: string;
}

export interface AnchorProposal {
  id: string;
  label: string;
  kind: DimensionAnchorKind;
  imagePosition: Point2D;
  worldPosition: [number, number, number];
  confidence: number;
  rationale: string;
  sourceRegionId: string | null;
  sourceObjectId: string | null;
  status: ProposalStatus;
}

export interface RouteProposal {
  id: string;
  label: string;
  points2D: Point2D[];
  points3D: Array<[number, number, number]>;
  confidence: number;
  rationale: string;
  status: ProposalStatus;
}

export interface TerrainProposal {
  horizonY: number;
  elevationBias: 'flat' | 'basin' | 'ridge' | 'valley' | 'mixed';
  traversableRegionIds: string[];
  ridgeRegionIds: string[];
  basinRegionIds: string[];
  rationale: string[];
}

export interface BiomeProposal {
  id: string;
  biome: WorldFabricBiome;
  regionId: string;
  confidence: number;
  rationale: string;
  status: ProposalStatus;
}

export interface SettlementProposal {
  id: string;
  label: string;
  kind: DimensionAnchorKind;
  anchorId: string;
  center: [number, number, number];
  radius: number;
  confidence: number;
  rationale: string;
  status: ProposalStatus;
}

export interface PortalProposal {
  id: string;
  anchorId: string;
  imagePosition: Point2D;
  worldPosition: [number, number, number];
  confidence: number;
  rationale: string;
  status: ProposalStatus;
}

export interface SourceImageInfo {
  name: string;
  url: string;
  width: number;
  height: number;
  analysisWidth: number;
  analysisHeight: number;
}

export interface NormalizedImageData {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  averageBrightness: number;
  averageSaturation: number;
}

export interface ImageWorldInterpretation {
  horizonY: number;
  horizonConfidence: number;
  depthBands: DepthBand[];
  semanticRegions: SemanticRegion[];
  focalObjects: FocalObject[];
  traversableRegionIds: string[];
}

export interface ImageWorldProposals {
  anchors: AnchorProposal[];
  routes: RouteProposal[];
  terrain: TerrainProposal;
  biomes: BiomeProposal[];
  settlements: SettlementProposal[];
  portals: PortalProposal[];
}

export interface ImageWorldDraftReview {
  confidence: number;
  warnings: string[];
  acceptedCount: number;
  rejectedCount: number;
  editable: true;
}

export interface ImageWorldDraft {
  schemaVersion: 1;
  id: string;
  seed: number;
  styleBias: CompilerStyleBias;
  generatedAt: string;
  sourceImage: SourceImageInfo;
  interpretation: ImageWorldInterpretation;
  proposals: ImageWorldProposals;
  compiledFabric: WorldFabricSpec;
  review: ImageWorldDraftReview;
}

export interface ImageWorldCompilerRequest {
  imageSource: string;
  imageName?: string;
  worldId?: string;
  seed?: number;
  styleBias?: CompilerStyleBias;
  maxAnalysisWidth?: number;
}

export interface ImageWorldCompilerResult {
  draft: ImageWorldDraft;
}

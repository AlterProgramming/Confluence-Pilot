export type PerceptionJobState =
  | 'queued'
  | 'geometry_running'
  | 'reasoning_running'
  | 'detection_running'
  | 'segmentation_running'
  | 'fusion_running'
  | 'completed'
  | 'failed';

export type WalkabilityKind = 'walkable' | 'blocked' | 'uncertain';

export interface RasterArtifact {
  ref: string;
  width: number;
  height: number;
  format: 'png' | 'npy' | 'json';
}

export interface ModelProvenance {
  stage: 'geometry' | 'reasoning' | 'detection' | 'segmentation' | 'fusion';
  provider: string;
  checkpoint: string;
  precision: string;
  durationMs: number;
  peakVramGb: number;
  parameters: Record<string, string | number | boolean>;
}

export interface GeometryEvidence {
  provider: string;
  modelVersion: string;
  depth: RasterArtifact;
  normals: RasterArtifact;
  confidence: RasterArtifact;
  points?: RasterArtifact;
  camera?: {
    fieldOfViewDegrees?: number;
    focalLengthPixels?: number;
  };
}

export interface DetectionEvidence {
  id: string;
  concept: string;
  phrase: string;
  confidence: number;
  box: [number, number, number, number];
}

export interface InstanceEvidence {
  id: string;
  detectionId: string;
  concept: string;
  label: string;
  confidence: number;
  maskConfidence: number;
  box: [number, number, number, number];
  maskRef: string;
  medianDepth: number;
  nearDepth: number;
  farDepth: number;
  medianNormal: [number, number, number];
  pixelArea: number;
  status: 'accepted' | 'rejected';
}

export interface SurfaceEvidence {
  id: string;
  label: string;
  concept: string;
  polygon: Array<[number, number]>;
  confidence: number;
  medianDepth: number;
  medianNormal: [number, number, number];
  walkability: WalkabilityKind;
  rationale: string[];
}

export interface NavigationComponent {
  id: string;
  surfaceIds: string[];
  areaRatio: number;
  confidence: number;
}

export interface SpawnCandidate {
  id: string;
  surfaceId: string;
  imagePosition: [number, number];
  confidence: number;
  rationale: string[];
}

export interface SceneRelation {
  id: string;
  subjectId: string;
  predicate: 'in_front_of' | 'behind' | 'overlaps' | 'adjacent_to' | 'occludes' | 'leads_to';
  objectId: string;
  confidence: number;
  source: 'geometry' | 'reasoning' | 'review';
}

export interface UncertainRegion {
  id: string;
  polygon: Array<[number, number]>;
  confidence: number;
  reason: string;
}

export interface PerceptionBundleV2 {
  schemaVersion: '2.0.0';
  id: string;
  fixtureId?: string;
  source: {
    name: string;
    url: string;
    width: number;
    height: number;
    sha256: string;
  };
  geometry: GeometryEvidence;
  detections: DetectionEvidence[];
  instances: InstanceEvidence[];
  surfaces: SurfaceEvidence[];
  navigation: {
    walkableMaskRef: string;
    connectedComponents: NavigationComponent[];
    spawnCandidates: SpawnCandidate[];
  };
  relations: SceneRelation[];
  uncertainty: {
    maskRef: string;
    regions: UncertainRegion[];
  };
  artifacts: RasterArtifact[];
  provenance: ModelProvenance[];
  validation: {
    status: 'unreviewed' | 'approved' | 'rejected';
    warnings: string[];
  };
}

export interface PerceptionJobRequest {
  fixtureId?: string;
  image?: File;
  concepts: string[];
  options: {
    maxImageSide: number;
    precision: 'bf16' | 'fp16' | 'fp32';
    sequentialUnload: boolean;
    returnSceneGraph: boolean;
  };
}

export interface PerceptionJobStatus {
  id: string;
  state: PerceptionJobState;
  bundleId?: string;
  error?: string;
}

export type ReviewCorrection =
  | {
      id: string;
      bundleId: string;
      createdAt: string;
      action: 'rename_instance';
      targetId: string;
      before: string;
      after: string;
    }
  | {
      id: string;
      bundleId: string;
      createdAt: string;
      action: 'set_instance_status';
      targetId: string;
      before: InstanceEvidence['status'];
      after: InstanceEvidence['status'];
    }
  | {
      id: string;
      bundleId: string;
      createdAt: string;
      action: 'set_walkability';
      targetId: string;
      before: WalkabilityKind;
      after: WalkabilityKind;
    };

export interface PerceptionClient {
  createJob(request: PerceptionJobRequest): Promise<{ id: string }>;
  getJob(jobId: string): Promise<PerceptionJobStatus>;
  getBundle(bundleId: string): Promise<PerceptionBundleV2>;
  submitCorrections(bundleId: string, corrections: ReviewCorrection[]): Promise<void>;
}

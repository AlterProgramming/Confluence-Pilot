export type Vector3Tuple = [number, number, number];

export type TransformMode = 'translate' | 'rotate' | 'scale';

export type PrimitiveKind =
  | 'box'
  | 'sphere'
  | 'cylinder'
  | 'cone'
  | 'torus'
  | 'workbench-table'
  | 'laptop'
  | 'credential-stack'
  | 'coaching-table';

export type SceneTemplateId =
  | 'sandbox'
  | 'room-02'
  | 'room-02-academy-axis'
  | 'room-02-credential-gallery'
  | 'room-02-learning-forum';

export interface SceneBounds {
  min: Vector3Tuple;
  max: Vector3Tuple;
  safeInset: number;
}

export interface AttachmentSurface {
  id: string;
  label: string;
  position: Vector3Tuple;
  size: [number, number];
}

export interface AssetCatalogItem {
  id: string;
  label: string;
  category: 'primitive' | 'room-hero' | 'room-fixture';
  kind: 'primitive' | 'gltf';
  primitive?: PrimitiveKind;
  url?: string;
  targetSize?: number;
  footprint: Vector3Tuple;
  floorAnchored: boolean;
  attachable?: boolean;
  attachmentSurfaces?: [AttachmentSurface, ...AttachmentSurface[]];
  accent: string;
  description: string;
}

export interface AssetTransform {
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
}

export interface PlacedAsset {
  id: string;
  assetId: string;
  name: string;
  transform: AssetTransform;
  parentId?: string | null | undefined;
  surfaceId?: string | null | undefined;
  visible: boolean;
  locked: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DesignZone {
  id: string;
  label: string;
  intent: string;
  center: [number, number];
  size: [number, number];
  rotation: number;
  accent: string;
}

export interface DesignProposition {
  id: 'academy-axis' | 'credential-gallery' | 'learning-forum';
  title: string;
  thesis: string;
  experientialPromise: string;
  signatureMove: string;
  hierarchy: string[];
  adoptedQualities: string[];
  rejectedQualities: string[];
  tradeoffs: string[];
  accent: string;
  camera: {
    position: Vector3Tuple;
    target: Vector3Tuple;
  };
  zones: DesignZone[];
  circulation: Vector3Tuple[];
  focalPoint: Vector3Tuple;
}

export interface CompositionDocument {
  schemaVersion: 2;
  id: string;
  sceneId: SceneTemplateId;
  name: string;
  units: 'meters';
  gridUnit: number;
  bounds: SceneBounds | null;
  instances: PlacedAsset[];
  proposition?: DesignProposition | undefined;
  updatedAt: number;
}

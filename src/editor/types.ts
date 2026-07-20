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

export type SceneTemplateId = 'sandbox' | 'room-02';

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

export interface CompositionDocument {
  schemaVersion: 2;
  id: string;
  sceneId: SceneTemplateId;
  name: string;
  units: 'meters';
  gridUnit: number;
  bounds: SceneBounds | null;
  instances: PlacedAsset[];
  updatedAt: number;
}

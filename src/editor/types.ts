export type Vector3Tuple = [number, number, number];

export type TransformMode = 'translate' | 'rotate' | 'scale';

export type PrimitiveKind = 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus';

export interface AssetCatalogItem {
  id: string;
  label: string;
  category: 'primitive' | 'room-hero';
  kind: 'primitive' | 'gltf';
  primitive?: PrimitiveKind;
  url?: string;
  targetSize?: number;
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
  visible: boolean;
  locked: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CompositionDocument {
  schemaVersion: 1;
  id: string;
  name: string;
  units: 'meters';
  gridUnit: number;
  instances: PlacedAsset[];
  updatedAt: number;
}

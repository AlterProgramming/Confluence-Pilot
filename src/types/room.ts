export type RoomShape =
  | 'sphere'
  | 'torus'
  | 'octahedron'
  | 'box'
  | 'cylinder'
  | 'icosahedron';

export type RoomArchitecture =
  | 'gallery'
  | 'academy'
  | 'studio'
  | 'living-building'
  | 'neighborhood'
  | 'infrastructure'
  | 'vault'
  | 'hangar'
  | 'communications'
  | 'cold-chain'
  | 'fintech'
  | 'main-street';

export type AssetMaterialTuning = {
  envMapIntensity?: number;
  emissiveIntensity?: number;
  colorMultiplier?: number;
  roughnessFloor?: number;
};

export type RoomDefinition = {
  id: string;
  shortTitle: string;
  title: string;
  description: string;
  category: 'public' | 'workforce' | 'student' | 'trust' | 'research' | 'industry';
  color: string;
  secondaryColor: string;
  shape: RoomShape;
  architecture: RoomArchitecture;
  y: number;
  camera: [number, number, number];
  target: [number, number, number];
  assetUrl?: string;
  assetScale?: number;
  assetPosition?: [number, number, number];
  assetRotation?: [number, number, number];
  assetTargetSize?: number;
  assetMaterialTuning?: AssetMaterialTuning;
};

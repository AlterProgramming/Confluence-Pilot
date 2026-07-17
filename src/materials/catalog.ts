// CC0 PBR materials (Poly Haven) fetched into public/textures/ by scripts/fetch_textures.py.
export type MaterialName =
  | 'concrete'
  | 'wood-floor'
  | 'marble'
  | 'metal-panel'
  | 'carpet'
  | 'plaster';

export type PbrMaps = {
  albedo: string;
  normal: string;
  roughness: string;
  /** default tiling repeat */
  repeat: [number, number];
  /** base roughness/metalness multipliers for a polished vs matte read */
  roughness_scale?: number;
  metalness?: number;
};

const dir = (name: string) => `/textures/${name}`;

export const materials: Record<MaterialName, PbrMaps> = {
  concrete: { albedo: `${dir('concrete')}/albedo.webp`, normal: `${dir('concrete')}/normal.webp`, roughness: `${dir('concrete')}/roughness.webp`, repeat: [5, 5], roughness_scale: 0.9 },
  'wood-floor': { albedo: `${dir('wood-floor')}/albedo.webp`, normal: `${dir('wood-floor')}/normal.webp`, roughness: `${dir('wood-floor')}/roughness.webp`, repeat: [4, 4], roughness_scale: 0.7 },
  marble: { albedo: `${dir('marble')}/albedo.webp`, normal: `${dir('marble')}/normal.webp`, roughness: `${dir('marble')}/roughness.webp`, repeat: [3, 3], roughness_scale: 0.35, metalness: 0.1 },
  'metal-panel': { albedo: `${dir('metal-panel')}/albedo.webp`, normal: `${dir('metal-panel')}/normal.webp`, roughness: `${dir('metal-panel')}/roughness.webp`, repeat: [3, 2], roughness_scale: 0.6, metalness: 0.85 },
  carpet: { albedo: `${dir('carpet')}/albedo.webp`, normal: `${dir('carpet')}/normal.webp`, roughness: `${dir('carpet')}/roughness.webp`, repeat: [6, 6], roughness_scale: 1.0 },
  plaster: { albedo: `${dir('plaster')}/albedo.webp`, normal: `${dir('plaster')}/normal.webp`, roughness: `${dir('plaster')}/roughness.webp`, repeat: [3, 2], roughness_scale: 0.95 },
};

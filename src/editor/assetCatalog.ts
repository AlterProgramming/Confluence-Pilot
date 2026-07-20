import { useGLTF } from '@react-three/drei';
import type { AssetCatalogItem } from './types';

const primitives: AssetCatalogItem[] = [
  {
    id: 'primitive-box',
    label: 'Block',
    category: 'primitive',
    kind: 'primitive',
    primitive: 'box',
    accent: '#78a9ff',
    description: 'One-meter architectural block for spacing and collision studies.',
  },
  {
    id: 'primitive-cylinder',
    label: 'Pedestal',
    category: 'primitive',
    kind: 'primitive',
    primitive: 'cylinder',
    accent: '#f2b84b',
    description: 'Neutral cylindrical pedestal for hero and furniture placement.',
  },
  {
    id: 'primitive-sphere',
    label: 'Sphere',
    category: 'primitive',
    kind: 'primitive',
    primitive: 'sphere',
    accent: '#65d6bd',
    description: 'Reference volume for clearance and lighting composition.',
  },
  {
    id: 'primitive-cone',
    label: 'Marker',
    category: 'primitive',
    kind: 'primitive',
    primitive: 'cone',
    accent: '#ff7b62',
    description: 'Directional marker useful for orientation and camera blocking.',
  },
  {
    id: 'primitive-torus',
    label: 'Ring',
    category: 'primitive',
    kind: 'primitive',
    primitive: 'torus',
    accent: '#bd8cff',
    description: 'Circular reference object for rotation and radial composition.',
  },
];

const roomHeroes: AssetCatalogItem[] = [
  ['01', 'Experience Gallery', '/assets/room-01-hero.glb', 4.4, '#ef3b2d'],
  ['02', 'Workforce Academy', '/assets/room-02-hero.glb', 3.2, '#ff7139'],
  ['03', 'Student Studio', '/assets/room-03-hero.glb', 3.0, '#d8275f'],
  ['04', 'Living AI Building', '/assets/room-04-hero.glb', 3.8, '#3eb7a0'],
  ['05', 'Smart Neighborhoods', '/assets/room-05-hero.glb', 4.0, '#4f9f5d'],
  ['06', 'Infrastructure Testbed', '/assets/room-06-hero.glb', 3.2, '#e8a62b'],
  ['07', 'Trustworthy AI', '/assets/room-07-hero.glb', 3.0, '#5968d9'],
  ['08', 'Autonomous Mobility', '/assets/room-08-hero.glb', 2.6, '#36a6de'],
  ['09', 'Resilient Communications', '/assets/room-09-hero.glb', 3.2, '#9075e8'],
  ['10', 'Cold Chain AI', '/assets/room-10-hero.glb', 3.4, '#7dbb3d'],
  ['11', 'Governable Fintech', '/assets/room-11-hero.glb', 3.0, '#cf4e89'],
  ['12', 'AI for Main Street', '/assets/room-12-hero.glb', 3.2, '#f05b4f'],
].map(([id, label, url, targetSize, accent]) => ({
  id: `room-${id}`,
  label: String(label),
  category: 'room-hero' as const,
  kind: 'gltf' as const,
  url: String(url),
  targetSize: Number(targetSize),
  accent: String(accent),
  description: `Existing Room ${id} hero asset, normalized for neutral composition work.`,
}));

export const assetCatalog: AssetCatalogItem[] = [...primitives, ...roomHeroes];

export function getCatalogAsset(assetId: string): AssetCatalogItem {
  return assetCatalog.find((asset) => asset.id === assetId) ?? primitives[0]!;
}

export function preloadEditorAssetLibrary() {
  roomHeroes.slice(0, 4).forEach((asset) => {
    if (asset.url) useGLTF.preload(asset.url);
  });
}

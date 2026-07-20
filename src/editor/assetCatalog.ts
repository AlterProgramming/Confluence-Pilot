import { useGLTF } from '@react-three/drei';
import type { AssetCatalogItem } from './types';

const primitives: AssetCatalogItem[] = [
  {
    id: 'primitive-box', label: 'Block', category: 'primitive', kind: 'primitive', primitive: 'box',
    footprint: [1, 1, 1], floorAnchored: true, attachable: true, accent: '#78a9ff',
    description: 'One-meter architectural block for spacing, stacking, and collision studies.',
  },
  {
    id: 'primitive-cylinder', label: 'Pedestal', category: 'primitive', kind: 'primitive', primitive: 'cylinder',
    footprint: [1.44, 1, 1.44], floorAnchored: true, attachable: true, accent: '#f2b84b',
    description: 'Neutral cylindrical pedestal for hero and furniture placement.',
  },
  {
    id: 'primitive-sphere', label: 'Sphere', category: 'primitive', kind: 'primitive', primitive: 'sphere',
    footprint: [1.2, 1.2, 1.2], floorAnchored: true, attachable: true, accent: '#65d6bd',
    description: 'Reference volume for clearance and lighting composition.',
  },
  {
    id: 'primitive-cone', label: 'Marker', category: 'primitive', kind: 'primitive', primitive: 'cone',
    footprint: [1.24, 1.2, 1.24], floorAnchored: true, attachable: true, accent: '#ff7b62',
    description: 'Directional marker useful for orientation and camera blocking.',
  },
  {
    id: 'primitive-torus', label: 'Ring', category: 'primitive', kind: 'primitive', primitive: 'torus',
    footprint: [1.66, 0.36, 1.66], floorAnchored: true, attachable: true, accent: '#bd8cff',
    description: 'Circular reference object for rotation and radial composition.',
  },
];

const roomFixtures: AssetCatalogItem[] = [
  {
    id: 'academy-workbench', label: 'Academy workbench', category: 'room-fixture', kind: 'primitive', primitive: 'workbench-table',
    footprint: [1.8, 0.84, 0.85], floorAnchored: true, accent: '#ff7139',
    attachmentSurfaces: [{ id: 'tabletop', label: 'Tabletop', position: [0, 0.86, 0], size: [1.58, 0.68] }],
    description: 'Room 02 desk and legs with a declared tabletop attachment surface.',
  },
  {
    id: 'academy-laptop', label: 'Academy laptop', category: 'room-fixture', kind: 'primitive', primitive: 'laptop',
    footprint: [0.72, 0.46, 0.48], floorAnchored: true, attachable: true, accent: '#ff7139',
    description: 'Independently editable laptop that can attach to a workbench or another declared surface.',
  },
  {
    id: 'academy-credential-stack', label: 'Credential display', category: 'room-fixture', kind: 'primitive', primitive: 'credential-stack',
    footprint: [1.65, 4.1, 0.62], floorAnchored: true, accent: '#ff7139',
    description: 'Four-panel vertical credential display from the academy wall.',
  },
  {
    id: 'academy-coaching-table', label: 'Coaching table', category: 'room-fixture', kind: 'primitive', primitive: 'coaching-table',
    footprint: [3.5, 1.2, 3.2], floorAnchored: true, accent: '#ff7139',
    attachmentSurfaces: [{ id: 'round-top', label: 'Round tabletop', position: [0, 1.14, 0], size: [2.18, 2.18] }],
    description: 'Round coaching table with three learner stools and an editable top surface.',
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
  footprint: [Number(targetSize), Number(targetSize), Number(targetSize)] as [number, number, number],
  floorAnchored: true,
  accent: String(accent),
  description: `Existing Room ${id} hero asset, normalized for composition work.`,
}));

export const assetCatalog: AssetCatalogItem[] = [...primitives, ...roomFixtures, ...roomHeroes];

export function getCatalogAsset(assetId: string): AssetCatalogItem {
  return assetCatalog.find((asset) => asset.id === assetId) ?? primitives[0]!;
}

export function preloadEditorAssetLibrary() {
  roomHeroes.slice(0, 4).forEach((asset) => {
    if (asset.url) useGLTF.preload(asset.url);
  });
}

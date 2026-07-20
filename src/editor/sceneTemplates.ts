import type { CompositionDocument, PlacedAsset, SceneTemplateId, Vector3Tuple } from './types';

const createdAt = Date.now();

function placed(
  id: string,
  assetId: string,
  name: string,
  position: Vector3Tuple,
  rotation: Vector3Tuple = [0, 0, 0],
  scale: Vector3Tuple = [1, 1, 1],
  locked = false,
): PlacedAsset {
  return {
    id,
    assetId,
    name,
    transform: { position, rotation, scale },
    visible: true,
    locked,
    createdAt,
    updatedAt: createdAt,
  };
}

const sandbox: CompositionDocument = {
  schemaVersion: 2,
  id: 'composition-sandbox',
  sceneId: 'sandbox',
  name: 'Composition Sandbox',
  units: 'meters',
  gridUnit: 0.25,
  bounds: null,
  instances: [
    placed('starter-platform', 'primitive-cylinder', 'Platform', [0, 0, 0], [0, 0, 0], [3.2, 0.5, 3.2]),
    placed('starter-block-left', 'primitive-box', 'Reference block A', [-3, 0, -1], [0, Math.PI / 6, 0], [1.5, 1, 1]),
    placed('starter-marker-right', 'primitive-cone', 'Orientation marker', [3, 0, -1], [0, -Math.PI / 4, 0], [1, 1.5, 1]),
  ],
  updatedAt: createdAt,
};

const room02: CompositionDocument = {
  schemaVersion: 2,
  id: 'room-02-composition',
  sceneId: 'room-02',
  name: 'Room 02 · Workforce Academy',
  units: 'meters',
  gridUnit: 0.25,
  bounds: {
    min: [-7.6, 0, -6.9],
    max: [7.6, 5.7, 6.9],
    safeInset: 0.15,
  },
  instances: [
    placed('room-02-hero', 'room-02', 'Credential Lab Hero', [0, 0, -0.55]),
    placed('room-02-bench-front-left', 'academy-workbench', 'Front workbench · left', [-2.55, 0, 2.1], [0, Math.PI, 0]),
    placed('room-02-bench-front-center', 'academy-workbench', 'Front workbench · center', [0, 0, 2.1], [0, Math.PI, 0]),
    placed('room-02-bench-front-right', 'academy-workbench', 'Front workbench · right', [2.55, 0, 2.1], [0, Math.PI, 0]),
    placed('room-02-bench-rear-left', 'academy-workbench', 'Rear workbench · left', [-2.55, 0, -0.05], [0, Math.PI, 0]),
    placed('room-02-bench-rear-center', 'academy-workbench', 'Rear workbench · center', [0, 0, -0.05], [0, Math.PI, 0]),
    placed('room-02-bench-rear-right', 'academy-workbench', 'Rear workbench · right', [2.55, 0, -0.05], [0, Math.PI, 0]),
    placed('room-02-credential-stack', 'academy-credential-stack', 'Credential display stack', [5.15, 0, -2.4], [0, -0.32, 0]),
    placed('room-02-coaching-table', 'academy-coaching-table', 'Coaching table', [-5.1, 0, -1.4], [0, 0.35, 0]),
  ],
  updatedAt: createdAt,
};

const templates: Record<SceneTemplateId, CompositionDocument> = {
  sandbox,
  'room-02': room02,
};

export const sceneTemplateOptions: Array<{ id: SceneTemplateId; label: string }> = [
  { id: 'sandbox', label: 'Neutral sandbox' },
  { id: 'room-02', label: 'Room 02 · Workforce Academy' },
];

export function cloneCompositionDocument(document: CompositionDocument): CompositionDocument {
  return {
    ...document,
    bounds: document.bounds
      ? {
          min: [...document.bounds.min] as Vector3Tuple,
          max: [...document.bounds.max] as Vector3Tuple,
          safeInset: document.bounds.safeInset,
        }
      : null,
    instances: document.instances.map((instance) => ({
      ...instance,
      transform: {
        position: [...instance.transform.position] as Vector3Tuple,
        rotation: [...instance.transform.rotation] as Vector3Tuple,
        scale: [...instance.transform.scale] as Vector3Tuple,
      },
    })),
    updatedAt: Date.now(),
  };
}

export function getSceneTemplate(sceneId: SceneTemplateId): CompositionDocument {
  return cloneCompositionDocument(templates[sceneId]);
}

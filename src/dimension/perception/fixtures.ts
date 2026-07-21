import type { InstanceEvidence, PerceptionBundleV2, SurfaceEvidence } from './contracts';

function svg(title: string, body: string, background = '#dbeafe'): string {
  const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 768"><rect width="1024" height="768" fill="${background}"/><text x="28" y="54" font-family="sans-serif" font-size="28" fill="#111827">${title}</text>${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
}

function instance(
  id: string,
  concept: string,
  label: string,
  box: [number, number, number, number],
  depth: number,
  confidence = 0.92,
): InstanceEvidence {
  return {
    id,
    detectionId: `det-${id}`,
    concept,
    label,
    confidence,
    maskConfidence: Math.min(0.98, confidence + 0.02),
    box,
    maskRef: `masks/${id}.png`,
    medianDepth: depth,
    nearDepth: Math.max(0, depth - 0.1),
    farDepth: Math.min(1, depth + 0.1),
    medianNormal: [0, 0.1, 0.99],
    pixelArea: Math.round((box[2] - box[0]) * (box[3] - box[1]) * 0.62),
    status: 'accepted',
  };
}

function surface(
  id: string,
  label: string,
  concept: string,
  polygon: Array<[number, number]>,
  walkability: SurfaceEvidence['walkability'],
  depth: number,
  rationale: string[],
): SurfaceEvidence {
  return {
    id,
    label,
    concept,
    polygon,
    confidence: walkability === 'uncertain' ? 0.52 : 0.91,
    medianDepth: depth,
    medianNormal: walkability === 'walkable' ? [0.02, 0.98, 0.08] : [0.88, 0.12, 0.1],
    walkability,
    rationale,
  };
}

function bundle(input: Omit<PerceptionBundleV2, 'schemaVersion' | 'geometry' | 'detections' | 'artifacts' | 'provenance' | 'validation'>): PerceptionBundleV2 {
  return {
    schemaVersion: '2.0.0',
    ...input,
    geometry: {
      provider: 'moge-2-vitl-normal',
      modelVersion: 'fixture-v1',
      depth: { ref: 'depth.npy', width: 1024, height: 768, format: 'npy' },
      normals: { ref: 'normals.npy', width: 1024, height: 768, format: 'npy' },
      confidence: { ref: 'geometry-confidence.png', width: 1024, height: 768, format: 'png' },
      points: { ref: 'points.npy', width: 1024, height: 768, format: 'npy' },
      camera: { fieldOfViewDegrees: 58 },
    },
    detections: input.instances.map((item) => ({
      id: item.detectionId,
      concept: item.concept,
      phrase: item.concept,
      confidence: item.confidence,
      box: item.box,
    })),
    artifacts: [
      { ref: 'depth-preview.png', width: 1024, height: 768, format: 'png' },
      { ref: 'normals-preview.png', width: 1024, height: 768, format: 'png' },
      { ref: 'instance-overlay.png', width: 1024, height: 768, format: 'png' },
      { ref: 'walkability-preview.png', width: 1024, height: 768, format: 'png' },
      { ref: 'uncertainty-mask.png', width: 1024, height: 768, format: 'png' },
    ],
    provenance: [
      { stage: 'geometry', provider: 'moge-2-vitl-normal', checkpoint: 'fixture-v1', precision: 'bf16', durationMs: 810, peakVramGb: 7.8, parameters: { maxImageSide: 1024 } },
      { stage: 'detection', provider: 'grounding-dino-swin-t', checkpoint: 'fixture-v1', precision: 'bf16', durationMs: 420, peakVramGb: 5.1, parameters: { boxThreshold: 0.3 } },
      { stage: 'segmentation', provider: 'sam2.1-hiera-large', checkpoint: 'fixture-v1', precision: 'bf16', durationMs: 670, peakVramGb: 10.6, parameters: { multimask: false } },
    ],
    validation: { status: 'unreviewed', warnings: [] },
  };
}

const corridor = bundle({
  id: 'fixture-corridor-v2',
  fixtureId: 'corridor',
  source: {
    name: 'Corridor validation scene',
    url: svg('CORRIDOR', '<rect y="260" width="1024" height="508" fill="#71866d"/><polygon points="440,290 584,290 820,768 200,768" fill="#c6a979"/><polygon points="0,170 370,250 370,768 0,768" fill="#777181"/><polygon points="1024,180 655,250 655,768 1024,768" fill="#6f7684"/><rect x="476" y="210" width="78" height="110" fill="#665b75"/><circle cx="415" cy="390" r="48" fill="#3f7d4c"/><circle cx="620" cy="400" r="45" fill="#3f7d4c"/>'),
    width: 1024,
    height: 768,
    sha256: 'fixture-corridor',
  },
  instances: [
    instance('left-wall', 'building', 'Left structure', [0, 170, 370, 768], 0.42),
    instance('right-wall', 'building', 'Right structure', [655, 180, 1024, 768], 0.43),
    instance('archway', 'archway', 'Distant archway', [476, 210, 554, 320], 0.86, 0.87),
    instance('tree-a', 'tree', 'Tree A', [365, 330, 465, 500], 0.36),
    instance('tree-b', 'tree', 'Tree B', [575, 340, 665, 510], 0.39),
  ],
  surfaces: [
    surface('central-path', 'Central path', 'path', [[0.43, 0.38], [0.57, 0.38], [0.8, 1], [0.2, 1]], 'walkable', 0.38, ['Upward-facing surface', 'Connected corridor']),
    surface('left-wall-surface', 'Left wall', 'wall', [[0, 0.22], [0.36, 0.33], [0.36, 1], [0, 1]], 'blocked', 0.42, ['Vertical normal', 'Building overlap']),
    surface('right-wall-surface', 'Right wall', 'wall', [[0.64, 0.33], [1, 0.23], [1, 1], [0.64, 1]], 'blocked', 0.43, ['Vertical normal', 'Building overlap']),
  ],
  navigation: {
    walkableMaskRef: 'walkability-mask.png',
    connectedComponents: [{ id: 'corridor-main', surfaceIds: ['central-path'], areaRatio: 0.31, confidence: 0.92 }],
    spawnCandidates: [{ id: 'corridor-spawn', surfaceId: 'central-path', imagePosition: [0.5, 0.83], confidence: 0.94, rationale: ['Largest connected component'] }],
  },
  relations: [{ id: 'path-to-arch', subjectId: 'central-path', predicate: 'leads_to', objectId: 'archway', confidence: 0.86, source: 'reasoning' }],
  uncertainty: { maskRef: 'uncertainty-mask.png', regions: [] },
});

const waterBridge = bundle({
  id: 'fixture-water-bridge-v2',
  fixtureId: 'water-bridge',
  source: {
    name: 'Water and bridge validation scene',
    url: svg('WATER + BRIDGE', '<rect y="300" width="1024" height="468" fill="#3d8fbd"/><polygon points="445,305 578,305 720,768 295,768" fill="#a99477"/><rect x="490" y="130" width="62" height="175" fill="#72677f"/><polygon points="70,570 250,545 315,630 120,655" fill="#77482f"/>'),
    width: 1024,
    height: 768,
    sha256: 'fixture-water-bridge',
  },
  instances: [
    instance('bridge', 'bridge', 'Bridge deck', [295, 305, 720, 768], 0.34, 0.95),
    instance('tower', 'tower', 'Distant tower', [490, 130, 552, 305], 0.88),
    instance('boat', 'boat', 'Foreground boat', [70, 545, 315, 655], 0.12),
  ],
  surfaces: [
    surface('bridge-deck', 'Bridge deck', 'bridge', [[0.43, 0.4], [0.57, 0.4], [0.7, 1], [0.29, 1]], 'walkable', 0.34, ['Upward-facing deck']),
    surface('water', 'Water', 'water', [[0, 0.39], [1, 0.39], [1, 1], [0, 1]], 'blocked', 0.48, ['Water defaults to non-walkable']),
  ],
  navigation: {
    walkableMaskRef: 'walkability-mask.png',
    connectedComponents: [{ id: 'bridge-main', surfaceIds: ['bridge-deck'], areaRatio: 0.22, confidence: 0.95 }],
    spawnCandidates: [{ id: 'bridge-spawn', surfaceId: 'bridge-deck', imagePosition: [0.5, 0.82], confidence: 0.95, rationale: ['Clear bridge centerline'] }],
  },
  relations: [
    { id: 'bridge-to-tower', subjectId: 'bridge', predicate: 'leads_to', objectId: 'tower', confidence: 0.9, source: 'reasoning' },
    { id: 'boat-occludes-water', subjectId: 'boat', predicate: 'occludes', objectId: 'water', confidence: 0.96, source: 'geometry' },
  ],
  uncertainty: { maskRef: 'uncertainty-mask.png', regions: [] },
});

const adjacentTowers = bundle({
  id: 'fixture-adjacent-towers-v2',
  fixtureId: 'adjacent-towers',
  source: {
    name: 'Adjacent towers validation scene',
    url: svg('ADJACENT TOWERS', '<rect y="320" width="1024" height="448" fill="#889d70"/><rect x="360" y="155" width="110" height="290" fill="#75657e"/><rect x="490" y="175" width="120" height="270" fill="#806a73"/><polygon points="450,430 555,430 690,768 300,768" fill="#b39d77"/>'),
    width: 1024,
    height: 768,
    sha256: 'fixture-adjacent-towers',
  },
  instances: [
    instance('tower-a', 'tower', 'Tower A', [360, 155, 470, 445], 0.62),
    instance('tower-b', 'tower', 'Tower B', [490, 175, 610, 445], 0.64),
  ],
  surfaces: [
    surface('tower-path', 'Foreground path', 'path', [[0.44, 0.56], [0.54, 0.56], [0.67, 1], [0.3, 1]], 'walkable', 0.28, ['Connected foreground path']),
    surface('tower-a-surface', 'Tower A surface', 'tower', [[0.35, 0.2], [0.46, 0.2], [0.46, 0.58], [0.35, 0.58]], 'blocked', 0.62, ['Vertical structure']),
    surface('tower-b-surface', 'Tower B surface', 'tower', [[0.48, 0.23], [0.6, 0.23], [0.6, 0.58], [0.48, 0.58]], 'blocked', 0.64, ['Vertical structure']),
  ],
  navigation: {
    walkableMaskRef: 'walkability-mask.png',
    connectedComponents: [{ id: 'tower-path-main', surfaceIds: ['tower-path'], areaRatio: 0.19, confidence: 0.92 }],
    spawnCandidates: [{ id: 'tower-spawn', surfaceId: 'tower-path', imagePosition: [0.5, 0.84], confidence: 0.93, rationale: ['Clear foreground path'] }],
  },
  relations: [{ id: 'towers-adjacent', subjectId: 'tower-a', predicate: 'adjacent_to', objectId: 'tower-b', confidence: 0.97, source: 'geometry' }],
  uncertainty: { maskRef: 'uncertainty-mask.png', regions: [] },
});

const ambiguousFantasy = bundle({
  id: 'fixture-ambiguous-fantasy-v2',
  fixtureId: 'ambiguous-fantasy',
  source: {
    name: 'Ambiguous fantasy validation scene',
    url: svg('AMBIGUOUS FANTASY', '<ellipse cx="305" cy="340" rx="215" ry="165" fill="#685887"/><polygon points="370,470 620,410 710,470 430,560" fill="#aa98b0"/><ellipse cx="515" cy="210" rx="85" ry="95" fill="none" stroke="#e3b7ff" stroke-width="24"/>', '#2d2948'),
    width: 1024,
    height: 768,
    sha256: 'fixture-ambiguous-fantasy',
  },
  instances: [
    instance('floating-path', 'path', 'Unsupported path', [370, 410, 710, 560], 0.48, 0.58),
    instance('portal', 'portal', 'Portal ring', [430, 115, 600, 310], 0.7, 0.84),
  ],
  surfaces: [surface('unsupported-path', 'Unsupported floating path', 'path', [[0.36, 0.53], [0.61, 0.48], [0.69, 0.61], [0.42, 0.73]], 'uncertain', 0.48, ['No visible support', 'Large depth spread'])],
  navigation: { walkableMaskRef: 'walkability-mask.png', connectedComponents: [], spawnCandidates: [] },
  relations: [],
  uncertainty: {
    maskRef: 'uncertainty-mask.png',
    regions: [{ id: 'impossible-geometry', polygon: [[0.1, 0.15], [0.9, 0.15], [0.9, 0.85], [0.1, 0.85]], confidence: 0.78, reason: 'Unsupported and mutually inconsistent surfaces' }],
  },
});

export const perceptionFixtures = {
  corridor,
  'water-bridge': waterBridge,
  'adjacent-towers': adjacentTowers,
  'ambiguous-fantasy': ambiguousFantasy,
} satisfies Record<string, PerceptionBundleV2>;

export type PerceptionFixtureId = keyof typeof perceptionFixtures;

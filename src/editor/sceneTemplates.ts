import type {
  CompositionDocument,
  DesignProposition,
  PlacedAsset,
  SceneBounds,
  SceneTemplateId,
  Vector3Tuple,
} from './types';

const createdAt = Date.now();

function placed(
  id: string,
  assetId: string,
  name: string,
  position: Vector3Tuple,
  rotation: Vector3Tuple = [0, 0, 0],
  scale: Vector3Tuple = [1, 1, 1],
  locked = false,
  parentId: string | null = null,
  surfaceId: string | null = null,
): PlacedAsset {
  return {
    id,
    assetId,
    name,
    transform: { position, rotation, scale },
    parentId,
    surfaceId,
    visible: true,
    locked,
    createdAt,
    updatedAt: createdAt,
  };
}

function workbenchAssembly(
  id: string,
  label: string,
  position: Vector3Tuple,
  rotationY: number,
  laptopOffset: Vector3Tuple = [0, 0.86, -0.03],
  laptopRotationY = 0,
  laptopId = `${id}-laptop`,
): PlacedAsset[] {
  return [
    placed(id, 'academy-workbench', label, position, [0, rotationY, 0]),
    placed(
      laptopId,
      'academy-laptop',
      `${label} · laptop`,
      laptopOffset,
      [0, laptopRotationY, 0],
      [1, 1, 1],
      false,
      id,
      'tabletop',
    ),
  ];
}

const room02Bounds: SceneBounds = {
  min: [-7.6, 0, -6.9],
  max: [7.6, 5.7, 6.9],
  safeInset: 0.15,
};

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
  bounds: room02Bounds,
  instances: [
    placed('room-02-hero', 'room-02', 'Credential Lab Hero', [0, 0, -0.55]),
    ...workbenchAssembly('room-02-bench-front-left', 'Front workbench · left', [-2.55, 0, 2.1], Math.PI, [-0.24, 0.86, -0.02], 0.12, 'room-02-laptop-front-left'),
    ...workbenchAssembly('room-02-bench-front-center', 'Front workbench · center', [0, 0, 2.1], Math.PI, [0, 0.86, -0.04], 0, 'room-02-laptop-front-center'),
    ...workbenchAssembly('room-02-bench-front-right', 'Front workbench · right', [2.55, 0, 2.1], Math.PI, [0.24, 0.86, -0.02], -0.12, 'room-02-laptop-front-right'),
    ...workbenchAssembly('room-02-bench-rear-left', 'Rear workbench · left', [-2.55, 0, -0.05], Math.PI, [0.18, 0.86, 0], -0.08, 'room-02-laptop-rear-left'),
    ...workbenchAssembly('room-02-bench-rear-center', 'Rear workbench · center', [0, 0, -0.05], Math.PI, [-0.12, 0.86, 0.02], 0.06, 'room-02-laptop-rear-center'),
    ...workbenchAssembly('room-02-bench-rear-right', 'Rear workbench · right', [2.55, 0, -0.05], Math.PI, [0.08, 0.86, -0.04], -0.04, 'room-02-laptop-rear-right'),
    placed('room-02-credential-stack', 'academy-credential-stack', 'Credential display stack', [5.15, 0, -2.4], [0, -0.32, 0]),
    placed('room-02-coaching-table', 'academy-coaching-table', 'Coaching table', [-5.1, 0, -1.4], [0, 0.35, 0]),
  ],
  updatedAt: createdAt,
};

const academyAxis: DesignProposition = {
  id: 'academy-axis',
  title: 'The Academy Axis',
  thesis: 'Make progression from instruction to practice to credential visible on one disciplined longitudinal axis.',
  experientialPromise: 'A stakeholder should read the room immediately as a credible academy rather than a technology showroom.',
  signatureMove: 'A clear central aisle terminates at the active teaching hero, with coaching and credential review flanking the destination.',
  hierarchy: [
    'Active instruction and demonstration',
    'Ordered learner workstations',
    'Credential outcome',
    'Small-group coaching',
  ],
  adoptedQualities: ['Strong center axis', 'Repeated learning rhythm', 'Warm institutional surfaces'],
  rejectedQualities: ['Decorative screens', 'Floating showcase object', 'Ambiguous workstation orientation'],
  tradeoffs: ['The arrangement is clear and efficient but intentionally formal.', 'The coaching zone is secondary rather than socially central.'],
  accent: '#ff7a3d',
  camera: { position: [11.8, 8.4, 14.8], target: [0, 1.25, -1.4] },
  zones: [
    { id: 'instruction', label: 'Instruction', intent: 'The room’s authoritative destination and primary shared view.', center: [0, -4.15], size: [5.1, 3.4], rotation: 0, accent: '#ff7a3d' },
    { id: 'practice', label: 'Practice', intent: 'Two disciplined workstation rows with an unobstructed center aisle.', center: [0, 1.8], size: [7.8, 5.0], rotation: 0, accent: '#f2bf67' },
    { id: 'credential', label: 'Credential review', intent: 'A visible outcome zone near the teaching destination.', center: [5.25, -4.45], size: [3.3, 3.5], rotation: 0, accent: '#7fc7ff' },
    { id: 'coaching', label: 'Coaching', intent: 'A quieter support zone adjacent to, but outside, the main axis.', center: [-5.15, -3.3], size: [4.0, 4.5], rotation: 0, accent: '#83d9b2' },
  ],
  circulation: [[0, 0.025, 6.0], [0, 0.025, 3.9], [0, 0.025, 1.4], [0, 0.025, -1.2], [0, 0.025, -4.1]],
  focalPoint: [0, 0.03, -4.1],
};

const credentialGallery: DesignProposition = {
  id: 'credential-gallery',
  title: 'The Credential Gallery',
  thesis: 'Turn learning into a public promenade whose destination is visible achievement.',
  experientialPromise: 'The room should feel ceremonial and legible to visitors while still supporting individual work.',
  signatureMove: 'Workstations form two inhabited edges around a central procession from coaching to demonstration to credentials.',
  hierarchy: [
    'Credential wall as destination',
    'Central demonstration object',
    'Learning galleries on both sides',
    'Coaching threshold at entry',
  ],
  adoptedQualities: ['Visible credential outcome', 'Gallery-like procession', 'Public-facing demonstration'],
  rejectedQualities: ['Classroom rows', 'Back-of-room coaching', 'Technology scattered without narrative'],
  tradeoffs: ['The promenade is memorable but uses more floor area for circulation.', 'Learners face inward rather than sharing one instructor-facing view.'],
  accent: '#65cfff',
  camera: { position: [12.8, 7.6, 12.0], target: [0, 1.2, -1.2] },
  zones: [
    { id: 'promenade', label: 'Achievement promenade', intent: 'A generous route that makes the room understandable to a first-time visitor.', center: [0, 0], size: [4.0, 10.8], rotation: 0, accent: '#65cfff' },
    { id: 'left-gallery', label: 'Learning gallery A', intent: 'A side band of focused individual work.', center: [-5.2, 0], size: [3.1, 9.0], rotation: 0, accent: '#9e8cff' },
    { id: 'right-gallery', label: 'Learning gallery B', intent: 'A mirrored side band that keeps the central route open.', center: [5.2, 0], size: [3.1, 9.0], rotation: 0, accent: '#9e8cff' },
    { id: 'credential-terminus', label: 'Credential terminus', intent: 'The final proof of progression, framed as the room’s ceremonial destination.', center: [0, -5.55], size: [5.0, 2.4], rotation: 0, accent: '#ffcf6d' },
    { id: 'coaching-threshold', label: 'Coaching threshold', intent: 'An approachable conversation zone before entering the learning galleries.', center: [0, 3.8], size: [4.4, 4.0], rotation: 0, accent: '#7ed6ad' },
  ],
  circulation: [[0, 0.025, 6.1], [0, 0.025, 3.6], [0, 0.025, 1.0], [0, 0.025, -2.0], [0, 0.025, -5.6]],
  focalPoint: [0, 0.03, -5.55],
};

const learningForum: DesignProposition = {
  id: 'learning-forum',
  title: 'The Learning Forum',
  thesis: 'Replace the computer-lab hierarchy with a collaborative room organized around conversation and shared making.',
  experientialPromise: 'The stakeholder should see a culture of participation rather than rows of passive instruction.',
  signatureMove: 'A central coaching table becomes the social heart, enclosed by a loose ring of individually editable workbench assemblies.',
  hierarchy: [
    'Collaborative center',
    'Ring of participant workstations',
    'Demonstration and credentials as opposing anchors',
    'Multiple informal paths rather than one prescribed aisle',
  ],
  adoptedQualities: ['Human-centered collaboration', 'Visible participation', 'Balanced opposing anchors'],
  rejectedQualities: ['Rigid classroom rows', 'Single dominant technology object', 'Ceremonial distance between people and tools'],
  tradeoffs: ['The room is socially rich but less efficient for lecture-style instruction.', 'The distributed circulation requires more careful accessibility review.'],
  accent: '#82d49b',
  camera: { position: [11.2, 9.2, 13.4], target: [0, 1.1, 0] },
  zones: [
    { id: 'forum-heart', label: 'Forum heart', intent: 'Shared discussion, review, and small-group work.', center: [0, 0], size: [4.8, 4.5], rotation: 0, accent: '#82d49b' },
    { id: 'participant-ring', label: 'Participant ring', intent: 'An irregular but intentional perimeter of individually oriented workstations.', center: [0, 1.0], size: [11.5, 9.5], rotation: 0, accent: '#f0b96d' },
    { id: 'demonstration-anchor', label: 'Demonstration anchor', intent: 'A side-stage technology moment that supports rather than dominates the forum.', center: [5.0, -4.6], size: [4.2, 3.7], rotation: 0, accent: '#72c8f0' },
    { id: 'credential-anchor', label: 'Credential anchor', intent: 'An opposing evidence wall that balances demonstration with achievement.', center: [-5.25, -4.8], size: [3.8, 3.2], rotation: 0, accent: '#b79cff' },
  ],
  circulation: [[0, 0.025, 6.0], [-3.0, 0.025, 3.8], [-4.4, 0.025, 1.0], [-2.5, 0.025, -2.8], [0, 0.025, -3.8], [2.8, 0.025, -2.5], [4.5, 0.025, 1.0], [3.0, 0.025, 3.8], [0, 0.025, 6.0]],
  focalPoint: [0, 0.03, 0],
};

const achievementForum: DesignProposition = {
  id: 'achievement-forum',
  title: 'The Achievement Forum',
  thesis: 'Organize collaboration as the social threshold to a clear learning-to-achievement spine.',
  experientialPromise: 'A stakeholder should understand both how people gather and where their work is intended to lead.',
  signatureMove: 'The entry path bends around a collaborative forum, then resolves into an axial demonstration and credential sequence.',
  hierarchy: [
    'Collaborative forum as the human center',
    'Demonstration spine as shared orientation',
    'Credential destination as visible outcome',
    'Learning wings supporting both individual and group work',
  ],
  adoptedQualities: ['Forum-centered participation', 'Visible journey toward achievement', 'Clear shared orientation'],
  rejectedQualities: ['Unresolved furniture ring', 'Empty ceremonial promenade', 'Rigid lecture-only rows'],
  tradeoffs: ['The hybrid is richer but depends on disciplined hierarchy to avoid feeling over-programmed.', 'The central forum intentionally bends circulation instead of preserving a perfectly straight aisle.'],
  accent: '#f2a64a',
  camera: { position: [12.3, 8.8, 14.4], target: [0, 1.15, -0.8] },
  zones: [
    { id: 'social-threshold', label: 'Collaborative threshold', intent: 'The first spatial event is a visible place for coaching, critique, and shared planning.', center: [0, 2.0], size: [5.4, 4.7], rotation: 0, accent: '#82d49b' },
    { id: 'left-learning-wing', label: 'Learning wing A', intent: 'An angled sequence of workstations that participates in the forum while retaining focus.', center: [-4.65, -0.2], size: [3.2, 8.8], rotation: -0.12, accent: '#f0b96d' },
    { id: 'right-learning-wing', label: 'Learning wing B', intent: 'A balancing workstation wing oriented toward the shared demonstration spine.', center: [4.65, -0.2], size: [3.2, 8.8], rotation: 0.12, accent: '#f0b96d' },
    { id: 'demonstration-spine', label: 'Demonstration spine', intent: 'A shared applied-learning moment that gathers attention without becoming a detached showcase.', center: [0, -2.75], size: [5.2, 3.0], rotation: 0, accent: '#72c8f0' },
    { id: 'achievement-destination', label: 'Achievement destination', intent: 'Credentials terminate the room’s narrative as evidence of completed learning.', center: [0, -5.65], size: [5.2, 2.2], rotation: 0, accent: '#c6a4ff' },
  ],
  circulation: [[0, 0.025, 6.1], [-2.35, 0.025, 4.05], [-2.45, 0.025, 1.55], [0, 0.025, -0.55], [0, 0.025, -2.8], [0, 0.025, -5.6]],
  focalPoint: [0, 0.03, -5.6],
};

const room02AcademyAxis: CompositionDocument = {
  schemaVersion: 2,
  id: 'room-02-proposition-academy-axis',
  sceneId: 'room-02-academy-axis',
  name: 'Room 02 · The Academy Axis',
  units: 'meters',
  gridUnit: 0.25,
  bounds: room02Bounds,
  proposition: academyAxis,
  instances: [
    placed('axis-hero', 'room-02', 'Teaching demonstration', [0, 0, -4.1]),
    ...workbenchAssembly('axis-bench-front-left', 'Learner station A1', [-2.7, 0, 3.0], Math.PI, [-0.18, 0.86, -0.03], 0.05),
    ...workbenchAssembly('axis-bench-front-center', 'Learner station A2', [0, 0, 3.0], Math.PI),
    ...workbenchAssembly('axis-bench-front-right', 'Learner station A3', [2.7, 0, 3.0], Math.PI, [0.18, 0.86, -0.03], -0.05),
    ...workbenchAssembly('axis-bench-rear-left', 'Learner station B1', [-2.7, 0, 0.65], Math.PI, [0.12, 0.86, 0], -0.04),
    ...workbenchAssembly('axis-bench-rear-center', 'Learner station B2', [0, 0, 0.65], Math.PI),
    ...workbenchAssembly('axis-bench-rear-right', 'Learner station B3', [2.7, 0, 0.65], Math.PI, [-0.12, 0.86, 0], 0.04),
    placed('axis-credential-stack', 'academy-credential-stack', 'Credential review tower', [5.45, 0, -4.75], [0, -0.12, 0]),
    placed('axis-coaching-table', 'academy-coaching-table', 'Coaching alcove', [-5.25, 0, -3.45], [0, 0.2, 0]),
  ],
  updatedAt: createdAt,
};

const room02CredentialGallery: CompositionDocument = {
  schemaVersion: 2,
  id: 'room-02-proposition-credential-gallery',
  sceneId: 'room-02-credential-gallery',
  name: 'Room 02 · The Credential Gallery',
  units: 'meters',
  gridUnit: 0.25,
  bounds: room02Bounds,
  proposition: credentialGallery,
  instances: [
    placed('gallery-hero', 'room-02', 'Public demonstration', [0, 0, -2.75]),
    ...workbenchAssembly('gallery-left-front', 'Learning gallery A1', [-5.25, 0, 2.4], -Math.PI / 2, [0.08, 0.86, -0.03], -0.08),
    ...workbenchAssembly('gallery-left-middle', 'Learning gallery A2', [-5.25, 0, 0], -Math.PI / 2),
    ...workbenchAssembly('gallery-left-rear', 'Learning gallery A3', [-5.25, 0, -2.45], -Math.PI / 2, [-0.08, 0.86, -0.03], 0.08),
    ...workbenchAssembly('gallery-right-front', 'Learning gallery B1', [5.25, 0, 2.4], Math.PI / 2, [-0.08, 0.86, -0.03], 0.08),
    ...workbenchAssembly('gallery-right-middle', 'Learning gallery B2', [5.25, 0, 0], Math.PI / 2),
    ...workbenchAssembly('gallery-right-rear', 'Learning gallery B3', [5.25, 0, -2.45], Math.PI / 2, [0.08, 0.86, -0.03], -0.08),
    placed('gallery-credential-stack', 'academy-credential-stack', 'Credential terminus', [0, 0, -5.95]),
    placed('gallery-coaching-table', 'academy-coaching-table', 'Coaching threshold', [0, 0, 3.75]),
  ],
  updatedAt: createdAt,
};

const room02LearningForum: CompositionDocument = {
  schemaVersion: 2,
  id: 'room-02-proposition-learning-forum',
  sceneId: 'room-02-learning-forum',
  name: 'Room 02 · The Learning Forum',
  units: 'meters',
  gridUnit: 0.25,
  bounds: room02Bounds,
  proposition: learningForum,
  instances: [
    placed('forum-hero', 'room-02', 'Demonstration side-stage', [4.95, 0, -4.55], [0, -0.42, 0]),
    ...workbenchAssembly('forum-bench-left-near', 'Forum station A', [-4.5, 0, 2.8], -2.34, [0.12, 0.86, -0.03], -0.05),
    ...workbenchAssembly('forum-bench-left-far', 'Forum station B', [-2.2, 0, 4.45], -2.78, [-0.08, 0.86, 0], 0.08),
    ...workbenchAssembly('forum-bench-center-front', 'Forum station C', [0, 0, 5.05], Math.PI),
    ...workbenchAssembly('forum-bench-right-far', 'Forum station D', [2.2, 0, 4.45], 2.78, [0.08, 0.86, 0], -0.08),
    ...workbenchAssembly('forum-bench-right-near', 'Forum station E', [4.5, 0, 2.8], 2.34, [-0.12, 0.86, -0.03], 0.05),
    ...workbenchAssembly('forum-bench-rear', 'Forum station F', [0, 0, -2.9], 0),
    placed('forum-credential-stack', 'academy-credential-stack', 'Credential evidence anchor', [-5.55, 0, -4.85], [0, 0.15, 0]),
    placed('forum-coaching-table', 'academy-coaching-table', 'Shared forum table', [0, 0, 0]),
  ],
  updatedAt: createdAt,
};

const room02AchievementForum: CompositionDocument = {
  schemaVersion: 2,
  id: 'room-02-proposition-achievement-forum',
  sceneId: 'room-02-achievement-forum',
  name: 'Room 02 · The Achievement Forum',
  units: 'meters',
  gridUnit: 0.25,
  bounds: room02Bounds,
  proposition: achievementForum,
  instances: [
    placed('achievement-hero', 'room-02', 'Applied demonstration', [0, 0, -2.75]),
    ...workbenchAssembly('achievement-left-front', 'Learning wing A1', [-4.45, 0, 3.55], -2.25, [0.12, 0.86, -0.03], -0.06),
    ...workbenchAssembly('achievement-left-middle', 'Learning wing A2', [-5.15, 0, 0.25], -1.68),
    ...workbenchAssembly('achievement-left-rear', 'Learning wing A3', [-4.25, 0, -3.15], -1.18, [-0.1, 0.86, -0.02], 0.05),
    ...workbenchAssembly('achievement-right-front', 'Learning wing B1', [4.45, 0, 3.55], 2.25, [-0.12, 0.86, -0.03], 0.06),
    ...workbenchAssembly('achievement-right-middle', 'Learning wing B2', [5.15, 0, 0.25], 1.68),
    ...workbenchAssembly('achievement-right-rear', 'Learning wing B3', [4.25, 0, -3.15], 1.18, [0.1, 0.86, -0.02], -0.05),
    placed('achievement-credential-stack', 'academy-credential-stack', 'Achievement destination', [0, 0, -5.85]),
    placed('achievement-coaching-table', 'academy-coaching-table', 'Collaborative forum', [0, 0, 1.65]),
  ],
  updatedAt: createdAt,
};

const templates: Record<SceneTemplateId, CompositionDocument> = {
  sandbox,
  'room-02': room02,
  'room-02-academy-axis': room02AcademyAxis,
  'room-02-credential-gallery': room02CredentialGallery,
  'room-02-learning-forum': room02LearningForum,
  'room-02-achievement-forum': room02AchievementForum,
};

export const sceneTemplateOptions: Array<{ id: SceneTemplateId; label: string; group: 'workspace' | 'proposition' }> = [
  { id: 'sandbox', label: 'Neutral sandbox', group: 'workspace' },
  { id: 'room-02', label: 'Room 02 · Current blockout', group: 'workspace' },
  { id: 'room-02-academy-axis', label: 'Proposition A · Academy Axis', group: 'proposition' },
  { id: 'room-02-credential-gallery', label: 'Proposition B · Credential Gallery', group: 'proposition' },
  { id: 'room-02-learning-forum', label: 'Proposition C · Learning Forum', group: 'proposition' },
  { id: 'room-02-achievement-forum', label: 'Proposition D · Achievement Forum', group: 'proposition' },
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
    proposition: document.proposition
      ? {
          ...document.proposition,
          camera: {
            position: [...document.proposition.camera.position] as Vector3Tuple,
            target: [...document.proposition.camera.target] as Vector3Tuple,
          },
          zones: document.proposition.zones.map((zone) => ({
            ...zone,
            center: [...zone.center] as [number, number],
            size: [...zone.size] as [number, number],
          })),
          circulation: document.proposition.circulation.map((point) => [...point] as Vector3Tuple),
          focalPoint: [...document.proposition.focalPoint] as Vector3Tuple,
          hierarchy: [...document.proposition.hierarchy],
          adoptedQualities: [...document.proposition.adoptedQualities],
          rejectedQualities: [...document.proposition.rejectedQualities],
          tradeoffs: [...document.proposition.tradeoffs],
        }
      : undefined,
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

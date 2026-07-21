import { access, readFile, stat } from 'node:fs/promises';

const requiredFiles = [
  'src/dimension/Dimension.ts',
  'src/dimension/DimensionApp.tsx',
  'src/dimension/DimensionScene.tsx',
  'src/dimension/dimension.css',
  'public/reference/dimensions/the-weight-of-remembering.webp',
];

const checks = [];
for (const path of requiredFiles) {
  try {
    await access(path);
    checks.push({ id: `file:${path}`, pass: true });
  } catch {
    checks.push({ id: `file:${path}`, pass: false, detail: 'missing' });
  }
}

const dimensionSource = await readFile('src/dimension/Dimension.ts', 'utf8');
const sceneSource = await readFile('src/dimension/DimensionScene.tsx', 'utf8');
const dimensionAppSource = await readFile('src/dimension/DimensionApp.tsx', 'utf8');
const appSource = await readFile('src/App.tsx', 'utf8');
const seed = await stat('public/reference/dimensions/the-weight-of-remembering.webp');

checks.push(
  { id: 'dimension-class', pass: /export class Dimension/.test(dimensionSource) },
  { id: 'semantic-id-constructor', pass: /constructor\(dimensionId: string\)/.test(dimensionSource) },
  {
    id: 'dimension-registry',
    pass: /sceneByDimensionId/.test(dimensionSource)
      && /\[rememberingSpec\.id\]: rememberingSpec/.test(dimensionSource),
  },
  {
    id: 'room-is-optional-entrance',
    pass: /kind: 'room'/.test(dimensionSource)
      && /sourceId: '02'/.test(dimensionSource)
      && /Dimension\.fromEntrance\('room'/.test(dimensionAppSource),
  },
  {
    id: 'room-does-not-own-dimension',
    pass: !/RoomDefinition/.test(dimensionSource)
      && !/sceneByRoomCode/.test(dimensionSource)
      && !/readonly roomCode/.test(dimensionSource),
  },
  {
    id: 'standalone-world-route',
    pass: /DEFAULT_DIMENSION_ID = 'the-weight-of-remembering'/.test(dimensionAppSource)
      && /params\.get\('world'\)/.test(dimensionAppSource),
  },
  {
    id: 'entrance-contract',
    pass: /export interface DimensionEntrance/.test(dimensionSource)
      && /entrances: DimensionEntrance\[\]/.test(dimensionSource)
      && /static entrancesFor/.test(dimensionSource),
  },
  {
    id: 'entrance-clone-isolation',
    pass: /entrances: spec\.entrances\.map/.test(dimensionSource),
  },
  { id: 'seeded-artwork', pass: /the-weight-of-remembering\.webp/.test(dimensionSource) && seed.size > 10_000 },
  { id: 'layered-scene', pass: /layers: \[/.test(dimensionSource) && /SeedBackdrop/.test(sceneSource) },
  { id: 'interactive-anchors', pass: /anchors: \[/.test(dimensionSource) && /AnchorNode/.test(sceneSource) },
  { id: 'filament-paths', pass: /paths: \[/.test(dimensionSource) && /Filament/.test(sceneSource) },
  { id: 'portal-runtime', pass: /portals: \[/.test(dimensionSource) && /PortalRing/.test(sceneSource) },
  {
    id: 'portal-destination-binding',
    pass: /destination: 'parallel-remembrance'/.test(dimensionSource)
      && /returnPortalId: 'portal-horizon'/.test(dimensionSource),
  },
  {
    id: 'destination-contract',
    pass: /export interface DimensionDestination/.test(dimensionSource)
      && /destinations: DimensionDestination\[\]/.test(dimensionSource)
      && /id: 'parallel-remembrance'/.test(dimensionSource),
  },
  {
    id: 'destination-nodes',
    pass: /id: 'unwritten-archive'/.test(dimensionSource)
      && /id: 'echo-bridge'/.test(dimensionSource)
      && /id: 'unlived-garden'/.test(dimensionSource),
  },
  {
    id: 'destination-clone-isolation',
    pass: /destinations: spec\.destinations\.map/.test(dimensionSource)
      && /nodes: destination\.nodes\.map/.test(dimensionSource),
  },
  { id: 'dimension-route', pass: /DimensionApp/.test(appSource) && /dimension/.test(appSource) },
);

const failed = checks.filter((check) => !check.pass);
console.log(JSON.stringify({
  state: failed.length ? 'failed' : 'validated',
  dimensionId: 'the-weight-of-remembering',
  entranceIds: ['standalone-dimension-route', 'room-02-memory-threshold'],
  destinationId: 'parallel-remembrance',
  seedBytes: seed.size,
  checks,
}, null, 2));

if (failed.length) process.exit(1);

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
const appSource = await readFile('src/App.tsx', 'utf8');
const seed = await stat('public/reference/dimensions/the-weight-of-remembering.webp');

checks.push(
  { id: 'dimension-class', pass: /export class Dimension/.test(dimensionSource) },
  { id: 'room-code-constructor', pass: /constructor\(roomCode: string\)/.test(dimensionSource) },
  { id: 'room-code-registry', pass: /sceneByRoomCode/.test(dimensionSource) && /'02': rememberingSpec/.test(dimensionSource) },
  { id: 'seeded-artwork', pass: /the-weight-of-remembering\.webp/.test(dimensionSource) && seed.size > 10_000 },
  { id: 'layered-scene', pass: /layers: \[/.test(dimensionSource) && /SeedBackdrop/.test(sceneSource) },
  { id: 'interactive-anchors', pass: /anchors: \[/.test(dimensionSource) && /AnchorNode/.test(sceneSource) },
  { id: 'filament-paths', pass: /paths: \[/.test(dimensionSource) && /Filament/.test(sceneSource) },
  { id: 'portal-runtime', pass: /portals: \[/.test(dimensionSource) && /PortalRing/.test(sceneSource) },
  { id: 'dimension-route', pass: /DimensionApp/.test(appSource) && /dimension/.test(appSource) },
);

const failed = checks.filter((check) => !check.pass);
console.log(JSON.stringify({
  state: failed.length ? 'failed' : 'validated',
  roomCode: '02',
  dimensionId: 'the-weight-of-remembering',
  seedBytes: seed.size,
  checks,
}, null, 2));

if (failed.length) process.exit(1);

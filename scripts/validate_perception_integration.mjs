#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const requiredFiles = [
  'src/dimension/perception/contracts.ts',
  'src/dimension/perception/fixtures.ts',
  'src/dimension/perception/clients.ts',
  'src/dimension/perception/corrections.ts',
  'src/dimension/perception/compilerBridge.ts',
  'src/dimension/perception/PerceptionReviewApp.tsx',
  'src/dimension/perception/perception.css',
];

const failures = [];
const read = (file) => readFileSync(file, 'utf8');
for (const file of requiredFiles) {
  try { read(file); } catch { failures.push(`missing ${file}`); }
}

const contracts = read(requiredFiles[0]);
const fixtures = read(requiredFiles[1]);
const clients = read(requiredFiles[2]);
const corrections = read(requiredFiles[3]);
const bridge = read(requiredFiles[4]);
const app = read(requiredFiles[5]);
const router = read('src/App.tsx');

const assertions = [
  ['PerceptionBundleV2 contract', contracts.includes('interface PerceptionBundleV2')],
  ['provider-neutral client', contracts.includes('interface PerceptionClient')],
  ['fixture client', clients.includes('class FixturePerceptionClient')],
  ['HTTP client', clients.includes('class HttpPerceptionClient')],
  ['four validation fixtures', ['corridor', 'water-bridge', 'adjacent-towers', 'ambiguous-fantasy'].every((id) => fixtures.includes(id))],
  ['durable correction storage', corrections.includes('window.localStorage')],
  ['correction replay', corrections.includes('applyCorrections')],
  ['review route', router.includes("'/dimension/perception'") && router.includes('PerceptionReviewApp')],
  ['bundle import', app.includes('Import bundle') && app.includes('bundleIsValid')],
  ['evidence views', ['Depth', 'Normals', 'Instances', 'Walkability', 'Uncertainty'].every((label) => app.includes(label))],
  ['instance decisions', app.includes('Reject instance') && app.includes('Restore instance')],
  ['surface decisions', app.includes('set_walkability')],
  ['compiler bridge', bridge.includes('compilePerceptionBundle') && bridge.includes('generateWorldFabric')],
  ['play handoff', bridge.includes('saveWorldDraftForPlay') && bridge.includes('/dimension/play?source=perception')],
  ['uncertainty blocks entry fixture', fixtures.includes('connectedComponents: [], spawnCandidates: []')],
];

for (const [label, passed] of assertions) {
  if (!passed) failures.push(label);
}

if (failures.length > 0) {
  console.error('Perception integration validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Perception integration validation passed (${assertions.length} checks).`);

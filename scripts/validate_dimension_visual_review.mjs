#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const evidenceDirectory = path.resolve('validation', 'dimension-scene');
const contractPath = path.resolve('validation', 'design', 'dimension-visual-review.json');
const outputPath = path.join(evidenceDirectory, 'visual-review.json');

function pngDimensions(buffer) {
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a' || buffer.length < 24) {
    throw new Error('Invalid PNG signature.');
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

const contract = JSON.parse(await readFile(contractPath, 'utf8'));
const runtime = JSON.parse(await readFile(path.join(evidenceDirectory, 'runtime.json'), 'utf8'));
const authoringRuntime = JSON.parse(await readFile(path.join(evidenceDirectory, 'authoring-runtime.json'), 'utf8'));
const shots = [];
const checks = {
  runtimePassed: runtime.passed === true,
  authoringRuntimePassed: authoringRuntime.passed === true,
  expectedShotCount: contract.shots.length === 9,
  screenshotsValid: true,
  approvedBaselineUnchanged: true,
};

for (const shot of contract.shots) {
  const filePath = path.join(evidenceDirectory, shot.file);
  try {
    const [buffer, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
    const dimensions = pngDimensions(buffer);
    const fingerprint = createHash('sha256').update(buffer).digest('hex');
    const baselineFingerprint = contract.baseline.fingerprints[shot.id] ?? null;
    const comparison = baselineFingerprint
      ? baselineFingerprint === fingerprint ? 'unchanged' : 'changed'
      : 'candidate';
    const valid = fileStat.size >= contract.minimumPngBytes
      && dimensions.width === contract.viewport.width
      && dimensions.height === contract.viewport.height;

    if (!valid) checks.screenshotsValid = false;
    if (contract.baseline.state === 'approved' && comparison === 'changed') {
      checks.approvedBaselineUnchanged = false;
    }

    shots.push({
      ...shot,
      bytes: fileStat.size,
      width: dimensions.width,
      height: dimensions.height,
      fingerprint,
      baselineFingerprint,
      comparison,
      valid,
    });
  } catch (error) {
    checks.screenshotsValid = false;
    shots.push({
      ...shot,
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const passed = Object.values(checks).every(Boolean);
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  worldId: contract.worldId,
  baselineState: contract.baseline.state,
  state: passed ? 'validated' : 'failed',
  checks,
  shots,
};

await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!passed) process.exit(1);

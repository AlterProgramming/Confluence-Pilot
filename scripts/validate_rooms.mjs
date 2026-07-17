#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const jsonOutput = process.argv.includes('--json');

const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));

const criteria = readJson('validation/criteria.json');
const roomData = readJson('validation/rooms.json');
const registryPath = path.join(root, 'src/scenes/registry.ts');
const registrySource = fs.existsSync(registryPath) ? fs.readFileSync(registryPath, 'utf8') : '';

const expectedIds = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const allowedStatuses = new Set(['phase-1', 'candidate', 'validated', 'blocked']);
const errors = [];
const warnings = [];

function asRepoPath(value) {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('/assets/')) return path.join('public', value.slice(1));
  return value.replace(/^\.\//, '');
}

function existingFile(value) {
  const relative = asRepoPath(value);
  if (!relative) return false;
  try {
    return fs.statSync(path.join(root, relative)).isFile();
  } catch {
    return false;
  }
}

function readJsonEvidence(value) {
  const relative = asRepoPath(value);
  if (!relative || !existingFile(relative)) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
  } catch (error) {
    warnings.push(`Could not parse evidence JSON ${relative}: ${error.message}`);
    return null;
  }
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function nonEmptyArray(value, minimum = 1) {
  return Array.isArray(value) && value.filter(Boolean).length >= minimum;
}

function reviewDocsForRoom(id) {
  const reviewsDir = path.join(root, 'validation/reviews');
  if (!fs.existsSync(reviewsDir)) return [];
  return fs
    .readdirSync(reviewsDir)
    .filter((name) => name.startsWith(`room-${id}-`) && name.endsWith('.md'))
    .map((name) => `validation/reviews/${name}`);
}

function manualPass(check) {
  return Boolean(check?.passed === true && nonEmptyString(check?.notes));
}

function evidencePaths(room) {
  const roomId = room?.id || 'unknown';
  const evidenceRoot = room?.evidenceRoot || `validation/evidence/room-${roomId}`;
  const canonicalScreenshot = room?.canonicalScreenshot || `${evidenceRoot}/canonical.png`;
  const wideScreenshot = room?.wideScreenshot || canonicalScreenshot;
  const secondaryScreenshot = room?.secondaryScreenshot || `${evidenceRoot}/secondary.png`;
  const traversalEvidence = room?.transitionTest || `${evidenceRoot}/traversal.json`;
  const runtimeEvidence = room?.runtimeEvidence || `${evidenceRoot}/runtime.json`;
  const evidenceManifest = room?.evidenceManifest || `${evidenceRoot}/manifest.json`;
  return {
    evidenceRoot,
    canonicalScreenshot,
    wideScreenshot,
    secondaryScreenshot,
    traversalEvidence,
    runtimeEvidence,
    evidenceManifest,
  };
}

function assetResult(room, paths) {
  const assets = Array.isArray(room.signatureAssets) ? room.signatureAssets : [];
  const explicitInspections = Array.isArray(room.assetInspectionScreenshots)
    ? room.assetInspectionScreenshots.filter(Boolean)
    : [];
  const inspected = explicitInspections.length
    ? explicitInspections
    : assets.map((asset) => {
        const assetName = path.basename(asset || '', path.extname(asset || ''));
        return `${paths.evidenceRoot}/asset-${assetName}.png`;
      });
  const missing = [];
  const oversized = [];
  let totalBytes = 0;

  for (const asset of assets) {
    const relative = asRepoPath(asset);
    if (!relative || !existingFile(relative)) {
      missing.push(asset || '(empty asset path)');
      continue;
    }
    const bytes = fs.statSync(path.join(root, relative)).size;
    totalBytes += bytes;
    if (bytes > criteria.budgets.maxSingleAssetBytes) {
      oversized.push({ asset, bytes });
    }
  }

  return {
    pass:
      assets.length > 0 &&
      missing.length === 0 &&
      oversized.length === 0 &&
      totalBytes <= criteria.budgets.maxRoomAssetBytes &&
      inspected.length >= assets.length &&
      inspected.every(existingFile),
    assets,
    inspected,
    missing,
    oversized,
    totalBytes,
  };
}

function evaluateRoom(room) {
  const id = room?.id;
  const paths = evidencePaths(room || {});
  const asset = assetResult(room || {}, paths);
  const traversal = readJsonEvidence(paths.traversalEvidence);
  const runtime = readJsonEvidence(paths.runtimeEvidence);
  const generatedManifest = readJsonEvidence(paths.evidenceManifest);
  const registryKey = nonEmptyString(room?.registryKey) ? room.registryKey : id;
  const escapedRegistryKey = String(registryKey).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const registryPattern = new RegExp(`["']${escapedRegistryKey}["']\\s*:`);
  const runtimeConsoleErrors = Array.isArray(runtime?.consoleErrors) ? runtime.consoleErrors : [];
  const runtimePageErrors = Array.isArray(runtime?.pageErrors) ? runtime.pageErrors : [];

  const gates = {
    reference:
      existingFile(room?.referenceBoard) &&
      existingFile(paths.canonicalScreenshot) &&
      nonEmptyArray(room?.identityCues, 3),
    bespokeScene:
      existingFile(room?.sceneComponent) &&
      nonEmptyString(registryKey) &&
      registryPattern.test(registrySource),
    composition:
      manualPass(room?.manualChecks?.composition) &&
      existingFile(paths.wideScreenshot) &&
      existingFile(paths.secondaryScreenshot),
    materialsLighting: manualPass(room?.manualChecks?.materialsLighting),
    assetIntegrity: asset.pass,
    navigation: manualPass(room?.manualChecks?.navigation) || traversal?.passed === true,
    performance:
      manualPass(room?.manualChecks?.performance) &&
      Number.isFinite(runtime?.readyMilliseconds) &&
      runtime.readyMilliseconds <= criteria.budgets.targetReadyMilliseconds &&
      runtimeConsoleErrors.length === 0 &&
      runtimePageErrors.length === 0,
    contentSafety: manualPass(room?.manualChecks?.contentSafety),
    evidence:
      Array.isArray(room?.knownLimitations) &&
      room.knownLimitations.every(nonEmptyString) &&
      generatedManifest?.roomId === id,
  };

  const failedGates = criteria.candidateRequires.filter((gate) => !gates[gate]);
  const candidateReady = failedGates.length === 0;
  const reviewApproved =
    room?.humanReview?.decision === 'approved' &&
    nonEmptyString(room?.humanReview?.reviewer) &&
    nonEmptyString(room?.humanReview?.reviewedAt);

  return {
    id,
    title: room?.title || '',
    status: room?.status,
    gates,
    failedGates,
    candidateReady,
    reviewApproved,
    evidence: {
      ...paths,
      canonicalExists: existingFile(paths.canonicalScreenshot),
      secondaryExists: existingFile(paths.secondaryScreenshot),
      traversalPassed: traversal?.passed === true,
      runtimeReadyMilliseconds: runtime?.readyMilliseconds ?? null,
      generatedManifestPresent: generatedManifest?.roomId === id,
    },
    asset: {
      totalBytes: asset.totalBytes,
      missing: asset.missing,
      oversized: asset.oversized,
      inspectionEvidenceCount: asset.inspected.filter(existingFile).length,
      signatureAssetCount: asset.assets.length,
    },
  };
}

if (!Array.isArray(roomData.rooms)) {
  errors.push('validation/rooms.json must contain a rooms array.');
}

const rooms = Array.isArray(roomData.rooms) ? roomData.rooms : [];
const ids = rooms.map((room) => room?.id);
for (const id of expectedIds) {
  if (!ids.includes(id)) errors.push(`Missing validation manifest for Room ${id}.`);
}
for (const id of ids) {
  if (!expectedIds.includes(id)) warnings.push(`Unexpected room id in validation manifest: ${id}.`);
}
if (new Set(ids).size !== ids.length) errors.push('Room validation ids must be unique.');

const results = rooms.map(evaluateRoom);
for (let index = 0; index < results.length; index += 1) {
  const result = results[index];
  const room = rooms[index];
  if (!allowedStatuses.has(result.status)) {
    errors.push(`Room ${result.id}: invalid status "${result.status}".`);
  }
  if ((result.status === 'candidate' || result.status === 'validated') && !result.candidateReady) {
    errors.push(
      `Room ${result.id}: status is ${result.status}, but required gates fail: ${result.failedGates.join(', ')}.`,
    );
  }
  if (result.status === 'validated' && !result.reviewApproved) {
    errors.push(`Room ${result.id}: validated rooms require an approved human review record.`);
  }
  if (result.status === 'phase-1' && result.candidateReady) {
    warnings.push(`Room ${result.id}: all gates pass; promote it to candidate for review.`);
  }

  const reviewDocs = reviewDocsForRoom(result.id);
  if (reviewDocs.length > 0) {
    const latestReviewDoc = room?.latestReviewDoc;
    if (!nonEmptyString(latestReviewDoc)) {
      warnings.push(
        `Room ${result.id}: review docs exist (${reviewDocs.join(', ')}) but "latestReviewDoc" is not set in validation/rooms.json.`,
      );
    } else if (!existingFile(latestReviewDoc)) {
      warnings.push(`Room ${result.id}: "latestReviewDoc" (${latestReviewDoc}) does not exist.`);
    }
  }

  if (reviewDocs.length > 0 && room?.manualChecks?.performance?.passed === false) {
    const nextStep = room?.manualChecks?.performance?.followUp?.nextStep;
    if (!nonEmptyString(nextStep)) {
      warnings.push(
        `Room ${result.id}: performance gate is failing but manualChecks.performance.followUp.nextStep is empty.`,
      );
    }
  }
}

const report = {
  schemaVersion: criteria.schemaVersion,
  generatedAt: new Date().toISOString(),
  strict,
  summary: {
    total: results.length,
    phase1: results.filter((room) => room.status === 'phase-1').length,
    candidates: results.filter((room) => room.status === 'candidate').length,
    validated: results.filter((room) => room.status === 'validated').length,
    blocked: results.filter((room) => room.status === 'blocked').length,
    candidateReady: results.filter((room) => room.candidateReady).length,
  },
  errors,
  warnings,
  rooms: results,
};

if (jsonOutput) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  console.log('Confluence room validation');
  console.log('==========================');
  for (const room of results) {
    const ready = room.candidateReady ? 'READY' : `${room.failedGates.length} gates open`;
    console.log(`Room ${room.id}  ${String(room.status).padEnd(9)}  ${ready}`);
    if (!room.candidateReady) console.log(`  - ${room.failedGates.join(', ')}`);
    if (room.evidence.generatedManifestPresent) {
      console.log(
        `  evidence: capture present, traversal ${room.evidence.traversalPassed ? 'PASS' : 'FAIL'}, ` +
          `ready ${room.evidence.runtimeReadyMilliseconds ?? 'unknown'} ms`,
      );
    }
  }
  console.log('');
  console.log(
    `Summary: ${report.summary.validated} validated, ${report.summary.candidates} candidate, ` +
      `${report.summary.phase1} phase-1, ${report.summary.blocked} blocked, ` +
      `${report.summary.candidateReady} candidate-ready.`,
  );
  for (const warning of warnings) console.warn(`Warning: ${warning}`);
  for (const error of errors) console.error(`Error: ${error}`);
}

const strictFailure = strict && results.some((room) => !room.candidateReady);
process.exitCode = errors.length > 0 || strictFailure ? 1 : 0;

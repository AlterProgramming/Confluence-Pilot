#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  'src/dimension/compiler/contracts.ts',
  'src/dimension/compiler/analysis.ts',
  'src/dimension/compiler/synthesis.ts',
  'src/dimension/compiler/ImageWorldCompiler.ts',
  'src/dimension/compiler/ImageWorldCompilerApp.tsx',
  'src/dimension/compiler/WorldDraftOverlay.tsx',
  'src/dimension/compiler/WorldFabricPreview.tsx',
  'src/dimension/compiler/compiler.css',
  'validation/design/image-world-compiler.md',
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

const [contracts, analysis, synthesis, compiler, app, overlay, preview, route, plan] = await Promise.all([
  readFile('src/dimension/compiler/contracts.ts', 'utf8'),
  readFile('src/dimension/compiler/analysis.ts', 'utf8'),
  readFile('src/dimension/compiler/synthesis.ts', 'utf8'),
  readFile('src/dimension/compiler/ImageWorldCompiler.ts', 'utf8'),
  readFile('src/dimension/compiler/ImageWorldCompilerApp.tsx', 'utf8'),
  readFile('src/dimension/compiler/WorldDraftOverlay.tsx', 'utf8'),
  readFile('src/dimension/compiler/WorldFabricPreview.tsx', 'utf8'),
  readFile('src/App.tsx', 'utf8'),
  readFile('validation/design/image-world-compiler.md', 'utf8'),
]);

checks.push(
  {
    id: 'reviewable-draft-contract',
    pass: /interface ImageWorldDraft/.test(contracts)
      && /ProposalStatus/.test(contracts)
      && /compiledFabric: WorldFabricSpec/.test(contracts)
      && /ImageWorldDraftReview/.test(contracts),
  },
  {
    id: 'real-pixel-analysis',
    pass: /getImageData/.test(analysis)
      && /estimateHorizon/.test(analysis)
      && /segmentSemanticRegions/.test(analysis)
      && /detectFocalObjects/.test(analysis)
      && /inferTraversableRegions/.test(analysis),
  },
  {
    id: 'proposal-synthesis',
    pass: /proposeWorldStructure/.test(synthesis)
      && /AnchorProposal/.test(synthesis)
      && /RouteProposal/.test(synthesis)
      && /BiomeProposal/.test(synthesis)
      && /PortalProposal/.test(synthesis),
  },
  {
    id: 'stable-world-fabric-compilation',
    pass: /compileProposalsToFabric/.test(synthesis)
      && /GRID_RADIUS = 9/.test(synthesis)
      && /compiled-cell-/.test(synthesis)
      && /cellCount: cells.length/.test(synthesis)
      && /recompileDraft/.test(synthesis),
  },
  {
    id: 'compiler-orchestration',
    pass: /compileImageToWorldDraft/.test(compiler)
      && /normalizeImageSource/.test(compiler)
      && /proposeWorldStructure/.test(compiler)
      && /compileProposalsToFabric/.test(compiler),
  },
  {
    id: 'human-review-surface',
    pass: /type="file"/.test(app)
      && /accept-compiler-anchor/.test(app)
      && /reject-compiler-anchor/.test(app)
      && /Export world draft/.test(app)
      && /recompileDraft/.test(app),
  },
  {
    id: 'evidence-overlay',
    pass: /semanticRegions/.test(overlay)
      && /horizonConfidence/.test(overlay)
      && /focalObjects/.test(overlay)
      && /proposals\.routes/.test(overlay)
      && /proposals\.anchors/.test(overlay),
  },
  {
    id: 'interactive-3d-preview',
    pass: /instancedMesh/.test(preview)
      && /OrbitControls/.test(preview)
      && /FabricRoutes/.test(preview)
      && /FabricSettlements/.test(preview)
      && /data-world-cell-count/.test(preview),
  },
  {
    id: 'compiler-route',
    pass: /ImageWorldCompilerApp/.test(route)
      && /\/dimension\/compiler/.test(route)
      && /compilerMode/.test(route),
  },
  {
    id: 'implementation-plan',
    pass: /Product promise/.test(plan)
      && /V1 implementation/.test(plan)
      && /Validation/.test(plan)
      && /Next milestones/.test(plan),
  },
);

const failed = checks.filter((check) => !check.pass);
const report = {
  schemaVersion: 1,
  state: failed.length ? 'failed' : 'validated',
  route: '/dimension/compiler',
  expectedRuntime: {
    semanticRegionMinimum: 24,
    anchorMinimum: 3,
    routeMinimum: 1,
    stableCellCount: 361,
  },
  checks,
};

console.log(JSON.stringify(report, null, 2));
if (failed.length) process.exit(1);

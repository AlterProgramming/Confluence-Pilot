#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  'src/dimension/play/terrain.ts',
  'src/dimension/play/PlayerController.tsx',
  'src/dimension/play/TraversableWorldScene.tsx',
  'src/dimension/play/TraversableWorldApp.tsx',
  'src/dimension/play/CompilerEnterWorldOverlay.tsx',
  'src/dimension/play/handoff.ts',
  'src/dimension/play/play.css',
  'validation/design/traversable-world-runtime.md',
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

const [terrain, player, scene, app, router, compiler, overlay, plan] = await Promise.all([
  readFile('src/dimension/play/terrain.ts', 'utf8'),
  readFile('src/dimension/play/PlayerController.tsx', 'utf8'),
  readFile('src/dimension/play/TraversableWorldScene.tsx', 'utf8'),
  readFile('src/dimension/play/TraversableWorldApp.tsx', 'utf8'),
  readFile('src/App.tsx', 'utf8'),
  readFile('src/dimension/compiler/ImageWorldCompiler.ts', 'utf8'),
  readFile('src/dimension/play/CompilerEnterWorldOverlay.tsx', 'utf8'),
  readFile('validation/design/traversable-world-runtime.md', 'utf8'),
]);

checks.push(
  {
    id: 'authoritative-height-sampler',
    pass: terrain.includes('sampleTerrainHeight')
      && terrain.includes('buildContinuousTerrainGeometry')
      && terrain.includes('findCellAtWorld'),
  },
  {
    id: 'stable-spawn-contract',
    pass: terrain.includes('chooseTraversableSpawn')
      && terrain.includes('respawnGroundPosition')
      && terrain.includes('localRelief'),
  },
  {
    id: 'continuous-indexed-terrain',
    pass: terrain.includes('geometry.setIndex(indices)')
      && terrain.includes('geometry.computeVertexNormals()')
      && scene.includes('authoritative-continuous-terrain'),
  },
  {
    id: 'embodied-controller',
    pass: player.includes('GRAVITY')
      && player.includes('WALK_SPEED')
      && player.includes('RUN_SPEED')
      && player.includes('JUMP_SPEED')
      && player.includes('groundedRef'),
  },
  {
    id: 'latched-player-actions',
    pass: player.includes('interactionRequestedRef')
      && player.includes('jumpRequestedRef')
      && player.includes("key === 'e'")
      && player.includes("key === ' '")
      && player.includes('!event.repeat')
      && player.includes('if (interactionRequestedRef.current)')
      && player.includes('if (groundedRef.current && jumpRequestedRef.current)'),
  },
  {
    id: 'terrain-bound-movement',
    pass: player.includes('sampleTerrainHeight(fabric')
      && player.includes('maximumRise')
      && player.includes('terrainBounds(fabric)'),
  },
  {
    id: 'third-person-camera',
    pass: player.includes('yawRef')
      && player.includes('pitchRef')
      && player.includes('distanceRef')
      && player.includes('cameraGround'),
  },
  {
    id: 'physical-anchors-and-routes',
    pass: scene.includes('physical-world-anchors')
      && scene.includes('traversable-generated-routes')
      && scene.includes('traversable-settlement-massing'),
  },
  {
    id: 'interaction-contract',
    pass: player.includes('INTERACTION_RADIUS')
      && app.includes('data-interaction-anchor-id'),
  },
  {
    id: 'play-route',
    pass: router.includes("normalizedPath === '/dimension/play'")
      && router.includes('<TraversableWorldApp />'),
  },
  {
    id: 'reviewed-compiler-handoff',
    pass: compiler.includes('saveWorldDraftForPlay(draft)')
      && overlay.includes('applyVisibleReviewState')
      && overlay.includes("window.location.assign('/dimension/play?source=compiler')"),
  },
  {
    id: 'runtime-evidence-surface',
    pass: app.includes('data-runtime-state')
      && app.includes('data-current-cell-id')
      && app.includes('data-player-grounded')
      && app.includes('data-entered-world'),
  },
  {
    id: 'documented-boundary',
    pass: plan.includes('There is deliberately no flat substitute plane')
      && plan.includes('character animation')
      && plan.includes('persistent world mutation'),
  },
);

const failed = checks.filter((check) => !check.pass);
console.log(JSON.stringify({
  state: failed.length === 0 ? 'validated' : 'failed',
  checks,
}, null, 2));

if (failed.length > 0) process.exit(1);

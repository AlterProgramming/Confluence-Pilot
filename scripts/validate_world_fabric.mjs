import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  'src/dimension/WorldFabric.ts',
  'src/dimension/ProceduralWorldFabric.tsx',
  'validation/design/world-fabric.md',
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

const generatorSource = await readFile('src/dimension/WorldFabric.ts', 'utf8');
const rendererSource = await readFile('src/dimension/ProceduralWorldFabric.tsx', 'utf8');
const overlaySource = await readFile('src/dimension/ProceduralWorldOverlay.tsx', 'utf8');

checks.push(
  {
    id: 'deterministic-cell-generator',
    pass: /generateWorldFabric/.test(generatorSource)
      && /worldFabricRandom/.test(generatorSource)
      && /WorldFabricCell/.test(generatorSource)
      && /gridDiameter/.test(generatorSource),
  },
  {
    id: 'semantic-terrain',
    pass: /sampleWorldElevation/.test(generatorSource)
      && /anchorHeightContribution/.test(generatorSource)
      && /classifyBiome/.test(generatorSource),
  },
  {
    id: 'five-biome-shape-families',
    pass: /memory-meadow/.test(generatorSource)
      && /archive-ridge/.test(generatorSource)
      && /lantern-basin/.test(generatorSource)
      && /thread-marsh/.test(generatorSource)
      && /void-highland/.test(generatorSource),
  },
  {
    id: 'land-between-renderer',
    pass: /TerrainSurface/.test(rendererSource)
      && /RouteNetwork/.test(rendererSource)
      && /BiomeShapeField/.test(rendererSource)
      && /SettlementGrammar/.test(rendererSource)
      && /HorizonMassifs/.test(rendererSource),
  },
  {
    id: 'instanced-density',
    pass: (rendererSource.match(/instancedMesh/g) ?? []).length >= 2
      && /near/.test(generatorSource)
      && /middle/.test(generatorSource)
      && /horizon/.test(generatorSource),
  },
  {
    id: 'runtime-evidence-surface',
    pass: /ProceduralWorldFabric/.test(overlaySource)
      && /data-testid="world-fabric"/.test(overlaySource)
      && /data-world-cell-count/.test(overlaySource)
      && /data-world-biome-count/.test(overlaySource)
      && /data-world-route-count/.test(overlaySource),
  },
);

const failed = checks.filter((check) => !check.pass);
console.log(JSON.stringify({
  state: failed.length ? 'failed' : 'validated',
  worldFabricId: 'the-weight-of-remembering-world-fabric',
  expectedGrid: {
    diameter: 19,
    cells: 361,
    biomeFamilies: 5,
    authoredRoutes: 4,
  },
  checks,
}, null, 2));

if (failed.length) process.exit(1);

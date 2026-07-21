#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('assets', 'dimensions', 'procedural-source');
const catalogPath = path.join(root, 'catalog.json');
const schemaPath = path.join(root, 'asset.schema.json');
const generatorPath = path.resolve('tools', 'blender', 'generate_dimension_asset.py');
const outputDirectory = path.resolve('validation', 'dimension-assets');
const outputPath = path.join(outputDirectory, 'source-assets.json');

const requiredTopLevel = [
  'schemaVersion', 'id', 'title', 'realm', 'category', 'revision', 'description',
  'narrativeFunction', 'designKeywords', 'scale', 'orientation', 'silhouette',
  'materials', 'components', 'generation', 'topology', 'animation', 'lod',
  'collision', 'sockets', 'orthographicGuidance', 'validation',
];
const requiredSilhouette = ['primary', 'secondary', 'tertiary', 'negativeSpace', 'recognitionTest'];
const requiredOrthographic = ['front', 'side', 'top', 'threeQuarter', 'scaleCue'];
const requiredLods = ['LOD0', 'LOD1', 'LOD2'];
const requiredRealms = ['the-weight-of-remembering', 'parallel-remembrance'];
const allowedPrimitives = new Set([
  'box', 'cylinder', 'sphere', 'icosphere', 'torus', 'curve-tube',
  'plane', 'cone', 'custom-profile',
]);

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  state: 'failed',
  catalogId: null,
  assetCount: 0,
  realmCounts: {},
  runtimeSystems: [],
  assets: [],
  checks: {},
  errors: [],
};

function recordError(assetId, message) {
  report.errors.push(assetId ? `${assetId}: ${message}` : message);
}

function isDetailed(value, minimum = 60) {
  return typeof value === 'string' && value.trim().length >= minimum;
}

function validateVector(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

function validateAsset(asset, catalogEntry) {
  const errors = [];
  const add = (message) => errors.push(message);

  for (const key of requiredTopLevel) {
    if (!(key in asset)) add(`missing required field ${key}`);
  }

  if (asset.schemaVersion !== 1) add('schemaVersion must be 1');
  if (asset.id !== catalogEntry.id) add(`catalog id ${catalogEntry.id} does not match descriptor id ${asset.id}`);
  if (asset.realm !== catalogEntry.realm) add('realm does not match catalog binding');
  if (asset.category !== catalogEntry.category) add('category does not match catalog binding');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(asset.id ?? '')) add('id is not a semantic kebab-case identifier');
  if (!isDetailed(asset.description, 160)) add('description is not sufficiently detailed');
  if (!isDetailed(asset.narrativeFunction, 100)) add('narrativeFunction is not sufficiently detailed');
  if (!Array.isArray(asset.designKeywords) || asset.designKeywords.length < 6) add('at least six design keywords are required');

  const bounds = asset.scale?.bounds;
  if (asset.scale?.unit !== 'meter') add('scale.unit must be meter');
  if (!bounds || !['width', 'height', 'depth'].every((key) => Number.isFinite(bounds[key]) && bounds[key] > 0)) add('positive width, height, and depth bounds are required');
  if (asset.orientation?.upAxis !== '+Y') add('orientation.upAxis must be +Y');
  if (!validateVector(asset.orientation?.pivot)) add('orientation pivot must be a finite vector3');
  if (!isDetailed(asset.orientation?.originMeaning, 20)) add('originMeaning must describe the production pivot');

  for (const key of requiredSilhouette) {
    if (!isDetailed(asset.silhouette?.[key], 80)) add(`silhouette.${key} is not sufficiently descriptive`);
  }

  if (!Array.isArray(asset.materials) || asset.materials.length < 2) add('at least two material definitions are required');
  for (const material of asset.materials ?? []) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(material.baseColor ?? '')) add(`material ${material.id} has invalid baseColor`);
    if (!/^#[0-9A-Fa-f]{6}$/.test(material.emission?.color ?? '')) add(`material ${material.id} has invalid emission color`);
    if (![material.metallic, material.roughness].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) add(`material ${material.id} has invalid PBR values`);
    if (!isDetailed(material.surfaceDescription, 60)) add(`material ${material.id} lacks a detailed surface description`);
  }

  if (!Array.isArray(asset.components) || asset.components.length < 3) add('at least three geometric components are required');
  const componentIds = new Set();
  for (const component of asset.components ?? []) {
    if (componentIds.has(component.id)) add(`duplicate component id ${component.id}`);
    componentIds.add(component.id);
    if (!allowedPrimitives.has(component.primitive)) add(`unsupported primitive ${component.primitive}`);
    if (!isDetailed(component.detail, 60)) add(`component ${component.id} lacks modeling detail`);
    if (!validateVector(component.transform?.position) || !validateVector(component.transform?.rotation) || !validateVector(component.transform?.scale)) add(`component ${component.id} has invalid transform`);
    if (component.repeat && (!Number.isInteger(component.repeat.count) || component.repeat.count < 1)) add(`component ${component.id} has invalid repeat count`);
  }

  if (asset.generation?.deterministic !== true) add('generation must be deterministic');
  if (!Number.isInteger(asset.generation?.seed)) add('generation seed must be an integer');
  if (!Array.isArray(asset.generation?.assemblyOrder) || asset.generation.assemblyOrder.length < 3) add('assemblyOrder requires at least three stages');
  if (!Array.isArray(asset.generation?.deformationRules) || asset.generation.deformationRules.length < 2) add('at least two deformation rules are required');
  if (!Array.isArray(asset.generation?.variationRules) || asset.generation.variationRules.length < 2) add('at least two variation rules are required');

  for (const key of ['target', 'bevel', 'subdivision', 'normals', 'uv']) {
    if (!isDetailed(asset.topology?.[key], 30)) add(`topology.${key} is not sufficiently descriptive`);
  }

  if (!Array.isArray(asset.animation?.channels) || asset.animation.channels.length < 1) add('at least one animation channel is required');
  if (!Number.isFinite(asset.animation?.loopLengthSeconds) || asset.animation.loopLengthSeconds < 0) add('invalid animation loop length');
  if (!isDetailed(asset.animation?.motionCharacter, 60)) add('animation motionCharacter is not sufficiently detailed');

  const lodNames = (asset.lod ?? []).map((entry) => entry.name);
  if (!requiredLods.every((name) => lodNames.includes(name))) add('LOD0, LOD1, and LOD2 are required');
  for (const lod of asset.lod ?? []) {
    if (!Number.isInteger(lod.triangleBudget) || lod.triangleBudget < 12) add(`${lod.name} has invalid triangle budget`);
    if (!Array.isArray(lod.preserve) || lod.preserve.length < 3) add(`${lod.name} must declare preserved features`);
  }

  if (!isDetailed(asset.collision?.description, 40)) add('collision description is not sufficiently detailed');
  if (!Array.isArray(asset.sockets) || asset.sockets.length < 2) add('at least two named sockets are required');
  for (const socket of asset.sockets ?? []) {
    if (!validateVector(socket.position) || !validateVector(socket.rotation)) add(`socket ${socket.id} has invalid transform`);
  }

  for (const key of requiredOrthographic) {
    if (!isDetailed(asset.orthographicGuidance?.[key], key === 'scaleCue' ? 40 : 70)) add(`orthographicGuidance.${key} is not sufficiently descriptive`);
  }
  if (!Array.isArray(asset.validation) || asset.validation.length < 6) add('at least six asset validation rules are required');

  return {
    id: asset.id,
    realm: asset.realm,
    category: asset.category,
    runtimeSystem: catalogEntry.runtimeSystem,
    productionPriority: catalogEntry.productionPriority,
    materials: asset.materials?.length ?? 0,
    components: asset.components?.length ?? 0,
    sockets: asset.sockets?.length ?? 0,
    validationRules: asset.validation?.length ?? 0,
    estimatedDefaultInstances: catalogEntry.defaultInstances,
    passed: errors.length === 0,
    errors,
  };
}

try {
  await Promise.all([access(catalogPath), access(schemaPath), access(generatorPath)]);
  const [catalogText, schemaText, generatorSource, worldSource, destinationSource] = await Promise.all([
    readFile(catalogPath, 'utf8'),
    readFile(schemaPath, 'utf8'),
    readFile(generatorPath, 'utf8'),
    readFile('src/dimension/ProceduralWorldArchitecture.tsx', 'utf8'),
    readFile('src/dimension/ProceduralDestinationArchitecture.tsx', 'utf8'),
  ]);
  const catalog = JSON.parse(catalogText);
  JSON.parse(schemaText);
  report.catalogId = catalog.catalogId;
  report.assetCount = catalog.assets?.length ?? 0;

  const ids = new Set();
  const runtimeSystems = new Set();
  for (const entry of catalog.assets ?? []) {
    if (ids.has(entry.id)) recordError(entry.id, 'duplicate catalog id');
    ids.add(entry.id);
    runtimeSystems.add(entry.runtimeSystem);

    const descriptorPath = path.join(root, entry.path);
    try {
      const descriptor = JSON.parse(await readFile(descriptorPath, 'utf8'));
      const result = validateAsset(descriptor, entry);
      report.assets.push(result);
      for (const error of result.errors) recordError(entry.id, error);
    } catch (error) {
      recordError(entry.id, `unable to read descriptor: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  report.runtimeSystems = [...runtimeSystems].sort();
  report.realmCounts = Object.fromEntries(requiredRealms.map((realm) => [
    realm,
    report.assets.filter((asset) => asset.realm === realm).length,
  ]));

  const runtimeBindingChecks = (catalog.assets ?? []).map((entry) => {
    const source = entry.realm === 'the-weight-of-remembering' ? worldSource : destinationSource;
    return { id: entry.id, runtimeSystem: entry.runtimeSystem, pass: source.includes(entry.runtimeSystem) };
  });
  for (const binding of runtimeBindingChecks.filter((binding) => !binding.pass)) {
    recordError(binding.id, `runtime system ${binding.runtimeSystem} is not bound in source`);
  }

  report.checks = {
    catalogIdentity: catalog.schemaVersion === 1 && catalog.catalogId === 'confluence-dimension-procedural-source-assets',
    assetCount: report.assetCount === 12,
    sixAssetsPerRealm: requiredRealms.every((realm) => report.realmCounts[realm] === 6),
    uniqueIds: ids.size === report.assetCount,
    allAssetsPass: report.assets.length === 12 && report.assets.every((asset) => asset.passed),
    allRuntimeSystemsBound: runtimeBindingChecks.every((binding) => binding.pass),
    blenderGeneratorReadsCatalog: /--catalog/.test(generatorSource)
      && /create_asset/.test(generatorSource)
      && /(save_blend|export_output)/.test(generatorSource),
    schemaPresent: schemaText.includes('Dimension Procedural Source Asset'),
  };

  for (const [id, passed] of Object.entries(report.checks)) {
    if (!passed) recordError(null, `catalog check failed: ${id}`);
  }
  report.state = report.errors.length === 0 ? 'validated' : 'failed';
} catch (error) {
  recordError(null, error instanceof Error ? error.stack ?? error.message : String(error));
}

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
if (report.state !== 'validated') process.exit(1);

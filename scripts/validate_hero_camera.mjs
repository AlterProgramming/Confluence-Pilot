#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const contract = JSON.parse(fs.readFileSync(path.join(root, 'validation/hero-camera.json'), 'utf8'));
const roomsSource = fs.readFileSync(path.join(root, 'src/data/rooms.ts'), 'utf8');
const roomSource = fs.readFileSync(path.join(root, 'src/components/Room.tsx'), 'utf8');
const roomAssetSource = fs.readFileSync(path.join(root, 'src/components/RoomAsset.tsx'), 'utf8');
const roomStackSource = fs.readFileSync(path.join(root, 'src/components/RoomStack.tsx'), 'utf8');
const wallSource = fs.readFileSync(path.join(root, 'src/scenes/kit/LedWall.tsx'), 'utf8');
const cameraSource = fs.readFileSync(path.join(root, 'src/scenes/kit/HeroCameraWall.tsx'), 'utf8');
const registrySource = fs.readFileSync(path.join(root, 'src/components/heroCameraRegistry.ts'), 'utf8');
const errors = [];

function readGlbJson(assetUrl) {
  const filePath = path.join(root, 'public', assetUrl.replace(/^\//, ''));
  if (!fs.existsSync(filePath)) {
    errors.push(`Missing generated hero asset: ${assetUrl}`);
    return null;
  }

  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'glTF') {
    errors.push(`Not a binary glTF asset: ${assetUrl}`);
    return null;
  }

  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.readUInt32LE(16);
  if (jsonType !== 0x4e4f534a) {
    errors.push(`First GLB chunk is not JSON: ${assetUrl}`);
    return null;
  }

  const jsonText = buffer.subarray(20, 20 + jsonLength).toString('utf8').replace(/[\u0000 ]+$/g, '');
  return JSON.parse(jsonText);
}

for (const [roomId, rule] of Object.entries(contract.sourceHeroes)) {
  if (!roomsSource.includes(`assetUrl: '${rule.asset}'`)) {
    errors.push(`Room ${roomId} does not use ${rule.asset}.`);
  }

  const gltf = readGlbJson(rule.asset);
  if (!gltf) continue;
  const rootNode = gltf.nodes?.find((node) => node.name === rule.expectedRoot);
  if (!rootNode) {
    errors.push(`Room ${roomId} GLB is missing root node ${rule.expectedRoot}.`);
    continue;
  }
  if (rootNode.extras?.heroPresentation !== rule.expectedPresentation || rootNode.extras?.authored !== true) {
    errors.push(`Room ${roomId} GLB is missing its authored single-hero marker.`);
  }
  const sceneRootCount = gltf.scenes?.[gltf.scene ?? 0]?.nodes?.length ?? 0;
  if (sceneRootCount !== 1) {
    errors.push(`Room ${roomId} GLB must expose exactly one scene root; found ${sceneRootCount}.`);
  }
}

for (const roomId of contract.heroCameraRooms) {
  if (!roomSource.includes(`'${roomId}': {`)) {
    errors.push(`Room ${roomId} is missing a HeroCameraWall layout.`);
  }
}
if (!roomSource.includes('<HeroCameraWall')) {
  errors.push('Rooms do not mount the synchronized HeroCameraWall.');
}
if (!roomAssetSource.includes('registerHeroCameraTarget') || !roomAssetSource.includes('enableHeroCameraLayer')) {
  errors.push('RoomAsset does not register the live source hero with the camera pipeline.');
}

for (const [roomId, layer] of Object.entries(contract.cameraContract.trackingLayers)) {
  if (!registrySource.includes(`'${roomId}': ${layer}`)) {
    errors.push(`Room ${roomId} must use isolated hero-camera layer ${layer}.`);
  }
}
for (const phase of contract.cameraContract.phases) {
  if (!cameraSource.includes(`'${phase}'`)) {
    errors.push(`Hero camera implementation is missing the ${phase} phase.`);
  }
}
if (!cameraSource.includes('shortestAngle') || !cameraSource.includes('TRACKING_RESPONSE')) {
  errors.push('Hero camera is missing angular synchronization logic.');
}
if (!cameraSource.includes('renderTarget.setSize') || !cameraSource.includes('PROFILES')) {
  errors.push('Hero camera is missing progressive resolution control.');
}
if (!cameraSource.includes('captureCamera.layers.set(target.layer)')) {
  errors.push('Hero camera does not switch to the room-specific source layer.');
}
if (!cameraSource.includes('gl.getViewport(savedViewport)') || !cameraSource.includes('gl.setViewport(savedViewport.x')) {
  errors.push('Hero camera does not restore renderer viewport state.');
}
if (!cameraSource.includes('gl.getScissor(savedScissor)') || !cameraSource.includes('gl.setScissor(savedScissor.x')) {
  errors.push('Hero camera does not restore renderer scissor state.');
}
if (!cameraSource.includes('window.__CONFLUENCE_HERO_CAMERA__')) {
  errors.push('Hero camera does not expose runtime synchronization evidence.');
}

for (const asset of contract.suppressedWallAssets) {
  if (!wallSource.includes(`'${asset}'`)) {
    errors.push(`LedWall does not suppress obsolete wall asset ${asset}.`);
  }
}
if (!wallSource.includes('HERO_CAMERA_WALL_URLS.has(props.url)')) {
  errors.push('LedWall does not route hero-camera rooms away from static image rendering.');
}
if (!roomStackSource.includes("HERO_CAMERA_WALL_ROOMS = new Set(['02', '04', '06'])")) {
  errors.push('RoomStack does not exclude hero-camera wall textures from preload.');
}

if (errors.length) {
  for (const error of errors) console.error(`Hero camera: ${error}`);
  process.exitCode = 1;
} else {
  console.log('Hero camera validation PASS');
  console.log('  one live source hero per room');
  console.log('  isolated camera layers 7 / 8 / 9');
  console.log('  acquiring -> tracking -> locked progression');
  console.log('  angular counter-tracking with progressive resolution');
  console.log('  obsolete wall representations suppressed');
  console.log('  renderer viewport and scissor state restored');
}

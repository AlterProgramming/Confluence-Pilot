import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

class NodeFileReader {
  result = null;
  onloadend = null;
  onerror = null;

  async readAsArrayBuffer(blob) {
    try {
      this.result = await blob.arrayBuffer();
      this.onloadend?.();
    } catch (error) {
      this.onerror?.(error);
    }
  }

  async readAsDataURL(blob) {
    try {
      const buffer = Buffer.from(await blob.arrayBuffer());
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${buffer.toString('base64')}`;
      this.onloadend?.();
    } catch (error) {
      this.onerror?.(error);
    }
  }
}

globalThis.FileReader ??= NodeFileReader;

const outputDirectory = path.resolve('public', 'assets');
const exporter = new GLTFExporter();

function material(color, metalness, roughness, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity });
}

function object(geometry, surface, name, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  return mesh;
}

function credentialTerminal() {
  const root = new THREE.Group();
  root.name = 'room_02_single_credential_terminal';
  root.userData = { heroPresentation: 'single', authored: true };

  const shell = material(0x4a3a35, 0.42, 0.34);
  const accent = material(0xff7139, 0.34, 0.28, 0xff4a20, 0.22);
  const display = material(0xffd7a8, 0.12, 0.3, 0xff7a32, 0.62);
  const dark = material(0x17191e, 0.52, 0.38);
  const cardSurface = material(0xf2e5d3, 0.08, 0.48);

  const base = new THREE.CylinderGeometry(1.55, 1.72, 0.28, 32);
  const pedestal = new THREE.CylinderGeometry(0.52, 0.7, 0.72, 24);
  const body = new RoundedBoxGeometry(2.75, 1.75, 0.92, 3, 0.14);
  const screen = new RoundedBoxGeometry(2.25, 1.12, 0.08, 2, 0.04);
  const strip = new RoundedBoxGeometry(2.35, 0.09, 0.1, 2, 0.025);
  const card = new RoundedBoxGeometry(0.68, 0.42, 0.08, 2, 0.035);
  const ring = new THREE.TorusGeometry(1.3, 0.045, 8, 40);

  root.add(object(base, dark, 'grounded_base', [0, -0.9, 0]));
  root.add(object(pedestal, shell, 'connected_pedestal', [0, -0.48, 0]));
  root.add(object(body, shell, 'single_terminal_body', [0, 0.72, 0]));
  root.add(object(screen, display, 'front_display', [0, 0.82, 0.49]));
  root.add(object(strip, accent, 'top_status_strip', [0, 1.52, 0.48]));
  for (const [index, x] of [-0.72, 0, 0.72].entries()) {
    root.add(object(card, cardSurface, `credential_card_${index + 1}`, [x, 0.75, 0.55], [0, 0, (index - 1) * 0.05]));
  }
  root.add(object(ring, accent, 'base_status_ring', [0, -0.74, 0], [Math.PI / 2, 0, 0]));
  return root;
}

function surveyRover() {
  const root = new THREE.Group();
  root.name = 'room_06_single_survey_rover';
  root.userData = { heroPresentation: 'single', authored: true };

  const bodySurface = material(0xd8dce0, 0.36, 0.4);
  const dark = material(0x252a30, 0.5, 0.52);
  const accent = material(0xe8a62b, 0.32, 0.32, 0xe88716, 0.26);
  const glass = material(0x24333c, 0.5, 0.22, 0x4b91a8, 0.14);

  const chassis = new RoundedBoxGeometry(2.9, 0.72, 1.65, 3, 0.14);
  const cabin = new RoundedBoxGeometry(1.55, 0.82, 1.18, 3, 0.12);
  const bay = new RoundedBoxGeometry(0.92, 0.28, 1.28, 2, 0.07);
  const bumper = new RoundedBoxGeometry(0.25, 0.26, 1.5, 2, 0.05);
  const wheel = new THREE.CylinderGeometry(0.46, 0.46, 0.34, 20);
  const hub = new THREE.CylinderGeometry(0.22, 0.22, 0.36, 18);
  const mast = new THREE.CylinderGeometry(0.09, 0.13, 0.72, 14);
  const sensorHead = new RoundedBoxGeometry(0.5, 0.3, 0.3, 2, 0.05);
  const lens = new THREE.SphereGeometry(0.1, 14, 8);
  const ring = new THREE.TorusGeometry(1.75, 0.04, 8, 48);

  root.add(object(chassis, dark, 'single_chassis', [0, 0.15, 0]));
  root.add(object(cabin, bodySurface, 'single_cabin', [0.2, 0.86, -0.02]));
  root.add(object(bay, accent, 'equipment_bay', [-0.94, 0.58, 0]));
  root.add(object(bumper, dark, 'front_bumper', [1.55, 0.02, 0]));
  for (const x of [-1.08, 1.08]) {
    for (const z of [-0.83, 0.83]) {
      root.add(object(wheel, dark, `wheel_${x}_${z}`, [x, -0.27, z], [0, 0, Math.PI / 2]));
      root.add(object(hub, accent, `hub_${x}_${z}`, [x, -0.27, z], [0, 0, Math.PI / 2]));
    }
  }
  root.add(object(mast, dark, 'sensor_mast', [0.35, 1.52, 0]));
  root.add(object(sensorHead, accent, 'sensor_head', [0.35, 1.88, 0]));
  root.add(object(lens, glass, 'sensor_lens', [0.35, 1.88, 0.18]));
  root.add(object(ring, accent, 'rover_stage_ring', [0, -0.76, 0], [Math.PI / 2, 0, 0]));
  return root;
}

async function exportHero(name, scene) {
  scene.updateMatrixWorld(true);
  const arrayBuffer = await exporter.parseAsync(scene, { binary: true, onlyVisible: true });
  const destination = path.join(outputDirectory, name);
  await writeFile(destination, Buffer.from(arrayBuffer));
  console.log(`Generated ${path.relative(process.cwd(), destination)} (${arrayBuffer.byteLength} bytes)`);
}

await mkdir(outputDirectory, { recursive: true });
await exportHero('room-02-semantic.glb', credentialTerminal());
await exportHero('room-06-semantic.glb', surveyRover());

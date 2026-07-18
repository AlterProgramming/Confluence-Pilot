#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4173';
const rooms = [
  [2, '/assets/room-02-credential-stack.glb'],
  [3, '/assets/room-03-fabricator.glb'],
  [4, '/assets/room-04-building-node.glb'],
  [5, '/assets/room-05-hero.glb'],
  [6, '/assets/room-06-hero.glb'],
  [7, '/assets/room-07-hero.glb'],
  [8, '/assets/room-08-hero.glb'],
  [9, '/assets/room-09-hero.glb'],
  [10, '/assets/room-10-hero.glb'],
  [11, '/assets/room-11-hero.glb'],
  [12, '/assets/room-12-hero.glb'],
];

let failed = false;
for (const [roomNumber, assetUrl] of rooms) {
  console.log(`\n=== Capturing Room ${String(roomNumber).padStart(2, '0')} ===`);
  const result = spawnSync(
    process.execPath,
    ['scripts/capture_room_evidence.mjs', baseUrl, String(roomNumber), assetUrl],
    { stdio: 'inherit', env: process.env },
  );
  if (result.status !== 0) failed = true;
}

process.exitCode = failed ? 1 : 0;

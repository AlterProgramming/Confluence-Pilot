#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer-core';

const BASE_URL = process.argv[2] || 'http://127.0.0.1:4173';
const outputDirectory = path.resolve('validation', 'hero-camera');
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const rooms = [
  { number: 2, id: '02', layer: 7 },
  { number: 4, id: '04', layer: 8 },
  { number: 6, id: '06', layer: 9 },
];

function findChrome() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const candidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  return candidates.find(existsSync);
}

mkdirSync(outputDirectory, { recursive: true });
const executablePath = findChrome();
if (!executablePath) throw new Error('No Chrome or Chromium executable found for hero-camera validation.');

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
  ],
});

const results = [];
let failed = false;

try {
  for (const room of rooms) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.evaluateOnNewDocument(() => {
      const history = [];
      let latest;
      Object.defineProperty(window, '__CONFLUENCE_HERO_CAMERA__', {
        configurable: true,
        get: () => latest,
        set: (value) => {
          latest = value;
          history.push({ capturedAt: performance.now(), ...value });
        },
      });
      window.__CONFLUENCE_HERO_CAMERA_HISTORY__ = history;
    });

    const query = new URLSearchParams({
      capture: '1',
      validate: '1',
      room: String(room.number),
      quality: 'balanced',
      motion: 'full',
    });
    await page.goto(`${BASE_URL}/?${query}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForFunction(
      (expectedId) => {
        const validation = window.__CONFLUENCE_VALIDATION__;
        return Boolean(validation?.started && validation.activeRoomId === expectedId && !validation.isTransitioning);
      },
      { timeout: 90_000 },
      room.id,
    );

    const phaseScreenshots = new Set();
    const deadline = Date.now() + 25_000;
    let locked = null;
    while (Date.now() < deadline) {
      const snapshot = await page.evaluate(() => window.__CONFLUENCE_HERO_CAMERA__ ?? null);
      if (snapshot && snapshot.roomId === room.id && !phaseScreenshots.has(snapshot.phase)) {
        phaseScreenshots.add(snapshot.phase);
        await page.screenshot({
          path: path.join(outputDirectory, `room-${room.id}-${snapshot.phase}.png`),
          captureBeyondViewport: false,
        });
      }
      if (
        snapshot?.roomId === room.id
        && snapshot.phase === 'locked'
        && snapshot.angularErrorDegrees <= 2.2
        && snapshot.resolution?.[0] >= 512
        && snapshot.framesRendered >= 5
      ) {
        locked = snapshot;
        break;
      }
      await delay(40);
    }

    const history = await page.evaluate(() => window.__CONFLUENCE_HERO_CAMERA_HISTORY__ ?? []);
    const phases = [...new Set(history.filter((item) => item.roomId === room.id).map((item) => item.phase))];
    const resolutions = [...new Set(
      history
        .filter((item) => item.roomId === room.id)
        .map((item) => `${item.resolution?.[0]}x${item.resolution?.[1]}`),
    )];
    const roomHistory = history.filter((item) => item.roomId === room.id);
    const first = roomHistory[0] ?? null;
    const last = roomHistory.at(-1) ?? null;
    const passed = Boolean(
      locked
      && phases.includes('acquiring')
      && phases.includes('tracking')
      && phases.includes('locked')
      && resolutions.includes('192x108')
      && resolutions.includes('384x216')
      && resolutions.includes('512x288')
      && locked.captureLayer === room.layer
      && first?.angularErrorDegrees > locked.angularErrorDegrees
      && consoleErrors.length === 0
      && pageErrors.length === 0
    );

    results.push({
      roomId: room.id,
      expectedLayer: room.layer,
      passed,
      phases,
      resolutions,
      first,
      locked,
      last,
      samples: roomHistory.length,
      consoleErrors,
      pageErrors,
    });
    if (!passed) failed = true;
    await page.close();
  }
} finally {
  await browser.close();
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  qualityTier: 'balanced',
  expectedProgression: ['192x108', '384x216', '512x288'],
  rooms: results,
  passed: !failed,
};
writeFileSync(path.join(outputDirectory, 'runtime.json'), `${JSON.stringify(report, null, 2)}\n`);

for (const result of results) {
  console.log(
    `Room ${result.roomId}: ${result.passed ? 'PASS' : 'FAIL'} | `
    + `${result.phases.join(' -> ')} | ${result.resolutions.join(' -> ')} | `
    + `layer ${result.locked?.captureLayer ?? 'missing'} | error ${result.locked?.angularErrorDegrees ?? 'missing'}°`,
  );
}
if (failed) process.exitCode = 1;

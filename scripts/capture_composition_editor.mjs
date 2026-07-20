#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer-core';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4178';
const outputDirectory = path.resolve('validation', 'composition-editor');
mkdirSync(outputDirectory, { recursive: true });

const chromeCandidates = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const executablePath = chromeCandidates.find((candidate) => existsSync(candidate));
if (!executablePath) throw new Error('No Chrome or Chromium executable found.');

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

const report = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  passed: false,
  screenshots: [],
  states: [],
  checks: {},
  consoleErrors: [],
  pageErrors: [],
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => localStorage.clear());
  await page.setViewport({ width: 1760, height: 1040, deviceScaleFactor: 1 });
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => report.pageErrors.push(error.message));

  const state = () => page.evaluate(() => window.__CONFLUENCE_EDITOR__);
  const selectInstance = async (id) => {
    await page.click(`[data-instance-id="${id}"] .outliner-select`);
    await page.waitForFunction((expected) => window.__CONFLUENCE_EDITOR__?.selectedId === expected, {}, id);
  };
  const setAxis = async (kind, axis, value) => {
    const selector = `input[data-transform-kind="${kind}"][data-axis="${axis}"]`;
    await page.click(selector, { clickCount: 3 });
    await page.keyboard.press('Control+A');
    await page.type(selector, String(value));
    await page.keyboard.press('Tab');
    await delay(150);
  };
  const composeInstance = async (id, values) => {
    await selectInstance(id);
    if (values.x !== undefined) await setAxis('position', 0, values.x);
    if (values.y !== undefined) await setAxis('position', 1, values.y);
    if (values.z !== undefined) await setAxis('position', 2, values.z);
    if (values.rotationY !== undefined) await setAxis('rotation', 1, values.rotationY);
  };
  const writeScreenshot = async (name, element = null) => {
    const destination = path.join(outputDirectory, name);
    if (element) await element.screenshot({ path: destination });
    else await page.screenshot({ path: destination, captureBeyondViewport: false });
    report.screenshots.push(name);
  };

  await page.goto(`${baseUrl}/?editor=1&capture=1&scene=room-02`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(
    () => window.__CONFLUENCE_EDITOR__?.ready === true && window.__CONFLUENCE_EDITOR__?.sceneId === 'room-02',
    { timeout: 90_000 },
  );
  await page.waitForSelector('[data-testid="composition-viewport"] canvas', { timeout: 90_000 });
  await delay(4200);

  const initialState = await state();
  report.states.push({ name: 'room-02-initial', value: initialState });
  await writeScreenshot('room-02-editor-before.png');
  const viewport = await page.$('[data-testid="composition-viewport"]');
  await writeScreenshot('room-02-viewport-before.png', viewport);

  await selectInstance('room-02-credential-stack');
  await setAxis('position', 0, 99);
  await page.waitForFunction(
    () => window.__CONFLUENCE_EDITOR__?.boundaryClampCount >= 1,
    { timeout: 20_000 },
  );
  const clampedState = await state();
  report.states.push({ name: 'boundary-clamped', value: clampedState });
  await writeScreenshot('room-02-boundary-clamp.png');

  await composeInstance('room-02-credential-stack', { x: 5.55, z: -4.55, rotationY: -90 });
  await composeInstance('room-02-coaching-table', { x: -4.2, z: 2.75, rotationY: 30 });
  await composeInstance('room-02-hero', { x: 0, z: -0.65, rotationY: 30 });
  await composeInstance('room-02-bench-front-left', { x: -3.25, z: 3.25, rotationY: 165 });
  await composeInstance('room-02-bench-front-right', { x: 3.25, z: 3.25, rotationY: 195 });
  await page.click('[data-tool="rotate"]');
  await page.waitForFunction(() => window.__CONFLUENCE_EDITOR__?.transformMode === 'rotate', { timeout: 20_000 });
  await page.click('[data-testid="save-composition"]');
  await page.waitForFunction(() => window.__CONFLUENCE_EDITOR__?.dirty === false, { timeout: 20_000 });
  await delay(1800);

  const composedState = await state();
  report.states.push({ name: 'room-02-composed', value: composedState });
  await writeScreenshot('room-02-editor-after.png');
  await writeScreenshot('room-02-viewport-after.png', viewport);

  const find = (snapshot, id) => snapshot.instances.find((instance) => instance.id === id);
  const clampedCredential = find(clampedState, 'room-02-credential-stack');
  const finalCredential = find(composedState, 'room-02-credential-stack');
  const finalTable = find(composedState, 'room-02-coaching-table');
  const finalHero = find(composedState, 'room-02-hero');
  report.checks = {
    exactRoomDimensions: JSON.stringify(initialState?.dimensions) === JSON.stringify([15.2, 13.8, 5.7]),
    initialObjectsLoaded: initialState?.instanceCount === 9,
    outOfBoundsAttemptClamped: Boolean(clampedCredential?.transform?.position?.[0] < 7.6 && clampedState?.boundaryClampCount >= 1),
    credentialRecomposed: Boolean(Math.abs(finalCredential?.transform?.position?.[0] - 5.55) < 0.02 && Math.abs(finalCredential?.transform?.position?.[2] + 4.55) < 0.02),
    coachingTableRecomposed: Boolean(Math.abs(finalTable?.transform?.position?.[0] + 4.2) < 0.02 && Math.abs(finalTable?.transform?.position?.[2] - 2.75) < 0.02),
    heroReoriented: Boolean(Math.abs(finalHero?.transform?.rotation?.[1] - Math.PI / 6) < 0.02),
    saved: composedState?.dirty === false,
  };
  report.passed = Object.values(report.checks).every(Boolean)
    && report.consoleErrors.length === 0
    && report.pageErrors.length === 0;
} finally {
  await browser.close();
  writeFileSync(path.join(outputDirectory, 'runtime.json'), `${JSON.stringify(report, null, 2)}\n`);
}

if (!report.passed) process.exitCode = 1;

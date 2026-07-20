#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer-core';

const BASE_URL = process.argv[2] || 'http://127.0.0.1:4173';
const parsedRoomNumber = Number.parseInt(process.argv[3] || '1', 10);
const roomNumber = Math.max(1, Math.min(12, Number.isFinite(parsedRoomNumber) ? parsedRoomNumber : 1));
const roomId = String(roomNumber).padStart(2, '0');
const assetUrl = process.argv[4] || `/assets/room-${roomId}-asset.glb`;
const evidenceDir = path.resolve('validation', 'evidence', `room-${roomId}`);
const viewport = { width: 1440, height: 900, deviceScaleFactor: 1 };
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

mkdirSync(evidenceDir, { recursive: true });

function findChrome() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate));
}

function attachDiagnostics(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    failedRequests.push(`${request.method()} ${request.url()} — ${failure?.errorText || 'failed'}`);
  });

  return { consoleErrors, pageErrors, failedRequests };
}

async function openRoomPage(browser, view = 'canonical') {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  const diagnostics = attachDiagnostics(page);
  const query = new URLSearchParams({
    capture: '1',
    validate: '1',
    room: String(roomNumber),
    quality: 'balanced',
    view,
  });
  const startedAt = Date.now();
  await page.goto(`${BASE_URL}/?${query}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForSelector('canvas', { timeout: 90_000 });
  await page.waitForFunction(
    (expectedRoomId) => {
      const state = window.__CONFLUENCE_VALIDATION__;
      return Boolean(state?.ready && state.activeRoomId === expectedRoomId);
    },
    { timeout: 90_000 },
    roomId,
  );
  await delay(800);
  const readyMilliseconds = Date.now() - startedAt;
  const state = await page.evaluate(() => {
    const current = window.__CONFLUENCE_VALIDATION__;
    if (!current) return null;
    return {
      version: current.version,
      ready: current.ready,
      started: current.started,
      activeRoomIndex: current.activeRoomIndex,
      activeRoomId: current.activeRoomId,
      requestedRoomIndex: current.requestedRoomIndex,
      requestedRoomId: current.requestedRoomId,
      isTransitioning: current.isTransitioning,
      transitionProgress: current.transitionProgress,
      assetsLoading: current.assetsLoading,
      assetProgress: current.assetProgress,
      qualityTier: current.qualityTier,
    };
  });
  return { page, diagnostics, readyMilliseconds, state };
}

async function captureScene(browser, view, filename) {
  const result = await openRoomPage(browser, view);
  try {
    await result.page.addStyleTag({ content: '.hud { visibility: hidden !important; }' });
    await delay(100);
    await result.page.screenshot({ path: path.join(evidenceDir, filename), captureBeyondViewport: false });
    return {
      readyMilliseconds: result.readyMilliseconds,
      state: result.state,
      diagnostics: result.diagnostics,
    };
  } finally {
    await result.page.close();
  }
}

async function captureAssetInspection(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 800, deviceScaleFactor: 1 });
  const diagnostics = attachDiagnostics(page);
  const url = `${BASE_URL}/_glbviewer.html?src=${encodeURIComponent(assetUrl)}`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForFunction(() => window.__ready === true, { timeout: 90_000 });
    await delay(500);
    const viewerError = await page.evaluate(() => window.__err || null);
    const assetName = path.basename(assetUrl, path.extname(assetUrl));
    const screenshot = `asset-${assetName}.png`;
    await page.screenshot({ path: path.join(evidenceDir, screenshot), captureBeyondViewport: false });
    return { assetUrl, screenshot, viewerError, diagnostics, passed: !viewerError && diagnostics.pageErrors.length === 0 };
  } finally {
    await page.close();
  }
}

async function waitForRoom(page, expectedRoomId) {
  await page.waitForFunction(
    (id) => window.__CONFLUENCE_VALIDATION__?.ready && window.__CONFLUENCE_VALIDATION__.activeRoomId === id,
    { timeout: 30_000 },
    expectedRoomId,
  );
  return page.evaluate(() => ({
    activeRoomId: window.__CONFLUENCE_VALIDATION__?.activeRoomId,
    isTransitioning: window.__CONFLUENCE_VALIDATION__?.isTransitioning,
  }));
}

async function captureTraversal(browser) {
  const { page, diagnostics, state: entryState } = await openRoomPage(browser, 'canonical');
  try {
    const previousDisabled = await page.$eval(
      'button[aria-label="Move down to previous room"]',
      (element) => element.disabled,
    );
    const nextDisabled = await page.$eval(
      'button[aria-label="Move up to next room"]',
      (element) => element.disabled,
    );

    const sequence = [roomId];
    const moves = [];
    let passed = entryState?.activeRoomId === roomId;

    async function move(key, destinationNumber) {
      const expectedRoomId = String(destinationNumber).padStart(2, '0');
      const startedAt = Date.now();
      await page.keyboard.press(key);
      const state = await waitForRoom(page, expectedRoomId);
      const durationMilliseconds = Date.now() - startedAt;
      sequence.push(expectedRoomId);
      moves.push({ key, expectedRoomId, durationMilliseconds, state });
      passed = passed && state.activeRoomId === expectedRoomId && state.isTransitioning === false;
    }

    if (roomNumber > 1) {
      await move('ArrowDown', roomNumber - 1);
      await move('ArrowUp', roomNumber);
    }
    if (roomNumber < 12) {
      await move('ArrowUp', roomNumber + 1);
      await move('ArrowDown', roomNumber);
    }

    passed =
      passed &&
      previousDisabled === (roomNumber === 1) &&
      nextDisabled === (roomNumber === 12) &&
      diagnostics.pageErrors.length === 0 &&
      diagnostics.consoleErrors.length === 0;

    return {
      roomId,
      boundary:
        roomNumber === 1
          ? 'Lower boundary: previous control must be disabled.'
          : roomNumber === 12
            ? 'Upper boundary: next control must be disabled.'
            : 'Interior room: previous and next controls must both be enabled.',
      sequence,
      moves,
      previousDisabled,
      nextDisabled,
      entryState,
      diagnostics,
      passed,
      capturedAt: new Date().toISOString(),
    };
  } finally {
    await page.close();
  }
}

const executablePath = findChrome();
if (!executablePath) {
  writeFileSync(
    path.join(evidenceDir, 'fatal.json'),
    `${JSON.stringify({ roomId, phase: 'browser-discovery', error: 'No Chrome or Chromium executable found.' }, null, 2)}\n`,
  );
  throw new Error('No Chrome or Chromium executable was found for room evidence capture.');
}

let browser;
let exitCode = 0;
try {
  browser = await puppeteer.launch({
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

  const canonical = await captureScene(browser, 'canonical', 'canonical.png');
  const secondary = await captureScene(browser, 'secondary', 'secondary.png');
  const assetInspection = await captureAssetInspection(browser);
  const traversal = await captureTraversal(browser);

  const allDiagnostics = [canonical.diagnostics, secondary.diagnostics, assetInspection.diagnostics, traversal.diagnostics];
  const consoleErrors = allDiagnostics.flatMap((item) => item.consoleErrors);
  const pageErrors = allDiagnostics.flatMap((item) => item.pageErrors);
  const failedRequests = allDiagnostics.flatMap((item) => item.failedRequests);
  const runtime = {
    roomId,
    readyMilliseconds: canonical.readyMilliseconds,
    secondaryReadyMilliseconds: secondary.readyMilliseconds,
    targetReadyMilliseconds: 2000,
    targetMet: canonical.readyMilliseconds <= 2000,
    viewport,
    qualityTier: canonical.state?.qualityTier,
    assetProgress: canonical.state?.assetProgress,
    consoleErrors,
    pageErrors,
    failedRequests,
    capturedAt: new Date().toISOString(),
  };

  writeFileSync(path.join(evidenceDir, 'runtime.json'), `${JSON.stringify(runtime, null, 2)}\n`);
  writeFileSync(path.join(evidenceDir, 'traversal.json'), `${JSON.stringify(traversal, null, 2)}\n`);
  writeFileSync(path.join(evidenceDir, 'asset-inspection.json'), `${JSON.stringify(assetInspection, null, 2)}\n`);

  const manifest = {
    schemaVersion: 1,
    roomId,
    generatedAt: new Date().toISOString(),
    canonicalScreenshot: `validation/evidence/room-${roomId}/canonical.png`,
    secondaryScreenshot: `validation/evidence/room-${roomId}/secondary.png`,
    assetInspectionScreenshot: `validation/evidence/room-${roomId}/${assetInspection.screenshot}`,
    runtimeEvidence: `validation/evidence/room-${roomId}/runtime.json`,
    traversalEvidence: `validation/evidence/room-${roomId}/traversal.json`,
    assetInspectionEvidence: `validation/evidence/room-${roomId}/asset-inspection.json`,
    passed: assetInspection.passed && traversal.passed && pageErrors.length === 0 && consoleErrors.length === 0,
  };
  writeFileSync(path.join(evidenceDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  if (!manifest.passed) exitCode = 1;
  console.log(`Room ${roomId} evidence written to ${path.relative(process.cwd(), evidenceDir)}`);
  console.log(`  canonical ready: ${runtime.readyMilliseconds} ms${runtime.targetMet ? ' (target met)' : ' (target not met)'}`);
  console.log(`  traversal: ${traversal.passed ? 'PASS' : 'FAIL'}`);
  console.log(`  asset inspection: ${assetInspection.passed ? 'PASS' : 'FAIL'}`);
  if (consoleErrors.length || pageErrors.length) {
    console.error(`  browser errors: ${consoleErrors.length + pageErrors.length}`);
  }
} catch (error) {
  exitCode = 1;
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  writeFileSync(
    path.join(evidenceDir, 'fatal.json'),
    `${JSON.stringify({ roomId, assetUrl, error: message, capturedAt: new Date().toISOString() }, null, 2)}\n`,
  );
  console.error(message);
} finally {
  await browser?.close();
}

process.exitCode = exitCode;

#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const BASE_URL = process.argv[2] || 'http://127.0.0.1:4173';
const roomNumber = Number.parseInt(process.argv[3] || '1', 10);
const roomId = String(Number.isFinite(roomNumber) ? roomNumber : 1).padStart(2, '0');
const assetUrl = process.argv[4] || '/assets/room-01-experience-kiosk.glb';
const evidenceDir = path.resolve('validation', 'evidence', `room-${roomId}`);
const viewport = { width: 1440, height: 900, deviceScaleFactor: 1 };
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

mkdirSync(evidenceDir, { recursive: true });

async function loadPuppeteer() {
  try {
    return (await import('puppeteer')).default;
  } catch (primaryError) {
    try {
      return (await import('puppeteer-core')).default;
    } catch {
      throw new Error(
        `Puppeteer is required for evidence capture. Install it with "npm install --no-save puppeteer". ${primaryError}`,
      );
    }
  }
}

function findChrome(puppeteer) {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  try {
    const bundled = puppeteer.executablePath?.();
    if (bundled && existsSync(bundled)) return bundled;
  } catch {
    // Fall through to common system paths.
  }

  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  return candidates.find(existsSync);
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
    room: String(Number(roomId)),
    quality: 'balanced',
    view,
  });
  const startedAt = Date.now();
  await page.goto(`${BASE_URL}/?${query}`, { waitUntil: 'networkidle2', timeout: 90_000 });
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
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 90_000 });
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

    const nextStartedAt = Date.now();
    await page.keyboard.press('ArrowUp');
    await page.waitForFunction(
      () => window.__CONFLUENCE_VALIDATION__?.ready && window.__CONFLUENCE_VALIDATION__.activeRoomId === '02',
      { timeout: 30_000 },
    );
    const nextDurationMilliseconds = Date.now() - nextStartedAt;
    const nextState = await page.evaluate(() => ({
      activeRoomId: window.__CONFLUENCE_VALIDATION__?.activeRoomId,
      isTransitioning: window.__CONFLUENCE_VALIDATION__?.isTransitioning,
    }));

    const returnStartedAt = Date.now();
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(
      () => window.__CONFLUENCE_VALIDATION__?.ready && window.__CONFLUENCE_VALIDATION__.activeRoomId === '01',
      { timeout: 30_000 },
    );
    const returnDurationMilliseconds = Date.now() - returnStartedAt;
    const returnState = await page.evaluate(() => ({
      activeRoomId: window.__CONFLUENCE_VALIDATION__?.activeRoomId,
      isTransitioning: window.__CONFLUENCE_VALIDATION__?.isTransitioning,
    }));

    const passed =
      entryState?.activeRoomId === '01' &&
      previousDisabled === true &&
      nextDisabled === false &&
      nextState.activeRoomId === '02' &&
      nextState.isTransitioning === false &&
      returnState.activeRoomId === '01' &&
      returnState.isTransitioning === false &&
      diagnostics.pageErrors.length === 0 &&
      diagnostics.consoleErrors.length === 0;

    return {
      roomId,
      boundary: 'Room 01 has no previous room; the previous control must be disabled.',
      sequence: ['01', '02', '01'],
      inputMethod: ['ArrowUp', 'ArrowDown'],
      previousDisabled,
      nextDisabled,
      nextDurationMilliseconds,
      returnDurationMilliseconds,
      entryState,
      nextState,
      returnState,
      diagnostics,
      passed,
      capturedAt: new Date().toISOString(),
    };
  } finally {
    await page.close();
  }
}

const puppeteer = await loadPuppeteer();
const executablePath = findChrome(puppeteer);
if (!executablePath) {
  throw new Error('No Chrome or Chromium executable was found for room evidence capture.');
}

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
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

let exitCode = 0;
try {
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
} finally {
  await browser.close();
}

process.exitCode = exitCode;

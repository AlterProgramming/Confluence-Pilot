#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4178';
const outputDirectory = path.resolve('validation', 'traversable-world');
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
    '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--enable-webgl',
  ],
});

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  route: '/dimension/play',
  passed: false,
  initial: null,
  interaction: null,
  jump: null,
  movementAttempts: [],
  moved: null,
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  fatalError: null,
  checks: {},
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function readRuntime(page) {
  return page.$eval('[data-testid="traversable-world-runtime"]', (element) => ({
    runtimeState: element.getAttribute('data-runtime-state'),
    enteredWorld: element.getAttribute('data-entered-world'),
    worldCellCount: Number(element.getAttribute('data-world-cell-count')),
    worldRouteCount: Number(element.getAttribute('data-world-route-count')),
    worldAnchorCount: Number(element.getAttribute('data-world-anchor-count')),
    spawnCellId: element.getAttribute('data-spawn-cell-id') ?? '',
    currentCellId: element.getAttribute('data-current-cell-id') ?? '',
    playerX: Number(element.getAttribute('data-player-x')),
    playerY: Number(element.getAttribute('data-player-y')),
    playerZ: Number(element.getAttribute('data-player-z')),
    grounded: element.getAttribute('data-player-grounded'),
    nearestAnchorId: element.getAttribute('data-nearest-anchor-id') ?? '',
    interactionAnchorId: element.getAttribute('data-interaction-anchor-id') ?? '',
    canvasMounted: Boolean(element.querySelector('[data-testid="traversable-world-canvas"] canvas')),
    telemetryMounted: Boolean(element.querySelector('[data-testid="traversable-world-telemetry"]')),
  }));
}

function displacementFromInitial(initial, state) {
  if (!initial || !state) return 0;
  return Math.hypot(state.playerX - initial.playerX, state.playerZ - initial.playerZ);
}

async function runMovementAttempt(page, key, milliseconds = 1750) {
  await page.keyboard.down('Shift');
  await page.keyboard.down(key);
  await delay(milliseconds);
  await page.keyboard.up(key);
  await page.keyboard.up('Shift');
  await delay(650);
  return readRuntime(page);
}

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1680, height: 1050, deviceScaleFactor: 1 });
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => report.pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    report.requestFailures.push({ url: request.url(), errorText: request.failure()?.errorText ?? 'unknown' });
  });

  await page.goto(`${baseUrl}/dimension/play?capture=1`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForSelector('[data-testid="traversable-world-runtime"]', { visible: true, timeout: 30_000 });
  await page.waitForFunction(
    () => {
      const root = document.querySelector('[data-testid="traversable-world-runtime"]');
      return root?.getAttribute('data-runtime-state') === 'ready'
        && root.getAttribute('data-entered-world') === 'true';
    },
    { timeout: 90_000 },
  );
  await page.waitForSelector('[data-testid="traversable-world-canvas"] canvas', { visible: true, timeout: 30_000 });
  await delay(1500);

  report.initial = await readRuntime(page);
  const initialScreenshot = path.join(outputDirectory, 'first-footstep-spawn.png');
  await page.screenshot({ path: initialScreenshot, captureBeyondViewport: false });
  report.screenshots.push(path.basename(initialScreenshot));

  await page.click('[data-testid="traversable-world-canvas"] canvas');
  await page.keyboard.press('e');
  await page.waitForFunction(
    () => Boolean(document.querySelector('[data-testid="traversable-world-runtime"]')?.getAttribute('data-interaction-anchor-id')),
    { timeout: 12_000 },
  );
  report.interaction = await readRuntime(page);

  await page.keyboard.down('Space');
  await delay(110);
  await page.keyboard.up('Space');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="traversable-world-runtime"]')?.getAttribute('data-player-grounded') === 'false',
    { timeout: 5_000 },
  );
  const airborne = await readRuntime(page);
  await page.waitForFunction(
    () => document.querySelector('[data-testid="traversable-world-runtime"]')?.getAttribute('data-player-grounded') === 'true',
    { timeout: 8_000 },
  );
  const landed = await readRuntime(page);
  report.jump = { airborne, landed };

  for (const key of ['w', 'a', 'd', 's']) {
    const state = await runMovementAttempt(page, key);
    const displacement = displacementFromInitial(report.initial, state);
    report.movementAttempts.push({
      key,
      displacement,
      currentCellId: state.currentCellId,
      grounded: state.grounded,
    });
    report.moved = state;
    const crossedCell = Boolean(report.initial?.currentCellId)
      && Boolean(state.currentCellId)
      && report.initial.currentCellId !== state.currentCellId;
    if (displacement > 0.8 && crossedCell && state.grounded === 'true') break;
  }

  const movedScreenshot = path.join(outputDirectory, 'first-footstep-moved.png');
  await page.screenshot({ path: movedScreenshot, captureBeyondViewport: false });
  report.screenshots.push(path.basename(movedScreenshot));

  const displacement = displacementFromInitial(report.initial, report.moved);
  const finiteTelemetry = report.moved
    ? [report.moved.playerX, report.moved.playerY, report.moved.playerZ].every(Number.isFinite)
    : false;

  report.checks = {
    runtimeReachedReady: report.initial?.runtimeState === 'ready',
    worldWasEntered: report.initial?.enteredWorld === 'true',
    stableWorldCellCount: report.initial?.worldCellCount === 361,
    routeAndAnchorMeaningPresent: report.initial?.worldRouteCount >= 1 && report.initial?.worldAnchorCount >= 3,
    spawnContractPresent: Boolean(report.initial?.spawnCellId),
    playerStartsGrounded: report.initial?.grounded === 'true',
    canvasAndTelemetryMounted: report.initial?.canvasMounted === true && report.initial?.telemetryMounted === true,
    physicalAnchorInteraction: Boolean(report.interaction?.interactionAnchorId),
    jumpLeavesGround: report.jump?.airborne?.grounded === 'false',
    gravityReturnsPlayer: report.jump?.landed?.grounded === 'true',
    movementChangesPosition: displacement > 0.8,
    movementCrossesCell: Boolean(report.initial?.currentCellId)
      && Boolean(report.moved?.currentCellId)
      && report.initial.currentCellId !== report.moved.currentCellId,
    playerRemainsGroundedAfterMovement: report.moved?.grounded === 'true',
    telemetryRemainsFinite: finiteTelemetry,
    evidenceCaptured: report.screenshots.length === 2,
    browserClean: report.consoleErrors.length === 0
      && report.pageErrors.length === 0
      && report.requestFailures.length === 0,
  };
  report.displacement = displacement;
  report.passed = Object.values(report.checks).every(Boolean);
} catch (error) {
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
} finally {
  await browser.close();
  writeFileSync(path.join(outputDirectory, 'runtime.json'), `${JSON.stringify(report, null, 2)}\n`);
}

if (!report.passed) process.exitCode = 1;

#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer-core';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4178';
const outputDirectory = path.resolve('validation', 'dimension-scene');
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
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  route: '/dimension?room=02',
  passed: false,
  fatalError: null,
  metadata: null,
  interaction: null,
  returnToOverview: null,
  seedRequest: null,
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  checks: {},
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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
  page.on('response', (response) => {
    if (response.url().includes('/reference/dimensions/the-weight-of-remembering.webp')) {
      report.seedRequest = { url: response.url(), status: response.status(), ok: response.ok() };
    }
  });

  await page.goto(`${baseUrl}/dimension?room=02`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForSelector('[data-testid="dimension-runtime"]', { visible: true, timeout: 90_000 });
  await page.waitForSelector('.dimension-canvas canvas', { visible: true, timeout: 30_000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.dimension-canvas canvas');
    return canvas instanceof HTMLCanvasElement && canvas.width > 0 && canvas.height > 0;
  }, { timeout: 30_000 });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="dimension-runtime"]')?.getAttribute('data-camera-focus') === 'overview',
    { timeout: 20_000 },
  );
  await delay(3200);

  report.metadata = await page.$eval('[data-testid="dimension-runtime"]', (element) => ({
    dimensionId: element.getAttribute('data-dimension-id'),
    roomCode: element.getAttribute('data-room-code'),
    anchorCount: Number(element.getAttribute('data-anchor-count')),
    pathCount: Number(element.getAttribute('data-path-count')),
    layerCount: Number(element.getAttribute('data-layer-count')),
    canvasCount: element.querySelectorAll('canvas').length,
    cameraFocus: element.getAttribute('data-camera-focus'),
    cameraPosition: element.getAttribute('data-camera-position'),
    cameraTarget: element.getAttribute('data-camera-target'),
  }));

  const overviewPath = path.join(outputDirectory, 'dimension-room-02-overview.png');
  await page.screenshot({ path: overviewPath, captureBeyondViewport: false });
  report.screenshots.push(path.basename(overviewPath));

  await page.click('[data-anchor-id="lantern-city"]');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="dimension-inspector"]')?.getAttribute('data-selected-anchor') === 'lantern-city',
    { timeout: 20_000 },
  );
  await page.waitForFunction(
    () => document.querySelector('[data-testid="dimension-runtime"]')?.getAttribute('data-camera-focus') === 'lantern-city',
    { timeout: 30_000 },
  );
  await delay(650);
  report.interaction = await page.$eval('[data-testid="dimension-runtime"]', (runtime) => {
    const inspector = document.querySelector('[data-testid="dimension-inspector"]');
    return {
      selectedAnchor: inspector?.getAttribute('data-selected-anchor') ?? '',
      heading: inspector?.querySelector('h2')?.textContent?.trim() ?? '',
      description: inspector?.querySelector('p')?.textContent?.trim() ?? '',
      cameraFocus: runtime.getAttribute('data-camera-focus'),
      cameraPosition: runtime.getAttribute('data-camera-position'),
      cameraTarget: runtime.getAttribute('data-camera-target'),
    };
  });

  const selectedPath = path.join(outputDirectory, 'dimension-room-02-lantern-city.png');
  await page.screenshot({ path: selectedPath, captureBeyondViewport: false });
  report.screenshots.push(path.basename(selectedPath));

  await page.click('[data-testid="release-dimension-anchor"]');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="dimension-inspector"]')?.getAttribute('data-selected-anchor') === '',
    { timeout: 20_000 },
  );
  await page.waitForFunction(
    () => document.querySelector('[data-testid="dimension-runtime"]')?.getAttribute('data-camera-focus') === 'overview',
    { timeout: 30_000 },
  );
  report.returnToOverview = await page.$eval('[data-testid="dimension-runtime"]', (runtime) => ({
    cameraFocus: runtime.getAttribute('data-camera-focus'),
    cameraPosition: runtime.getAttribute('data-camera-position'),
    cameraTarget: runtime.getAttribute('data-camera-target'),
  }));

  const invalidPage = await browser.newPage();
  await invalidPage.setViewport({ width: 900, height: 600, deviceScaleFactor: 1 });
  await invalidPage.goto(`${baseUrl}/dimension?room=99`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await invalidPage.waitForSelector('[data-testid="dimension-error"]', { visible: true, timeout: 30_000 });
  const explicitFailure = await invalidPage.$eval('[data-testid="dimension-error"]', (element) => ({
    roomCode: element.getAttribute('data-room-code'),
    message: element.querySelector('h1')?.textContent?.trim() ?? '',
  }));
  await invalidPage.close();

  report.checks = {
    roomCodeInitialized: report.metadata?.roomCode === '02',
    expectedDimensionLoaded: report.metadata?.dimensionId === 'the-weight-of-remembering',
    sceneGrammarPresent: report.metadata?.anchorCount === 7
      && report.metadata?.pathCount === 4
      && report.metadata?.layerCount === 5,
    webglCanvasMounted: report.metadata?.canvasCount === 1,
    seededArtworkFetched: report.seedRequest?.ok === true && report.seedRequest?.status === 200,
    overviewCameraReported: report.metadata?.cameraFocus === 'overview'
      && typeof report.metadata?.cameraPosition === 'string'
      && typeof report.metadata?.cameraTarget === 'string',
    anchorSelectionWorks: report.interaction?.selectedAnchor === 'lantern-city'
      && report.interaction?.heading === 'Lantern city basin'
      && report.interaction?.description.length > 40,
    guidedCameraReachedAnchor: report.interaction?.cameraFocus === 'lantern-city'
      && report.interaction?.cameraPosition !== report.metadata?.cameraPosition
      && report.interaction?.cameraTarget !== report.metadata?.cameraTarget,
    cameraReturnedToOverview: report.returnToOverview?.cameraFocus === 'overview'
      && report.returnToOverview?.cameraPosition === report.metadata?.cameraPosition
      && report.returnToOverview?.cameraTarget === report.metadata?.cameraTarget,
    unsupportedRoomFailsExplicitly: explicitFailure.roomCode === '99'
      && explicitFailure.message.includes('Unknown room code'),
    evidenceCaptured: report.screenshots.length === 2,
    browserClean: report.consoleErrors.length === 0
      && report.pageErrors.length === 0
      && report.requestFailures.length === 0,
  };
  report.passed = Object.values(report.checks).every(Boolean);
} catch (error) {
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
} finally {
  await browser.close();
  writeFileSync(path.join(outputDirectory, 'runtime.json'), `${JSON.stringify(report, null, 2)}\n`);
}

if (!report.passed) process.exitCode = 1;

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
  schemaVersion: 4,
  generatedAt: new Date().toISOString(),
  route: '/dimension?room=02',
  passed: false,
  fatalError: null,
  metadata: null,
  interaction: null,
  journeyStep: null,
  portalOpen: null,
  portalClosed: null,
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
    focusMode: element.getAttribute('data-focus-mode'),
    portalState: element.getAttribute('data-portal-state'),
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
      anchorIndex: Number(inspector?.getAttribute('data-anchor-index')),
      heading: inspector?.querySelector('h2')?.textContent?.trim() ?? '',
      description: inspector?.querySelector('p')?.textContent?.trim() ?? '',
      focusMode: runtime.getAttribute('data-focus-mode'),
      cameraFocus: runtime.getAttribute('data-camera-focus'),
      cameraPosition: runtime.getAttribute('data-camera-position'),
      cameraTarget: runtime.getAttribute('data-camera-target'),
      previousControl: Boolean(inspector?.querySelector('[data-testid="previous-dimension-anchor"]')),
      nextControl: Boolean(inspector?.querySelector('[data-testid="next-dimension-anchor"]')),
    };
  });

  const selectedPath = path.join(outputDirectory, 'dimension-room-02-lantern-city.png');
  await page.screenshot({ path: selectedPath, captureBeyondViewport: false });
  report.screenshots.push(path.basename(selectedPath));

  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="dimension-inspector"]')?.getAttribute('data-selected-anchor') === 'portal-horizon',
    { timeout: 20_000 },
  );
  await page.waitForFunction(
    () => document.querySelector('[data-testid="dimension-runtime"]')?.getAttribute('data-camera-focus') === 'portal-horizon',
    { timeout: 30_000 },
  );
  await delay(650);
  report.journeyStep = await page.$eval('[data-testid="dimension-runtime"]', (runtime) => {
    const inspector = document.querySelector('[data-testid="dimension-inspector"]');
    return {
      selectedAnchor: inspector?.getAttribute('data-selected-anchor') ?? '',
      anchorIndex: Number(inspector?.getAttribute('data-anchor-index')),
      heading: inspector?.querySelector('h2')?.textContent?.trim() ?? '',
      portalState: runtime.getAttribute('data-portal-state'),
      cameraFocus: runtime.getAttribute('data-camera-focus'),
      cameraPosition: runtime.getAttribute('data-camera-position'),
      cameraTarget: runtime.getAttribute('data-camera-target'),
      openControl: Boolean(inspector?.querySelector('[data-testid="open-dimension-portal"]')),
    };
  });

  const portalPath = path.join(outputDirectory, 'dimension-room-02-portal-horizon.png');
  await page.screenshot({ path: portalPath, captureBeyondViewport: false });
  report.screenshots.push(path.basename(portalPath));

  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="dimension-runtime"]')?.getAttribute('data-portal-state') === 'open',
    { timeout: 20_000 },
  );
  await page.waitForFunction(
    () => document.querySelector('[data-testid="dimension-runtime"]')?.getAttribute('data-camera-focus') === 'portal-horizon:open',
    { timeout: 30_000 },
  );
  await delay(900);
  report.portalOpen = await page.$eval('[data-testid="dimension-runtime"]', (runtime) => ({
    portalState: runtime.getAttribute('data-portal-state'),
    focusMode: runtime.getAttribute('data-focus-mode'),
    cameraFocus: runtime.getAttribute('data-camera-focus'),
    cameraPosition: runtime.getAttribute('data-camera-position'),
    cameraTarget: runtime.getAttribute('data-camera-target'),
    thresholdClass: runtime.classList.contains('dimension-threshold-open'),
    closeControl: Boolean(document.querySelector('[data-testid="close-dimension-portal"]')),
  }));

  const portalOpenPath = path.join(outputDirectory, 'dimension-room-02-portal-open.png');
  await page.screenshot({ path: portalOpenPath, captureBeyondViewport: false });
  report.screenshots.push(path.basename(portalOpenPath));

  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="dimension-runtime"]')?.getAttribute('data-portal-state') === 'closed',
    { timeout: 20_000 },
  );
  await page.waitForFunction(
    () => document.querySelector('[data-testid="dimension-runtime"]')?.getAttribute('data-camera-focus') === 'portal-horizon',
    { timeout: 30_000 },
  );
  report.portalClosed = await page.$eval('[data-testid="dimension-runtime"]', (runtime) => ({
    portalState: runtime.getAttribute('data-portal-state'),
    selectedAnchor: document.querySelector('[data-testid="dimension-inspector"]')?.getAttribute('data-selected-anchor') ?? '',
    cameraFocus: runtime.getAttribute('data-camera-focus'),
  }));

  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="dimension-inspector"]')?.getAttribute('data-selected-anchor') === '',
    { timeout: 20_000 },
  );
  await page.waitForFunction(
    () => document.querySelector('[data-testid="dimension-runtime"]')?.getAttribute('data-camera-focus') === 'overview',
    { timeout: 30_000 },
  );
  report.returnToOverview = await page.$eval('[data-testid="dimension-runtime"]', (runtime) => ({
    focusMode: runtime.getAttribute('data-focus-mode'),
    portalState: runtime.getAttribute('data-portal-state'),
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
    overviewCameraReported: report.metadata?.focusMode === 'overview'
      && report.metadata?.portalState === 'closed'
      && report.metadata?.cameraFocus === 'overview'
      && typeof report.metadata?.cameraPosition === 'string'
      && typeof report.metadata?.cameraTarget === 'string',
    anchorSelectionWorks: report.interaction?.selectedAnchor === 'lantern-city'
      && report.interaction?.anchorIndex === 5
      && report.interaction?.heading === 'Lantern city basin'
      && report.interaction?.description.length > 40,
    focusedInterfaceActivated: report.interaction?.focusMode === 'anchor'
      && report.interaction?.previousControl === true
      && report.interaction?.nextControl === true,
    guidedCameraReachedAnchor: report.interaction?.cameraFocus === 'lantern-city'
      && report.interaction?.cameraPosition !== report.metadata?.cameraPosition
      && report.interaction?.cameraTarget !== report.metadata?.cameraTarget,
    keyboardJourneyAdvanced: report.journeyStep?.selectedAnchor === 'portal-horizon'
      && report.journeyStep?.anchorIndex === 6
      && report.journeyStep?.heading === 'Portal horizon'
      && report.journeyStep?.portalState === 'closed'
      && report.journeyStep?.cameraFocus === 'portal-horizon'
      && report.journeyStep?.openControl === true,
    portalOpenedByKeyboard: report.portalOpen?.portalState === 'open'
      && report.portalOpen?.focusMode === 'anchor'
      && report.portalOpen?.cameraFocus === 'portal-horizon:open'
      && report.portalOpen?.cameraPosition !== report.journeyStep?.cameraPosition
      && report.portalOpen?.cameraTarget !== report.journeyStep?.cameraTarget
      && report.portalOpen?.thresholdClass === true
      && report.portalOpen?.closeControl === true,
    firstEscapeClosedPortalOnly: report.portalClosed?.portalState === 'closed'
      && report.portalClosed?.selectedAnchor === 'portal-horizon'
      && report.portalClosed?.cameraFocus === 'portal-horizon',
    secondEscapeReturnedToOverview: report.returnToOverview?.focusMode === 'overview'
      && report.returnToOverview?.portalState === 'closed'
      && report.returnToOverview?.cameraFocus === 'overview'
      && report.returnToOverview?.cameraPosition === report.metadata?.cameraPosition
      && report.returnToOverview?.cameraTarget === report.metadata?.cameraTarget,
    unsupportedRoomFailsExplicitly: explicitFailure.roomCode === '99'
      && explicitFailure.message.includes('Unknown room code'),
    evidenceCaptured: report.screenshots.length === 4,
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

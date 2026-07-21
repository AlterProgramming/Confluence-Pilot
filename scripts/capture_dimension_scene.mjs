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
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  route: '/dimension?room=02',
  passed: false,
  fatalError: null,
  metadata: null,
  interaction: null,
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
  await page.waitForSelector('canvas.dimension-canvas', { visible: true, timeout: 30_000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas.dimension-canvas');
    return canvas instanceof HTMLCanvasElement && canvas.width > 0 && canvas.height > 0;
  }, { timeout: 30_000 });
  await delay(4500);

  report.metadata = await page.$eval('[data-testid="dimension-runtime"]', (element) => ({
    dimensionId: element.getAttribute('data-dimension-id'),
    roomCode: element.getAttribute('data-room-code'),
    anchorCount: Number(element.getAttribute('data-anchor-count')),
    pathCount: Number(element.getAttribute('data-path-count')),
    layerCount: Number(element.getAttribute('data-layer-count')),
    canvasCount: element.querySelectorAll('canvas').length,
  }));

  const overviewPath = path.join(outputDirectory, 'dimension-room-02-overview.png');
  await page.screenshot({ path: overviewPath, captureBeyondViewport: false });
  report.screenshots.push(path.basename(overviewPath));

  await page.click('[data-anchor-id="lantern-city"]');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="dimension-inspector"]')?.getAttribute('data-selected-anchor') === 'lantern-city',
    { timeout: 20_000 },
  );
  await delay(850);
  report.interaction = await page.$eval('[data-testid="dimension-inspector"]', (element) => ({
    selectedAnchor: element.getAttribute('data-selected-anchor'),
    heading: element.querySelector('h2')?.textContent?.trim() ?? '',
    description: element.querySelector('p')?.textContent?.trim() ?? '',
  }));

  const selectedPath = path.join(outputDirectory, 'dimension-room-02-lantern-city.png');
  await page.screenshot({ path: selectedPath, captureBeyondViewport: false });
  report.screenshots.push(path.basename(selectedPath));

  await page.click('[data-testid="release-dimension-anchor"]');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="dimension-inspector"]')?.getAttribute('data-selected-anchor') === '',
    { timeout: 20_000 },
  );

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
    anchorSelectionWorks: report.interaction?.selectedAnchor === 'lantern-city'
      && report.interaction?.heading === 'Lantern city basin'
      && report.interaction?.description.length > 40,
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

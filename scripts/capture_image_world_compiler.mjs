#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4178';
const outputDirectory = path.resolve('validation', 'image-world-compiler');
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
  route: '/dimension/compiler',
  passed: false,
  metadata: null,
  reviewMutation: null,
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  fatalError: null,
  checks: {},
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1680, height: 1100, deviceScaleFactor: 1 });
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => report.pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    report.requestFailures.push({ url: request.url(), errorText: request.failure()?.errorText ?? 'unknown' });
  });

  await page.goto(`${baseUrl}/dimension/compiler`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForSelector('[data-testid="image-world-compiler"]', { visible: true, timeout: 30_000 });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="image-world-compiler"]')?.getAttribute('data-compiler-state') === 'ready',
    { timeout: 90_000 },
  );
  await page.waitForSelector('[data-testid="image-world-preview"] canvas', { visible: true, timeout: 30_000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-testid="image-world-preview"] canvas');
    return canvas instanceof HTMLCanvasElement && canvas.width > 0 && canvas.height > 0;
  }, { timeout: 30_000 });
  await delay(1800);

  report.metadata = await page.$eval('[data-testid="image-world-compiler"]', (element) => ({
    compilerState: element.getAttribute('data-compiler-state'),
    semanticRegionCount: Number(element.getAttribute('data-semantic-region-count')),
    anchorProposalCount: Number(element.getAttribute('data-anchor-proposal-count')),
    routeProposalCount: Number(element.getAttribute('data-route-proposal-count')),
    worldCellCount: Number(element.getAttribute('data-world-cell-count')),
    rejectedProposalCount: Number(element.getAttribute('data-rejected-proposal-count')),
    sourceLoaded: Boolean(element.querySelector('.image-world-source-frame img')?.complete),
    overlayMounted: Boolean(element.querySelector('[data-testid="image-world-overlay"]')),
    inspectorMounted: Boolean(element.querySelector('[data-testid="compiler-anchor-inspector"]')),
    previewMounted: Boolean(element.querySelector('[data-testid="image-world-preview"] canvas')),
  }));

  const overviewPath = path.join(outputDirectory, 'image-world-compiler-overview.png');
  await page.screenshot({ path: overviewPath, captureBeyondViewport: false });
  report.screenshots.push(path.basename(overviewPath));

  await page.click('[data-testid="reject-compiler-anchor"]');
  await page.waitForFunction(
    () => Number(document.querySelector('[data-testid="image-world-compiler"]')?.getAttribute('data-rejected-proposal-count')) >= 1,
    { timeout: 20_000 },
  );
  await delay(700);

  report.reviewMutation = await page.$eval('[data-testid="image-world-compiler"]', (element) => {
    const inspector = element.querySelector('[data-testid="compiler-anchor-inspector"]');
    const activeReject = element.querySelector('[data-testid="reject-compiler-anchor"]')?.classList.contains('active');
    return {
      rejectedProposalCount: Number(element.getAttribute('data-rejected-proposal-count')),
      worldCellCount: Number(element.getAttribute('data-world-cell-count')),
      activeReject,
      inspectorHeading: inspector?.querySelector('h3')?.textContent?.trim() ?? '',
      previewCellCount: Number(element.querySelector('[data-testid="image-world-preview"]')?.getAttribute('data-world-cell-count')),
    };
  });

  const reviewedPath = path.join(outputDirectory, 'image-world-compiler-reviewed.png');
  await page.screenshot({ path: reviewedPath, captureBeyondViewport: false });
  report.screenshots.push(path.basename(reviewedPath));

  report.checks = {
    compilerReachedReady: report.metadata?.compilerState === 'ready',
    sourceImageLoaded: report.metadata?.sourceLoaded === true,
    semanticCoveragePresent: report.metadata?.semanticRegionCount >= 24,
    anchorCoveragePresent: report.metadata?.anchorProposalCount >= 3,
    routesPresent: report.metadata?.routeProposalCount >= 1,
    stableWorldCellCount: report.metadata?.worldCellCount === 361,
    evidenceOverlayMounted: report.metadata?.overlayMounted === true,
    anchorInspectorMounted: report.metadata?.inspectorMounted === true,
    threeDimensionalPreviewMounted: report.metadata?.previewMounted === true,
    rejectionChangesReviewState: report.reviewMutation?.rejectedProposalCount >= 1
      && report.reviewMutation?.activeReject === true,
    rejectionRecompilesStableFabric: report.reviewMutation?.worldCellCount === 361
      && report.reviewMutation?.previewCellCount === 361,
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

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
  route: '/dimension?world=the-weight-of-remembering&authoring=1',
  passed: false,
  metadata: null,
  authoring: null,
  editedDraft: null,
  resetDraft: null,
  standalone: null,
  invalidWorld: null,
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  checks: {},
  fatalError: null,
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

  const setControlledInput = async (selector, index, value) => {
    await page.$$eval(selector, (elements, payload) => {
      const element = elements[payload.index];
      if (!(element instanceof HTMLInputElement)) {
        throw new Error(`Input ${payload.index} was not found for ${payload.selector}.`);
      }
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (!setter) throw new Error('Native input value setter is unavailable.');
      setter.call(element, payload.value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }, { index, value, selector });
  };

  await page.goto(`${baseUrl}/dimension?world=the-weight-of-remembering&authoring=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  await page.waitForSelector('[data-testid="dimension-runtime"]', { visible: true, timeout: 90_000 });
  await page.waitForSelector('.dimension-canvas canvas', { visible: true, timeout: 30_000 });
  await page.waitForSelector('[data-testid="dimension-authoring-panel"]', { visible: true, timeout: 30_000 });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="dimension-runtime"]')?.getAttribute('data-authoring-state') === 'open',
    { timeout: 20_000 },
  );
  await delay(2600);

  report.metadata = await page.$eval('[data-testid="dimension-runtime"]', (runtime) => ({
    dimensionId: runtime.getAttribute('data-dimension-id'),
    entryKind: runtime.getAttribute('data-entry-kind'),
    entrySource: runtime.getAttribute('data-entry-source'),
    roomCode: runtime.getAttribute('data-room-code'),
    entranceCount: Number(runtime.getAttribute('data-entrance-count')),
    authoringState: runtime.getAttribute('data-authoring-state'),
    titleEyebrow: document.querySelector('.dimension-title-panel .dimension-room-code')?.textContent?.trim() ?? '',
  }));

  report.authoring = await page.$eval('[data-testid="dimension-authoring-panel"]', (panel) => ({
    heading: panel.querySelector('h2')?.textContent?.trim() ?? '',
    validationState: panel.querySelector('.dimension-authoring-validation')?.getAttribute('data-validation-state'),
    sectionTitles: Array.from(panel.querySelectorAll('h3')).map((heading) => heading.textContent?.trim() ?? ''),
    inputCount: panel.querySelectorAll('input, textarea, select').length,
    entranceCards: panel.querySelectorAll('.dimension-authoring-list article').length,
  }));

  const authoringOverviewPath = path.join(outputDirectory, 'dimension-world-authoring-overview.png');
  await page.screenshot({ path: authoringOverviewPath, captureBeyondViewport: false });
  report.screenshots.push(path.basename(authoringOverviewPath));

  await page.select('[data-testid="dimension-authoring-panel"] select', 'lantern-city');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="dimension-inspector"]')?.getAttribute('data-selected-anchor') === 'lantern-city',
    { timeout: 20_000 },
  );
  await page.waitForFunction(
    () => document.querySelector('[data-testid="dimension-runtime"]')?.getAttribute('data-camera-focus') === 'lantern-city',
    { timeout: 30_000 },
  );

  await setControlledInput('[data-testid="dimension-authoring-panel"] input', 1, 'Lantern city basin · draft');
  await setControlledInput('[data-testid="dimension-authoring-panel"] input[type="number"]', 0, '0.75');

  await page.waitForFunction(
    () => {
      const panel = document.querySelector('[data-testid="dimension-authoring-panel"]');
      const inputs = panel ? Array.from(panel.querySelectorAll('input')) : [];
      const coordinates = panel ? Array.from(panel.querySelectorAll('input[type="number"]')) : [];
      return inputs[1]?.value === 'Lantern city basin · draft' && coordinates[0]?.value === '0.75';
    },
    { timeout: 20_000 },
  );
  await delay(600);

  report.editedDraft = await page.$eval('[data-testid="dimension-authoring-panel"]', (panel) => {
    const inputs = Array.from(panel.querySelectorAll('input'));
    const coordinates = Array.from(panel.querySelectorAll('input[type="number"]')).map((input) => input.value);
    return {
      anchorLabel: inputs[1]?.value ?? '',
      coordinates,
      runtimeHeading: document.querySelector('[data-testid="dimension-inspector"] h2')?.textContent?.trim() ?? '',
      validationState: panel.querySelector('.dimension-authoring-validation')?.getAttribute('data-validation-state'),
    };
  });

  const editedPath = path.join(outputDirectory, 'dimension-world-authoring-draft-edit.png');
  await page.screenshot({ path: editedPath, captureBeyondViewport: false });
  report.screenshots.push(path.basename(editedPath));

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('[data-testid="dimension-authoring-panel"] footer button'));
    const reset = buttons.find((button) => button.textContent?.includes('Reset draft'));
    if (!(reset instanceof HTMLButtonElement)) throw new Error('Reset draft button was not found.');
    reset.click();
  });
  await page.waitForFunction(
    () => {
      const panel = document.querySelector('[data-testid="dimension-authoring-panel"]');
      const labelInput = panel ? Array.from(panel.querySelectorAll('input'))[1] : null;
      return labelInput?.value === 'Lantern city basin'
        && panel?.querySelector('.dimension-authoring-validation')?.getAttribute('data-validation-state') === 'valid';
    },
    { timeout: 20_000 },
  );
  report.resetDraft = await page.$eval('[data-testid="dimension-authoring-panel"]', (panel) => ({
    anchorLabel: Array.from(panel.querySelectorAll('input'))[1]?.value ?? '',
    validationState: panel.querySelector('.dimension-authoring-validation')?.getAttribute('data-validation-state'),
  }));

  await page.click('[data-testid="dimension-authoring-panel"] [aria-label="Close world authoring"]');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="dimension-runtime"]')?.getAttribute('data-authoring-state') === 'closed',
    { timeout: 20_000 },
  );
  await delay(650);
  report.standalone = await page.$eval('[data-testid="dimension-runtime"]', (runtime) => ({
    dimensionId: runtime.getAttribute('data-dimension-id'),
    entryKind: runtime.getAttribute('data-entry-kind'),
    roomCode: runtime.getAttribute('data-room-code'),
    authoringState: runtime.getAttribute('data-authoring-state'),
    authoringPanelCount: document.querySelectorAll('[data-testid="dimension-authoring-panel"]').length,
  }));

  const standalonePath = path.join(outputDirectory, 'dimension-world-standalone-overview.png');
  await page.screenshot({ path: standalonePath, captureBeyondViewport: false });
  report.screenshots.push(path.basename(standalonePath));

  const invalidPage = await browser.newPage();
  await invalidPage.goto(`${baseUrl}/dimension?world=unknown-world`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await invalidPage.waitForSelector('[data-testid="dimension-error"]', { visible: true, timeout: 20_000 });
  report.invalidWorld = await invalidPage.$eval('[data-testid="dimension-error"]', (element) => ({
    requestedDimension: element.getAttribute('data-requested-dimension'),
    heading: element.querySelector('h1')?.textContent?.trim() ?? '',
  }));
  await invalidPage.close();

  report.checks = {
    semanticWorldId: report.metadata.dimensionId === 'the-weight-of-remembering',
    independentRoute: report.metadata.entryKind === 'route' && report.metadata.roomCode === '',
    registeredEntrances: report.metadata.entranceCount === 2,
    authoringOpen: report.metadata.authoringState === 'open',
    authoringSurface: report.authoring.heading === 'the-weight-of-remembering'
      && report.authoring.validationState === 'valid'
      && report.authoring.sectionTitles.includes('World identity')
      && report.authoring.sectionTitles.includes('Anchor placement')
      && report.authoring.inputCount >= 8,
    liveDraftEdit: report.editedDraft.anchorLabel === 'Lantern city basin · draft'
      && report.editedDraft.coordinates[0] === '0.75'
      && report.editedDraft.runtimeHeading === 'Lantern city basin · draft'
      && report.editedDraft.validationState === 'valid',
    resetRestoresRegistry: report.resetDraft.anchorLabel === 'Lantern city basin'
      && report.resetDraft.validationState === 'valid',
    standaloneRuntime: report.standalone.dimensionId === 'the-weight-of-remembering'
      && report.standalone.entryKind === 'route'
      && report.standalone.roomCode === ''
      && report.standalone.authoringState === 'closed'
      && report.standalone.authoringPanelCount === 0,
    invalidWorldFailsExplicitly: report.invalidWorld.requestedDimension === 'unknown-world'
      && report.invalidWorld.heading.includes('Unknown dimension'),
    screenshotsCaptured: report.screenshots.length === 3,
    cleanBrowser: report.consoleErrors.length === 0
      && report.pageErrors.length === 0
      && report.requestFailures.length === 0,
  };
  report.passed = Object.values(report.checks).every(Boolean);
} catch (error) {
  report.fatalError = error instanceof Error ? error.stack ?? error.message : String(error);
} finally {
  await browser.close();
  writeFileSync(path.join(outputDirectory, 'authoring-runtime.json'), `${JSON.stringify(report, null, 2)}\n`);
}

console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exit(1);

#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4178';
const outputDirectory = path.resolve('validation', 'perception-integration');
mkdirSync(outputDirectory, { recursive: true });

const executablePath = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean).find((candidate) => existsSync(candidate));
if (!executablePath) throw new Error('No Chrome or Chromium executable found.');

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});
const report = {
  schemaVersion: 1,
  route: '/dimension/perception',
  passed: false,
  checks: {},
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
  fatalError: null,
};

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1680, height: 1050, deviceScaleFactor: 1 });
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => report.pageErrors.push(error.message));

  await page.goto(`${baseUrl}/dimension/perception?capture=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  await page.waitForSelector('[data-perception-ready="true"]', { visible: true, timeout: 30_000 });
  await page.waitForSelector('[data-evidence-view="instances"]', { visible: true, timeout: 30_000 });

  const initial = path.join(outputDirectory, 'perception-review.png');
  await page.screenshot({ path: initial, captureBeyondViewport: false });
  report.screenshots.push(path.basename(initial));

  await page.select('.perception-toolbar select', 'adjacent-towers');
  await page.waitForFunction(
    () => document.body.textContent?.includes('Tower A') && document.body.textContent?.includes('Tower B'),
  );
  await page.click('.perception-tabs button:nth-child(5)');
  await page.waitForSelector('[data-evidence-view="walkability"]', { visible: true });

  const walkability = path.join(outputDirectory, 'perception-walkability.png');
  await page.screenshot({ path: walkability, captureBeyondViewport: false });
  report.screenshots.push(path.basename(walkability));

  report.checks = {
    shellReady: await page.$('[data-perception-ready="true"]') !== null,
    fixtureModeVisible: await page.evaluate(() => document.body.textContent?.includes('fixture client') ?? false),
    evidenceTabsVisible: await page.evaluate(
      () => ['Original', 'Depth', 'Normals', 'Instances', 'Walkability', 'Uncertainty']
        .every((label) => document.body.textContent?.includes(label)),
    ),
    adjacentInstancesSeparate: await page.evaluate(
      () => document.body.textContent?.includes('Tower A') && document.body.textContent?.includes('Tower B'),
    ),
    walkabilityRendered: await page.$('[data-evidence-view="walkability"] .perception-map') !== null,
    screenshotsCaptured: report.screenshots.length === 2,
    browserClean: report.consoleErrors.length === 0 && report.pageErrors.length === 0,
  };
  report.passed = Object.values(report.checks).every(Boolean);
} catch (error) {
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  await browser.close();
  writeFileSync(path.join(outputDirectory, 'runtime.json'), `${JSON.stringify(report, null, 2)}\n`);
}

if (!report.passed) process.exitCode = 1;

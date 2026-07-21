#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer-core';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4179';
const outputDirectory = path.resolve('validation', 'dimension', 'weight-of-remembering-lite');
mkdirSync(outputDirectory, { recursive: true });

const executablePath = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean).find((candidate) => existsSync(candidate));

if (!executablePath) throw new Error('No Chrome or Chromium executable found.');

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  passed: false,
  checks: {},
  states: [],
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
  fatalError: null,
};

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
  page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => report.pageErrors.push(error.message));

  await page.goto(`${baseUrl}/?dimension=weight-of-remembering-lite`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(
    () => window.__CONFLUENCE_DIMENSION__?.ready === true && window.__CONFLUENCE_DIMENSION__.seedLoaded === true,
    { timeout: 90_000 },
  );
  await page.waitForSelector('[data-testid="dimension-canvas"][data-ready="true"]', { timeout: 30_000 });
  await new Promise((resolve) => setTimeout(resolve, 2200));

  const initial = await page.evaluate(() => window.__CONFLUENCE_DIMENSION__);
  report.states.push({ name: 'initial', state: initial });
  await page.screenshot({ path: path.join(outputDirectory, 'dimension-live.png'), captureBeyondViewport: false });
  report.screenshots.push('dimension-live.png');

  await page.mouse.move(1450, 180);
  await new Promise((resolve) => setTimeout(resolve, 700));
  const parallax = await page.evaluate(() => window.__CONFLUENCE_DIMENSION__);
  report.states.push({ name: 'parallax', state: parallax });
  await page.screenshot({ path: path.join(outputDirectory, 'dimension-parallax.png'), captureBeyondViewport: false });
  report.screenshots.push('dimension-parallax.png');

  const mapButton = await page.$x?.("//button[contains(., 'Open dimension map')]");
  if (mapButton?.[0]) await mapButton[0].click();
  else await page.evaluate(() => [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Open dimension map'))?.click());
  await page.waitForSelector('[data-testid="dimension-map"]', { visible: true, timeout: 20_000 });
  await new Promise((resolve) => setTimeout(resolve, 350));
  await page.screenshot({ path: path.join(outputDirectory, 'dimension-map.png'), captureBeyondViewport: false });
  report.screenshots.push('dimension-map.png');

  const elapsedBefore = initial.elapsedSeconds;
  const elapsedAfter = parallax.elapsedSeconds;
  report.checks = {
    dimensionReady: initial.ready === true,
    seededImageLoaded: initial.seedLoaded === true,
    initializedFromRoomCode: initial.roomId === 'dimension-weight-of-remembering',
    atLeastFortyLivingNodes: initial.nodeCount >= 40 && initial.activeNodeCount === initial.nodeCount,
    dimensionHasDepth: initial.layerCount >= 6,
    dimensionHasRegions: initial.zoneCount >= 8,
    dimensionHasPaths: initial.pathCount >= 4,
    timeAdvances: elapsedAfter > elapsedBefore,
    pointerParallaxResponds: Math.abs(parallax.pointer[0]) > 0.5 && Math.abs(parallax.pointer[1]) > 0.4,
    mapOpens: Boolean(await page.$('[data-testid="dimension-map"]')),
    browserClean: report.consoleErrors.length === 0 && report.pageErrors.length === 0,
  };
  report.passed = Object.values(report.checks).every(Boolean);
} catch (error) {
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
} finally {
  await browser.close();
  writeFileSync(path.join(outputDirectory, 'runtime.json'), `${JSON.stringify(report, null, 2)}\n`);
}

if (!report.passed) process.exitCode = 1;

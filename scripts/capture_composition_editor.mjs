#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer-core';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4178';
const outputDirectory = path.resolve('validation', 'composition-editor');
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

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  passed: false,
  screenshots: [],
  states: [],
  consoleErrors: [],
  pageErrors: [],
};

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1680, height: 1000, deviceScaleFactor: 1 });
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => report.pageErrors.push(error.message));

  await page.goto(`${baseUrl}/?editor=1&capture=1`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(() => window.__CONFLUENCE_EDITOR__?.ready === true, { timeout: 90_000 });
  await page.waitForSelector('[data-testid="composition-viewport"] canvas', { timeout: 90_000 });
  await new Promise((resolve) => setTimeout(resolve, 2200));

  const initialState = await page.evaluate(() => window.__CONFLUENCE_EDITOR__);
  report.states.push({ name: 'initial', value: initialState });
  const overviewPath = path.join(outputDirectory, 'composition-editor-overview.png');
  await page.screenshot({ path: overviewPath, captureBeyondViewport: false });
  report.screenshots.push(path.basename(overviewPath));

  await page.click('[data-asset-id="room-02"]');
  await page.waitForFunction(
    (initialCount) => window.__CONFLUENCE_EDITOR__?.instanceCount === initialCount + 1,
    { timeout: 90_000 },
    initialState.instanceCount,
  );
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const selectedState = await page.evaluate(() => window.__CONFLUENCE_EDITOR__);
  report.states.push({ name: 'asset-added', value: selectedState });
  const selectedPath = path.join(outputDirectory, 'composition-editor-asset-selected.png');
  await page.screenshot({ path: selectedPath, captureBeyondViewport: false });
  report.screenshots.push(path.basename(selectedPath));

  await page.click('[data-tool="rotate"]');
  await page.waitForFunction(() => window.__CONFLUENCE_EDITOR__?.transformMode === 'rotate', { timeout: 20_000 });
  await new Promise((resolve) => setTimeout(resolve, 700));
  const rotateState = await page.evaluate(() => window.__CONFLUENCE_EDITOR__);
  report.states.push({ name: 'rotate-mode', value: rotateState });
  const rotatePath = path.join(outputDirectory, 'composition-editor-rotation-mode.png');
  await page.screenshot({ path: rotatePath, captureBeyondViewport: false });
  report.screenshots.push(path.basename(rotatePath));

  report.passed = Boolean(
    initialState?.ready
      && initialState?.units === 'meters'
      && initialState?.gridUnit === 0.25
      && selectedState?.instanceCount === initialState.instanceCount + 1
      && rotateState?.transformMode === 'rotate'
      && report.consoleErrors.length === 0
      && report.pageErrors.length === 0,
  );
} finally {
  await browser.close();
  writeFileSync(path.join(outputDirectory, 'runtime.json'), `${JSON.stringify(report, null, 2)}\n`);
}

if (!report.passed) process.exitCode = 1;

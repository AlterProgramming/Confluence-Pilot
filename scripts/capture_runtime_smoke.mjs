#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer-core';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4173';
const outputDirectory = path.resolve('validation', 'evidence', 'browser-smoke');
mkdirSync(outputDirectory, { recursive: true });

const candidates = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const executablePath = candidates.find((candidate) => existsSync(candidate));

const report = {
  schemaVersion: 1,
  passed: false,
  executablePath: executablePath ?? null,
  activeRoomId: null,
  qualityTier: null,
  canvasCount: 0,
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  fatalError: null,
  capturedAt: new Date().toISOString(),
};

let browser;
try {
  if (!executablePath) throw new Error('No Chrome or Chromium executable found.');
  browser = await puppeteer.launch({
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
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => report.pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    report.failedRequests.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`);
  });

  const query = new URLSearchParams({ capture: '1', validate: '1', room: '2', quality: 'balanced' });
  await page.goto(`${baseUrl}/?${query}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForSelector('canvas', { timeout: 90_000 });
  await page.waitForFunction(
    () => window.__CONFLUENCE_VALIDATION__?.ready === true && window.__CONFLUENCE_VALIDATION__.activeRoomId === '02',
    { timeout: 90_000 },
  );

  const state = await page.evaluate(() => ({
    activeRoomId: window.__CONFLUENCE_VALIDATION__?.activeRoomId ?? null,
    qualityTier: window.__CONFLUENCE_VALIDATION__?.qualityTier ?? null,
    canvasCount: document.querySelectorAll('canvas').length,
  }));
  report.activeRoomId = state.activeRoomId;
  report.qualityTier = state.qualityTier;
  report.canvasCount = state.canvasCount;
  report.passed = state.activeRoomId === '02'
    && state.canvasCount > 0
    && report.consoleErrors.length === 0
    && report.pageErrors.length === 0;

  await page.screenshot({
    path: path.join(outputDirectory, 'room-02-smoke.png'),
    captureBeyondViewport: false,
  });
} catch (error) {
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
} finally {
  await browser?.close();
  writeFileSync(path.join(outputDirectory, 'runtime.json'), `${JSON.stringify(report, null, 2)}\n`);
}

if (!report.passed) process.exitCode = 1;

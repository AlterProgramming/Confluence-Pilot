#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer-core';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4175';
const outputDirectory = path.resolve('validation', 'browser-smoke');
mkdirSync(outputDirectory, { recursive: true });

function findChrome() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find(existsSync);
}

const report = {
  generatedAt: new Date().toISOString(),
  executablePath: findChrome() ?? null,
  console: [],
  pageErrors: [],
  failedRequests: [],
  state: null,
  dom: null,
  error: null,
  passed: false,
};

let browser;
try {
  if (!report.executablePath) throw new Error('No Chrome or Chromium executable found.');
  browser = await puppeteer.launch({
    executablePath: report.executablePath,
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
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  page.on('console', (message) => report.console.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => report.pageErrors.push(error.message));
  page.on('requestfailed', (request) => report.failedRequests.push({
    method: request.method(),
    url: request.url(),
    error: request.failure()?.errorText ?? 'failed',
  }));

  const query = new URLSearchParams({
    capture: '1',
    validate: '1',
    room: '2',
    quality: 'balanced',
    motion: 'full',
  });
  await page.goto(`${baseUrl}/?${query}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  try {
    await page.waitForFunction(
      () => {
        const state = window.__CONFLUENCE_VALIDATION__;
        return Boolean(state?.ready && state.activeRoomId === '02');
      },
      { timeout: 30_000 },
    );
  } catch (error) {
    report.error = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error);
  }

  report.state = await page.evaluate(() => ({
    validation: window.__CONFLUENCE_VALIDATION__ ?? null,
    heroCamera: window.__CONFLUENCE_HERO_CAMERA__ ?? null,
    documentReadyState: document.readyState,
  }));
  report.dom = await page.evaluate(() => ({
    title: document.title,
    bodyText: document.body?.innerText?.slice(0, 2000) ?? '',
    canvasCount: document.querySelectorAll('canvas').length,
    scriptSources: [...document.scripts].map((script) => script.src).filter(Boolean),
    validationReady: document.documentElement.dataset.validationReady ?? null,
    activeRoom: document.documentElement.dataset.activeRoom ?? null,
  }));
  await page.screenshot({ path: path.join(outputDirectory, 'room-02-smoke.png'), captureBeyondViewport: false });
  report.passed = Boolean(
    report.state.validation?.ready
    && report.state.validation?.activeRoomId === '02'
    && report.dom.canvasCount > 0
    && report.pageErrors.length === 0,
  );
} catch (error) {
  report.error = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error);
} finally {
  if (browser) await browser.close();
  writeFileSync(path.join(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
}

console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;

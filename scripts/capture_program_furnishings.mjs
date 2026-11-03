#!/usr/bin/env node
// Evidence capture for rooms 06–12: actual WebGL screenshots, not mocked fixtures.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const base = process.env.CONFLUENCE_PREVIEW_URL ?? 'http://127.0.0.1:4173';
const output = path.resolve('validation/evidence/program-rooms');
mkdirSync(output, { recursive: true });

const chrome = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean).find(p => existsSync(p));

if (!chrome) {
  writeFileSync(path.join(output, 'error.json'), JSON.stringify({ error: 'Chrome not found' }, null, 2));
  throw new Error('A real browser is required for visual evidence');
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});

const results = [];
try {
  for (let room = 6; room <= 12; room += 1) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    const id = String(room).padStart(2, '0');
    try {
      await page.goto(base + '/?capture=1&validate=1&view=canonical&room=' + room + '&quality=balanced', { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForSelector('canvas', { timeout: 90000 });
      await page.waitForFunction(
        expected => window.__CONFLUENCE_VALIDATION__?.ready && window.__CONFLUENCE_VALIDATION__.activeRoomId === expected,
        { timeout: 90000 },
        id,
      );
      await new Promise(resolve => setTimeout(resolve, 800));
      await page.addStyleTag({ content: '.hud { visibility: hidden !important; }' });
      await page.screenshot({ path: path.join(output, 'room-' + id + '.png') });
      results.push({ room: id, captured: true, errors });
    } catch (error) {
      results.push({ room: id, captured: false, errors: [...errors, String(error)] });
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
if (results.some(item => !item.captured || item.errors.length)) process.exitCode = 1;

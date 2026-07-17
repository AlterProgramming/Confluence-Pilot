// Screenshot the running dev server with system Chrome (software WebGL).
// Usage: node scripts/screenshot.mjs [baseUrl] [room1,room2,...]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://localhost:5174';
const ROOMS = (process.argv[3] || '1,3,5,8').split(',').map((s) => s.trim());
const OUT = 'scripts/_shots';
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--window-size=1280,800',
    '--no-sandbox',
  ],
});

try {
  for (const room of ROOMS) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

    const url = `${BASE}/?capture=1&room=${room}&motion=full`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    // Give WebGL + GLB loading time to settle.
    await new Promise((r) => setTimeout(r, 6000));

    const file = `${OUT}/room-${String(room).padStart(2, '0')}.png`;
    await page.screenshot({ path: file });
    console.log(`room ${room}: ${file}  ${errors.length ? 'ERRORS: ' + errors.slice(0, 4).join(' | ') : '(no console errors)'}`);
    await page.close();
  }
} finally {
  await browser.close();
}

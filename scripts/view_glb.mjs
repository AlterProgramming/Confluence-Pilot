// Render a single GLB in isolation (Google model-viewer) so an asset can be
// judged on its own before it's placed in a scene.
// Usage: node scripts/view_glb.mjs [baseUrl] /assets/foo.glb [/assets/bar.glb ...]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const args = process.argv.slice(2);
const BASE = args[0]?.startsWith('http') ? args.shift() : 'http://localhost:5174';
const SRCS = args;
const OUT = 'scripts/_shots';
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});

try {
  for (const src of SRCS) {
    const name = src.split('/').pop().replace(/\.glb$/, '');
    const page = await browser.newPage();
    await page.setViewport({ width: 820, height: 820, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}/_glbviewer.html?src=${encodeURIComponent(src)}`, { waitUntil: 'networkidle2', timeout: 60000 });
    // Wait for the three.js loader to signal ready (or time out).
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          if (window.__ready) return resolve();
          const t = setInterval(() => {
            if (window.__ready) {
              clearInterval(t);
              resolve();
            }
          }, 200);
          setTimeout(() => {
            clearInterval(t);
            resolve();
          }, 20000);
        }),
    );
    await new Promise((r) => setTimeout(r, 1500));
    const loadErr = await page.evaluate(() => window.__err || null);
    const file = `${OUT}/glb-${name}.png`;
    await page.screenshot({ path: file });
    console.log(`${src} -> ${file}  ${loadErr ? 'LOAD-ERR: ' + loadErr : errors.length ? 'ERR: ' + errors.slice(0, 2).join(' | ') : 'ok'}`);
    await page.close();
  }
} finally {
  await browser.close();
}

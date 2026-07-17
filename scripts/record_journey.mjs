// Record the room journey to video (the igloo.inc "play a pre-render" approach).
// Runs headed Chrome (real GPU) at high quality, records a scripted walk through
// the rooms via page.screencast, and writes an MP4 you can play / later scrub.
//
// Usage: node scripts/record_journey.mjs [baseUrl] [startRoom] [numHops]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:4173';
const START = process.argv[3] || '1';
const HOPS = Number(process.argv[4] || 7);
const OUT = 'validation/render';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false, // real GPU
  args: ['--window-size=1600,900', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--hide-scrollbars'],
  defaultViewport: { width: 1600, height: 900 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

// capture mode auto-starts; quality=high for the richest render, motion=full so
// transitions animate fully.
await page.goto(`${BASE}/?capture=1&room=${START}&quality=high&motion=full`, { waitUntil: 'networkidle2', timeout: 60000 });
await page.bringToFront();
await sleep(5000); // load + settle

const file = `${OUT}/journey.mp4`;
const recorder = await page.screencast({ path: file });

await sleep(2600); // dwell on the first room
for (let i = 0; i < HOPS; i += 1) {
  await page.keyboard.press('ArrowUp'); // next room
  await sleep(3200); // transition + dwell
}
await sleep(1600);

await recorder.stop();
await browser.close();
console.log(`recorded ${HOPS + 1} rooms -> ${file}  ${errors.length ? 'ERR: ' + errors.slice(0, 2).join(' | ') : '(clean)'}`);

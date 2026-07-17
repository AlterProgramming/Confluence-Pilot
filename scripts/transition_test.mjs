// Drive a real room-to-room transition and capture frames through the swap.
// Usage: node scripts/transition_test.mjs [baseUrl] [fromRoom] [dir]
//   dir: 'up' (next) | 'down' (previous)
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://localhost:5174';
const FROM = process.argv[3] || '4';
const DIR = process.argv[4] || 'up';
const KEY = DIR === 'down' ? 'ArrowDown' : 'ArrowUp';
const OUT = 'scripts/_shots';
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--window-size=1280,800'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  // Headless defaults to reduce-motion (0.12s snap); emulate a normal user so we
  // capture the real ~1.4s glide + transition conduit.
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

  // capture mode auto-starts; motion=full so the transition actually animates
  await page.goto(`${BASE}/?capture=1&room=${FROM}&motion=full`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(6000); // let the scene load + settle

  await page.screenshot({ path: `${OUT}/trans-0-before.png` });
  await page.keyboard.press(KEY); // requestRoom(+1 / -1) -> starts a transition

  const marks = [350, 750, 1150, 1700];
  let prev = 0;
  for (const t of marks) {
    await sleep(t - prev);
    prev = t;
    await page.screenshot({ path: `${OUT}/trans-${t}.png` });
  }
  console.log(`transition ${FROM} ${DIR}: captured before + ${marks.join(',')}ms  ${errors.length ? 'ERR: ' + errors.slice(0, 3).join(' | ') : '(no errors)'}`);
  await page.close();
} finally {
  await browser.close();
}

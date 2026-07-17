// Headed real-GPU screenshot of one or more rooms via the ?capture ready signal.
// Usage: node scripts/shot_headed.mjs <baseUrl> <room1,room2,...> [view]
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://localhost:5177';
const ROOMS = (process.argv[3] || '5').split(',').map((s) => s.trim());
const VIEW = process.argv[4] || 'canonical';
const OUT = 'scripts/_shots';
mkdirSync(OUT, { recursive: true });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  args: ['--window-size=1456,916', '--no-sandbox'],
});
try {
  for (const room of ROOMS) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    const q = new URLSearchParams({ capture: '1', validate: '1', room: String(Number(room)), quality: 'balanced', view: VIEW });
    await page.goto(`${BASE}/?${q}`, { waitUntil: 'networkidle2', timeout: 90_000 });
    const id = String(Number(room)).padStart(2, '0');
    await page.waitForFunction(
      (rid) => { const s = window.__CONFLUENCE_VALIDATION__; return Boolean(s?.ready && s.activeRoomId === rid); },
      { timeout: 90_000 }, id,
    );
    await delay(1400); // let motes/idle settle + a few frames render
    await page.addStyleTag({ content: '.hud { visibility: hidden !important; }' });
    await delay(150);
    const file = `${OUT}/headed-room-${id}.png`;
    await page.screenshot({ path: file, captureBeyondViewport: false });
    console.log(`room ${id} -> ${file}`);
    await page.close();
  }
} finally {
  await browser.close();
}

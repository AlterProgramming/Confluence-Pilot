// Record the room journey to video (the igloo.inc "play a pre-render" approach).
// Runs headed Chrome (real GPU) at balanced render quality, records a scripted walk through
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
const ROOM_DWELL_MS = 3200;
const FIRST_ROOM_DWELL_MS = 2600;
const STABILITY_FRAME_COUNT = 120;
const STABLE_P95_MS = 34;
const STABLE_WORST_MS = 90;
const STABLE_RETRIES = 8;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false, // real GPU
  args: [
    '--window-size=1600,900',
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
    '--hide-scrollbars',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=CalculateNativeWinOcclusion',
  ],
  defaultViewport: { width: 1600, height: 900 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

// render=1 performs full visual warmup before recording; balanced is the
// quality-gate target for stable 30fps playback.
await page.goto(`${BASE}/?capture=1&validate=1&render=1&room=${START}&quality=balanced&motion=full`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.bringToFront();
await page.waitForFunction(
  () => window.__CONFLUENCE_RENDER_READY__?.ready === true,
  { timeout: 120000 },
);
await sleep(900); // final GPU upload/first-frame settle after warmup

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
}

async function sampleStability(label) {
  const sample = await page.evaluate(
    ({ frameCount, sampleLabel }) => new Promise((resolve) => {
    const frames = [];
    let last = performance.now();
    const tick = (t) => {
      frames.push(t - last);
      last = t;
      if (frames.length >= frameCount) {
        const dts = frames.filter((value) => value > 0 && value < 2000).sort((a, b) => a - b);
        resolve({
          label: sampleLabel,
          frames: dts.length,
          p95ms: dts.length ? dts[Math.min(dts.length - 1, Math.floor(dts.length * 0.95))] : 0,
          worstMs: dts[dts.length - 1] ?? 0,
          below30: dts.filter((value) => value > 33.3).length,
        });
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }),
    { frameCount: STABILITY_FRAME_COUNT, sampleLabel: label },
  );

  return {
    ...sample,
    p95ms: Math.round(sample.p95ms * 10) / 10,
    worstMs: Math.round(sample.worstMs * 10) / 10,
  };
}

async function waitForRoomSettled(roomNumber, phase) {
  await waitForRoomReady(roomNumber);

  let lastSample = null;
  for (let attempt = 1; attempt <= STABLE_RETRIES; attempt += 1) {
    lastSample = await sampleStability(`${phase}-room-${roomNumber}-attempt-${attempt}`);
    if (lastSample.p95ms <= STABLE_P95_MS && lastSample.worstMs <= STABLE_WORST_MS) {
      console.log(`${phase} room ${roomNumber} stable p95=${lastSample.p95ms}ms worst=${lastSample.worstMs}ms`);
      return lastSample;
    }
    await sleep(500);
  }

  throw new Error(
    `${phase} room ${roomNumber} did not stabilize: p95=${lastSample?.p95ms}ms worst=${lastSample?.worstMs}ms`,
  );
}

async function waitForRoomReady(roomNumber) {
  await page.waitForFunction(
    (expectedRoom) => {
      const validation = window.__CONFLUENCE_VALIDATION__;
      const render = window.__CONFLUENCE_RENDER_READY__;
      return validation?.ready === true
        && render?.ready === true
        && validation.activeRoomIndex === expectedRoom - 1
        && validation.isTransitioning === false
        && validation.assetsLoading === false;
    },
    { timeout: 120000 },
    roomNumber,
  );
}

async function goToRoom(roomNumber) {
  await page.evaluate((nextRoom) => {
    window.__CONFLUENCE_VALIDATION__?.goToRoomNumber(nextRoom);
  }, roomNumber);
}

async function walkJourney({ phase, recordDwell }) {
  const samples = [];
  let current = Number(START);
  if (recordDwell) {
    await waitForRoomReady(current);
  } else {
    samples.push(await waitForRoomSettled(current, phase));
  }
  if (recordDwell) await sleep(FIRST_ROOM_DWELL_MS);

  for (let i = 0; i < HOPS; i += 1) {
    const next = current + 1;
    await goToRoom(next);
    if (recordDwell) {
      await waitForRoomReady(next);
    } else {
      samples.push(await waitForRoomSettled(next, phase));
    }
    if (recordDwell) await sleep(ROOM_DWELL_MS);
    current = next;
  }

  return samples;
}

// Preflight once before recording. This forces per-room scene load, decode,
// material preparation, shader compile, and a stable standalone dwell before
// the video capture starts.
const preflightSamples = await walkJourney({ phase: 'preflight', recordDwell: false });
await goToRoom(Number(START));
await waitForRoomSettled(Number(START), 'reset');
await sleep(1200);

const file = `${OUT}/journey.mp4`;
const recorder = await page.screencast({ path: file });

const recordingSamples = await walkJourney({ phase: 'recording', recordDwell: true });
await sleep(1600);

await recorder.stop();
await browser.close();
const allSamples = [...preflightSamples, ...recordingSamples];
const p95s = allSamples.map((sample) => sample.p95ms).sort((a, b) => a - b);
const worsts = allSamples.map((sample) => sample.worstMs).sort((a, b) => a - b);
console.log(
  `recorded ${HOPS + 1} rooms -> ${file}`,
  `stability p95=${percentile(p95s, 0.95)}ms`,
  `worst=${worsts[worsts.length - 1] ?? 0}ms`,
  errors.length ? `ERR: ${errors.slice(0, 2).join(' | ')}` : '(clean)',
);

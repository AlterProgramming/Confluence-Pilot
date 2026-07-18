// Realtime performance harness. Runs the production app in headed Chrome by
// default (real GPU) and records per-frame times, long tasks, preparation time,
// and exact transition settle time. It repeats the same route so first-pass and
// replay behavior can be compared directly.
//
// Usage: node scripts/perf_harness.mjs [baseUrl] [startRoom]
// Optional env: CHROME_PATH, HEADLESS=1, PERF_ROUTE=5,6,7,8,9,8,7,6,5,4,
// PERF_WIDTH=960, PERF_HEIGHT=540, PERF_SKIP_VIOLENT=1
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:4173';
const START = Math.max(1, Math.min(12, Number.parseInt(process.argv[3] || '4', 10) || 4));
const HEADLESS = process.env.HEADLESS === '1';
const WIDTH = Math.max(480, Number.parseInt(process.env.PERF_WIDTH || '1600', 10) || 1600);
const HEIGHT = Math.max(270, Number.parseInt(process.env.PERF_HEIGHT || '900', 10) || 900);
const SKIP_VIOLENT = process.env.PERF_SKIP_VIOLENT === '1';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function defaultRoute(start) {
  const direction = start <= 7 ? 1 : -1;
  const outward = [];
  for (let step = 1; step <= 5; step += 1) {
    const room = start + step * direction;
    if (room >= 1 && room <= 12) outward.push(room);
  }
  if (!outward.length) return [start];
  return [...outward, ...outward.slice(0, -1).reverse(), start];
}

const ROUTE = process.env.PERF_ROUTE
  ? process.env.PERF_ROUTE.split(',').map((value) => Number.parseInt(value.trim(), 10)).filter((room) => room >= 1 && room <= 12)
  : defaultRoute(START);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: HEADLESS,
  args: [
    `--window-size=${WIDTH},${HEIGHT}`,
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
    '--enable-zero-copy',
    '--enable-unsafe-swiftshader',
  ],
  defaultViewport: { width: WIDTH, height: HEIGHT },
});

const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

// Confluence intentionally continues preloading neighbouring rooms after first
// paint, so networkidle is not an application-readiness signal. Wait for DOM
// startup, then rely on the app's validation bridge below.
await page.goto(`${BASE}/?capture=1&validate=1&room=${START}&motion=full`, {
  waitUntil: 'domcontentloaded',
  timeout: 30_000,
});
await page.bringToFront();
await page.waitForFunction(
  (room) => {
    const state = window.__CONFLUENCE_VALIDATION__;
    return Boolean(state?.ready && state.activeRoomIndex === room - 1);
  },
  { timeout: 120_000 },
  START,
);
await sleep(1200);

const gpu = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const gl = canvas && (canvas.getContext('webgl2') || canvas.getContext('webgl'));
  if (!gl) return 'no-webgl';
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  return debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : 'unknown';
});

await page.evaluate(() => {
  window.__perf = { frames: [], marks: [], longTasks: [] };
  let last = performance.now();
  const tick = (time) => {
    window.__perf.frames.push({ t: time, dt: time - last });
    last = time;
    window.__perf._raf = requestAnimationFrame(tick);
  };
  window.__perf._raf = requestAnimationFrame(tick);
  window.__mark = (name) => window.__perf.marks.push({ name, t: performance.now() });
  if ('PerformanceObserver' in window) {
    try {
      window.__perf._observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__perf.longTasks.push({ t: entry.startTime, duration: entry.duration });
        }
      });
      window.__perf._observer.observe({ type: 'longtask', buffered: true });
    } catch {
      // Long Tasks are optional; frame timing remains authoritative.
    }
  }
});

const mark = (name) => page.evaluate((value) => window.__mark(value), name);

async function navigate(room, label) {
  const start = await page.evaluate(() => performance.now());
  await mark(`${label}-start`);
  await page.evaluate((roomNumber) => window.__CONFLUENCE_VALIDATION__?.goToRoomNumber(roomNumber), room);
  await page.waitForFunction(
    (roomNumber) => {
      const state = window.__CONFLUENCE_VALIDATION__;
      return Boolean(state?.ready && state.activeRoomIndex === roomNumber - 1 && !state.isPreparing && !state.isTransitioning);
    },
    { timeout: 45_000 },
    room,
  );
  const end = await page.evaluate(() => performance.now());
  await mark(`${label}-end`);
  return { label, room, settleMs: +(end - start).toFixed(1) };
}

await mark('idle-start');
await sleep(3000);
await mark('idle-end');

const transitions = [];
await mark('first-pass-start');
for (let index = 0; index < ROUTE.length; index += 1) {
  transitions.push({ pass: 'first', ...(await navigate(ROUTE[index], `first-${index + 1}-room-${ROUTE[index]}`)) });
}
await mark('first-pass-end');

await sleep(1200);
await mark('replay-pass-start');
for (let index = 0; index < ROUTE.length; index += 1) {
  transitions.push({ pass: 'replay', ...(await navigate(ROUTE[index], `replay-${index + 1}-room-${ROUTE[index]}`)) });
}
await mark('replay-pass-end');

if (!SKIP_VIOLENT) {
  await mark('violent-start');
  for (let index = 0; index < 24; index += 1) {
    await page.keyboard.press(index % 8 < 6 ? 'ArrowUp' : 'ArrowDown');
    await sleep(110);
  }
  await page.waitForFunction(
    () => {
      const state = window.__CONFLUENCE_VALIDATION__;
      return Boolean(state?.ready && !state.isPreparing && !state.isTransitioning);
    },
    { timeout: 45_000 },
  );
  await sleep(600);
  await mark('violent-end');
}

const data = await page.evaluate(() => {
  cancelAnimationFrame(window.__perf._raf);
  window.__perf._observer?.disconnect();
  return {
    ...window.__perf,
    resources: performance.getEntriesByType('resource').map((entry) => ({
      name: entry.name,
      duration: entry.duration,
      transferSize: entry.transferSize,
      decodedBodySize: entry.decodedBodySize,
    })),
  };
});
await browser.close();

function percentile(values, p) {
  if (!values.length) return 0;
  return values[Math.min(values.length - 1, Math.floor(p * values.length))];
}

function stats(frames) {
  const dts = frames.map((frame) => frame.dt).filter((dt) => dt > 0 && dt < 2000).sort((a, b) => a - b);
  const n = dts.length;
  if (!n) return null;
  const avg = dts.reduce((sum, value) => sum + value, 0) / n;
  const budgetDebt = dts.reduce((sum, value) => sum + Math.max(0, value - 16.7), 0);
  return {
    frames: n,
    avgFps: +(1000 / avg).toFixed(1),
    minFps: +(1000 / dts[n - 1]).toFixed(1),
    p50ms: +percentile(dts, 0.5).toFixed(1),
    p95ms: +percentile(dts, 0.95).toFixed(1),
    p99ms: +percentile(dts, 0.99).toFixed(1),
    worstMs: +dts[n - 1].toFixed(1),
    below60: dts.filter((dt) => dt > 16.7).length,
    below30: dts.filter((dt) => dt > 33.3).length,
    hitches50: dts.filter((dt) => dt > 50).length,
    hitches100: dts.filter((dt) => dt > 100).length,
    jankRatio: +(dts.filter((dt) => dt > 33.3).length / n).toFixed(4),
    frameBudgetDebtMs: +budgetDebt.toFixed(1),
  };
}

const markTime = (name) => data.marks.find((entry) => entry.name === name)?.t;
const between = (startName, endName) => {
  const start = markTime(startName);
  const end = markTime(endName);
  return data.frames.filter((frame) => frame.t >= start && frame.t <= end);
};

const transitionReports = transitions.map((transition) => ({
  ...transition,
  frames: stats(between(`${transition.label}-start`, `${transition.label}-end`)),
}));

function settleSummary(pass) {
  const values = transitionReports.filter((item) => item.pass === pass).map((item) => item.settleMs).sort((a, b) => a - b);
  if (!values.length) return null;
  return {
    transitions: values.length,
    medianMs: +percentile(values, 0.5).toFixed(1),
    p95Ms: +percentile(values, 0.95).toFixed(1),
    worstMs: +values[values.length - 1].toFixed(1),
  };
}

const totalTransferred = data.resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
const totalDecoded = data.resources.reduce((sum, entry) => sum + (entry.decodedBodySize || 0), 0);
const report = {
  generatedAt: new Date().toISOString(),
  gpu,
  headed: !HEADLESS,
  viewport: { width: WIDTH, height: HEIGHT },
  startRoom: START,
  route: ROUTE,
  errors: errors.slice(0, 10),
  idle: stats(between('idle-start', 'idle-end')),
  firstPass: stats(between('first-pass-start', 'first-pass-end')),
  replayPass: stats(between('replay-pass-start', 'replay-pass-end')),
  violentSwipe: SKIP_VIOLENT ? null : stats(between('violent-start', 'violent-end')),
  firstPassSettle: settleSummary('first'),
  replayPassSettle: settleSummary('replay'),
  longTasks: {
    count: data.longTasks.length,
    totalMs: +data.longTasks.reduce((sum, task) => sum + task.duration, 0).toFixed(1),
    worstMs: +(Math.max(0, ...data.longTasks.map((task) => task.duration))).toFixed(1),
  },
  network: {
    resources: data.resources.length,
    transferMB: +(totalTransferred / 1024 / 1024).toFixed(2),
    decodedMB: +(totalDecoded / 1024 / 1024).toFixed(2),
  },
  transitions: transitionReports,
};

mkdirSync('validation/perf', { recursive: true });
writeFileSync('validation/perf/report.json', JSON.stringify(report, null, 2));
console.log('GPU:', gpu, '| errors:', errors.length, '| viewport:', `${WIDTH}x${HEIGHT}`, '| route:', ROUTE.join(' -> '));
for (const key of ['idle', 'firstPass', 'replayPass', 'violentSwipe']) {
  console.log(key.padEnd(14), JSON.stringify(report[key]));
}
console.log('settle first  ', JSON.stringify(report.firstPassSettle));
console.log('settle replay ', JSON.stringify(report.replayPassSettle));
console.log('long tasks    ', JSON.stringify(report.longTasks));

// Realtime performance harness. Runs the app in HEADED Chrome (real GPU, not
// SwiftShader) and records per-frame times via an injected rAF probe across
// three phases: idle, sequential navigation, and a violent-swipe stress.
// Reports FPS + frame-time percentiles + dropped-frame counts per phase.
//
// Usage: node scripts/perf_harness.mjs [baseUrl] [startRoom]
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:4173';
const START = process.argv[3] || '4';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false, // headed => real discrete GPU, not software WebGL
  args: ['--window-size=1600,900', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-zero-copy'],
  defaultViewport: { width: 1600, height: 900 },
});

const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

await page.goto(`${BASE}/?capture=1&room=${START}&motion=full`, { waitUntil: 'networkidle2', timeout: 60000 });
await page.bringToFront();
await sleep(4500); // load + settle

const gpu = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
  if (!gl) return 'no-webgl';
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'unknown';
});

// install per-frame collector + phase marks
await page.evaluate(() => {
  window.__perf = { frames: [], marks: [] };
  let last = performance.now();
  const tick = (t) => {
    window.__perf.frames.push({ t, dt: t - last });
    last = t;
    window.__perf._raf = requestAnimationFrame(tick);
  };
  window.__perf._raf = requestAnimationFrame(tick);
  window.__mark = (name) => window.__perf.marks.push({ name, t: performance.now() });
});
const mark = (n) => page.evaluate((name) => window.__mark(name), n);

// Phase 1 — idle
await mark('idle-start'); await sleep(3000); await mark('idle-end');
// Phase 2 — sequential navigation (up 5, down 5), waiting for each transition
await mark('seq-start');
for (let i = 0; i < 5; i += 1) { await page.keyboard.press('ArrowUp'); await sleep(2200); }
for (let i = 0; i < 5; i += 1) { await page.keyboard.press('ArrowDown'); await sleep(2200); }
await mark('seq-end');
// Phase 3 — violent swipe (rapid presses, no settle)
await mark('violent-start');
for (let i = 0; i < 24; i += 1) { await page.keyboard.press(i % 8 < 6 ? 'ArrowUp' : 'ArrowDown'); await sleep(110); }
await sleep(3500);
await mark('violent-end');

const data = await page.evaluate(() => {
  cancelAnimationFrame(window.__perf._raf);
  return window.__perf;
});
await browser.close();

function stats(frames) {
  const dts = frames.map((f) => f.dt).filter((d) => d > 0 && d < 2000).sort((a, b) => a - b);
  const n = dts.length;
  if (!n) return null;
  const pct = (p) => dts[Math.min(n - 1, Math.floor(p * n))];
  const avg = dts.reduce((a, b) => a + b, 0) / n;
  return {
    frames: n,
    avgFps: +(1000 / avg).toFixed(1),
    minFps: +(1000 / dts[n - 1]).toFixed(1),
    p50ms: +pct(0.5).toFixed(1),
    p95ms: +pct(0.95).toFixed(1),
    p99ms: +pct(0.99).toFixed(1),
    worstMs: +dts[n - 1].toFixed(1),
    below60: dts.filter((d) => d > 16.7).length,
    below30: dts.filter((d) => d > 33.3).length,
  };
}
const between = (a, b) => {
  const s = data.marks.find((m) => m.name === a)?.t;
  const e = data.marks.find((m) => m.name === b)?.t;
  return data.frames.filter((f) => f.t >= s && f.t <= e);
};

const report = {
  gpu,
  errors: errors.slice(0, 5),
  idle: stats(between('idle-start', 'idle-end')),
  sequentialNav: stats(between('seq-start', 'seq-end')),
  violentSwipe: stats(between('violent-start', 'violent-end')),
};
mkdirSync('validation/perf', { recursive: true });
writeFileSync('validation/perf/report.json', JSON.stringify(report, null, 2));
console.log('GPU:', gpu, '| errors:', errors.length);
for (const k of ['idle', 'sequentialNav', 'violentSwipe']) {
  console.log(k.padEnd(14), JSON.stringify(report[k]));
}

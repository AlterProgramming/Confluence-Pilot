// Realtime performance harness. Runs the app in HEADED Chrome (real GPU, not
// SwiftShader) and records per-frame times via an injected rAF probe across
// three phases: idle, sequential navigation, and a violent-swipe stress.
// Reports FPS + frame-time percentiles + dropped-frame counts per phase.
//
// Usage: node scripts/perf_harness.mjs [baseUrl] [startRoom]
import puppeteer from 'puppeteer-core';
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:4173';
const START = process.argv[3] || '4';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOT = process.cwd();

function mb(bytes) {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

function walkAssets(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walkAssets(full));
    } else if (stat.isFile()) {
      files.push({
        path: path.relative(ROOT, full).replaceAll(path.sep, '/'),
        extension: path.extname(name).toLowerCase() || '(none)',
        bytes: stat.size,
      });
    }
  }
  return files;
}

function staticAssetInventory() {
  const files = walkAssets(path.join(ROOT, 'public', 'assets'));
  const byExtension = Object.values(files.reduce((acc, file) => {
    acc[file.extension] ??= { extension: file.extension, count: 0, bytes: 0, mb: 0 };
    acc[file.extension].count += 1;
    acc[file.extension].bytes += file.bytes;
    acc[file.extension].mb = mb(acc[file.extension].bytes);
    return acc;
  }, {})).sort((left, right) => right.bytes - left.bytes);

  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  return {
    total: { count: files.length, bytes: totalBytes, mb: mb(totalBytes) },
    byExtension,
    largest: files
      .slice()
      .sort((left, right) => right.bytes - left.bytes)
      .slice(0, 15)
      .map((file) => ({ ...file, mb: mb(file.bytes) })),
  };
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false, // headed => real discrete GPU, not software WebGL
  args: [
    '--window-size=1600,900',
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
    '--enable-zero-copy',
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

await page.goto(`${BASE}/?capture=1&render=1&room=${START}&quality=balanced&motion=full`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.bringToFront();
await page.waitForFunction(
  () => window.__CONFLUENCE_RENDER_READY__?.ready === true,
  { timeout: 120000 },
);
await sleep(900); // final GPU upload/first-frame settle after warmup

const assetLoad = await page.evaluate(() => {
  const resources = performance.getEntriesByType('resource')
    .filter((entry) => entry.name.includes('/assets/'))
    .map((entry) => ({
      name: new URL(entry.name).pathname,
      initiatorType: entry.initiatorType,
      startTime: entry.startTime,
      responseEnd: entry.responseEnd,
      duration: entry.duration,
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,
    }));
  const totals = resources.reduce((acc, entry) => {
    acc.transferSize += entry.transferSize || 0;
    acc.encodedBodySize += entry.encodedBodySize || 0;
    acc.decodedBodySize += entry.decodedBodySize || 0;
    acc.latestResponseEnd = Math.max(acc.latestResponseEnd, entry.responseEnd || 0);
    return acc;
  }, { transferSize: 0, encodedBodySize: 0, decodedBodySize: 0, latestResponseEnd: 0 });
  return {
    count: resources.length,
    totals,
    latestResponseEndMs: Math.round(totals.latestResponseEnd * 10) / 10,
    largestDecoded: resources
      .slice()
      .sort((left, right) => (right.decodedBodySize || 0) - (left.decodedBodySize || 0))
      .slice(0, 15),
    slowest: resources
      .slice()
      .sort((left, right) => (right.duration || 0) - (left.duration || 0))
      .slice(0, 15),
  };
});
const memoryAtReady = await page.metrics();

const gpu = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
  if (!gl) return 'no-webgl';
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'unknown';
});

// install per-frame collector + phase marks
await page.evaluate(() => {
  window.__perf = { frames: [], marks: [], longTasks: [], visibility: [{ state: document.visibilityState, t: performance.now() }] };
  document.addEventListener('visibilitychange', () => {
    window.__perf.visibility.push({ state: document.visibilityState, t: performance.now() });
  });
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__perf.longTasks.push({
            name: entry.name,
            startTime: entry.startTime,
            duration: entry.duration,
          });
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
      window.__perf._longTaskObserver = observer;
    } catch {
      // Long task attribution is best-effort and unavailable in some contexts.
    }
  }
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
for (let i = 0; i < 5; i += 1) { await mark(`seq-up-${i + 1}`); await page.keyboard.press('ArrowUp'); await sleep(2200); }
for (let i = 0; i < 5; i += 1) { await mark(`seq-down-${i + 1}`); await page.keyboard.press('ArrowDown'); await sleep(2200); }
await mark('seq-end');
// Phase 3 — violent swipe (rapid presses, no settle)
await mark('violent-start');
for (let i = 0; i < 24; i += 1) {
  await mark(`violent-${i + 1}`);
  await page.keyboard.press(i % 8 < 6 ? 'ArrowUp' : 'ArrowDown');
  await sleep(110);
}
await sleep(3500);
await mark('violent-end');

const data = await page.evaluate(() => {
  cancelAnimationFrame(window.__perf._raf);
  window.__perf._longTaskObserver?.disconnect();
  return window.__perf;
});
const memoryAfterRun = await page.metrics();
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
const phaseWindow = (a, b) => {
  const s = data.marks.find((m) => m.name === a)?.t;
  const e = data.marks.find((m) => m.name === b)?.t;
  return { s, e };
};
const nearestMark = (t) => {
  let best = data.marks[0];
  for (const mark of data.marks) {
    if (mark.t > t) break;
    best = mark;
  }
  return best?.name ?? 'unknown';
};
const longFrames = (a, b, limit = 10) => {
  const { s, e } = phaseWindow(a, b);
  return data.frames
    .filter((f) => f.t >= s && f.t <= e && f.dt > 80)
    .sort((left, right) => right.dt - left.dt)
    .slice(0, limit)
    .map((frame) => ({
      dt: +frame.dt.toFixed(1),
      atMs: +(frame.t - s).toFixed(1),
      afterMark: nearestMark(frame.t),
    }));
};
const longTasks = (a, b, limit = 10) => {
  const { s, e } = phaseWindow(a, b);
  return (data.longTasks ?? [])
    .filter((task) => task.startTime >= s && task.startTime <= e)
    .sort((left, right) => right.duration - left.duration)
    .slice(0, limit)
    .map((task) => ({
      duration: +task.duration.toFixed(1),
      atMs: +(task.startTime - s).toFixed(1),
      name: task.name,
      afterMark: nearestMark(task.startTime),
    }));
};
const visibilityEvents = (a, b) => {
  const { s, e } = phaseWindow(a, b);
  return (data.visibility ?? [])
    .filter((event) => event.t >= s && event.t <= e)
    .map((event) => ({
      state: event.state,
      atMs: +(event.t - s).toFixed(1),
      afterMark: nearestMark(event.t),
    }));
};

const report = {
  gpu,
  errors: errors.slice(0, 5),
  assets: {
    static: staticAssetInventory(),
    runtime: {
      ...assetLoad,
      totalsMb: {
        transfer: mb(assetLoad.totals.transferSize),
        encoded: mb(assetLoad.totals.encodedBodySize),
        decoded: mb(assetLoad.totals.decodedBodySize),
      },
    },
  },
  memory: {
    atRenderReady: memoryAtReady,
    afterRun: memoryAfterRun,
    delta: {
      JSHeapUsedSize: memoryAfterRun.JSHeapUsedSize - memoryAtReady.JSHeapUsedSize,
      JSHeapTotalSize: memoryAfterRun.JSHeapTotalSize - memoryAtReady.JSHeapTotalSize,
      Nodes: memoryAfterRun.Nodes - memoryAtReady.Nodes,
    },
  },
  idle: stats(between('idle-start', 'idle-end')),
  sequentialNav: stats(between('seq-start', 'seq-end')),
  violentSwipe: stats(between('violent-start', 'violent-end')),
  longFrames: {
    sequentialNav: longFrames('seq-start', 'seq-end'),
    violentSwipe: longFrames('violent-start', 'violent-end'),
  },
  longTasks: {
    sequentialNav: longTasks('seq-start', 'seq-end'),
    violentSwipe: longTasks('violent-start', 'violent-end'),
  },
  visibility: {
    sequentialNav: visibilityEvents('seq-start', 'seq-end'),
    violentSwipe: visibilityEvents('violent-start', 'violent-end'),
  },
};
const thresholds = {
  sequentialP95Ms: 33.3,
  sequentialP99Ms: 80,
  sequentialWorstMs: 160,
  violentWorstMs: 250,
};
const failures = [];
if (!report.sequentialNav || report.sequentialNav.p95ms > thresholds.sequentialP95Ms) {
  failures.push(`sequentialNav.p95ms ${report.sequentialNav?.p95ms ?? 'missing'} > ${thresholds.sequentialP95Ms}`);
}
if (!report.sequentialNav || report.sequentialNav.p99ms > thresholds.sequentialP99Ms) {
  failures.push(`sequentialNav.p99ms ${report.sequentialNav?.p99ms ?? 'missing'} > ${thresholds.sequentialP99Ms}`);
}
if (!report.sequentialNav || report.sequentialNav.worstMs > thresholds.sequentialWorstMs) {
  failures.push(`sequentialNav.worstMs ${report.sequentialNav?.worstMs ?? 'missing'} > ${thresholds.sequentialWorstMs}`);
}
if (!report.violentSwipe || report.violentSwipe.worstMs > thresholds.violentWorstMs) {
  failures.push(`violentSwipe.worstMs ${report.violentSwipe?.worstMs ?? 'missing'} > ${thresholds.violentWorstMs}`);
}
report.thresholds = thresholds;
report.failures = failures;
mkdirSync('validation/perf', { recursive: true });
writeFileSync('validation/perf/report.json', JSON.stringify(report, null, 2));
console.log('GPU:', gpu, '| errors:', errors.length);
console.log(
  'assets:',
  `${report.assets.runtime.count} runtime resources`,
  `transfer=${report.assets.runtime.totalsMb.transfer}MB`,
  `decoded=${report.assets.runtime.totalsMb.decoded}MB`,
  `latest=${report.assets.runtime.latestResponseEndMs}ms`,
  `static=${report.assets.static.total.mb}MB`,
);
console.log(
  'memory:',
  `heapReady=${mb(report.memory.atRenderReady.JSHeapUsedSize)}MB`,
  `heapAfter=${mb(report.memory.afterRun.JSHeapUsedSize)}MB`,
  `heapDelta=${mb(report.memory.delta.JSHeapUsedSize)}MB`,
);
for (const k of ['idle', 'sequentialNav', 'violentSwipe']) {
  console.log(k.padEnd(14), JSON.stringify(report[k]));
}
if (failures.length) {
  console.error('Performance gate failed:', failures.join(' | '));
  process.exit(1);
}

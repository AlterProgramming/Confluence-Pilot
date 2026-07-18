// Realtime performance harness. Runs the production app in headed Chrome by
// default and records frame timing, long tasks, exact transition settle time,
// and direct WebGL workload counters. It repeats the route so cold and replay
// behavior can be compared separately.
//
// Usage: node scripts/perf_harness.mjs [baseUrl] [startRoom]
// Optional env: CHROME_PATH, HEADLESS=1, PERF_ROUTE=5,6,7,8,9,8,7,6,5,4,
// PERF_WIDTH=960, PERF_HEIGHT=540, PERF_SKIP_VIOLENT=1
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:4173';
const START = Math.max(1, Math.min(12, Number.parseInt(process.argv[3] || '4', 10) || 4);
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

// Install before application code creates its WebGL context. These counters are
// independent of renderer speed and therefore remain useful on noisy CI GPUs.
await page.evaluateOnNewDocument(() => {
  const patchedContexts = new WeakSet();
  const counters = {};

  const reset = () => {
    counters.drawCalls = 0;
    counters.triangles = 0;
    counters.bufferUploads = 0;
    counters.bufferUploadBytes = 0;
    counters.textureUploads = 0;
    counters.shaderCompiles = 0;
    counters.programLinks = 0;
  };
  reset();

  const byteLength = (value) => {
    if (typeof value === 'number') return Math.max(0, value);
    if (ArrayBuffer.isView(value)) return value.byteLength;
    if (value instanceof ArrayBuffer) return value.byteLength;
    return 0;
  };

  const primitiveTriangles = (mode, count) => {
    if (mode === 0x0004) return Math.floor(count / 3); // TRIANGLES
    if (mode === 0x0005 || mode === 0x0006) return Math.max(0, count - 2); // STRIP/FAN
    return 0;
  };

  const patchContext = (gl) => {
    if (!gl || typeof gl.drawElements !== 'function' || patchedContexts.has(gl)) return gl;
    patchedContexts.add(gl);

    const wrap = (name, before) => {
      const original = gl[name];
      if (typeof original !== 'function') return;
      try {
        gl[name] = function wrappedWebGlMethod(...args) {
          before(...args);
          return original.apply(this, args);
        };
      } catch {
        // Some browser builds expose non-writable native methods. The remaining
        // counters still provide useful evidence, so instrumentation is best-effort.
      }
    };

    wrap('drawElements', (mode, count) => {
      counters.drawCalls += 1;
      counters.triangles += primitiveTriangles(mode, count);
    });
    wrap('drawArrays', (mode, _first, count) => {
      counters.drawCalls += 1;
      counters.triangles += primitiveTriangles(mode, count);
    });
    wrap('drawElementsInstanced', (mode, count, _type, _offset, instances) => {
      const copies = Math.max(0, instances || 0);
      counters.drawCalls += 1;
      counters.triangles += primitiveTriangles(mode, count) * copies;
    });
    wrap('drawArraysInstanced', (mode, _first, count, instances) => {
      const copies = Math.max(0, instances || 0);
      counters.drawCalls += 1;
      counters.triangles += primitiveTriangles(mode, count) * copies;
    });
    wrap('bufferData', (_target, source) => {
      counters.bufferUploads += 1;
      counters.bufferUploadBytes += byteLength(source);
    });
    wrap('bufferSubData', (_target, _offset, source) => {
      counters.bufferUploads += 1;
      counters.bufferUploadBytes += byteLength(source);
    });
    wrap('texImage2D', () => {
      counters.textureUploads += 1;
    });
    wrap('texSubImage2D', () => {
      counters.textureUploads += 1;
    });
    wrap('texImage3D', () => {
      counters.textureUploads += 1;
    });
    wrap('texSubImage3D', () => {
      counters.textureUploads += 1;
    });
    wrap('compileShader', () => {
      counters.shaderCompiles += 1;
    });
    wrap('linkProgram', () => {
      counters.programLinks += 1;
    });
    return gl;
  };

  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function instrumentedGetContext(...args) {
    const context = originalGetContext.apply(this, args);
    return patchContext(context);
  };

  window.__webglPerf = {
    reset,
    snapshot: () => ({ ...counters }),
  };
});

// Confluence intentionally continues preloading neighbouring rooms after first
// paint, so networkidle and the evidence-only ready flag are not performance
// startup signals. Begin once the requested room and canvas are mounted, then
// use the original harness's fixed settle window before collecting frames.
await page.goto(`${BASE}/?capture=1&validate=1&room=${START}&motion=full`, {
  waitUntil: 'domcontentloaded',
  timeout: 30_000,
});
await page.bringToFront();
await page.waitForFunction(
  (room) => {
    const state = window.__CONFLUENCE_VALIDATION__;
    return Boolean(
      document.querySelector('canvas')
      && state?.started
      && state.activeRoomIndex === room - 1
      && !state.isTransitioning
    );
  },
  { timeout: 60_000 },
  START,
);
await sleep(4500);

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
  await page.evaluate(() => window.__webglPerf?.reset());
  const start = await page.evaluate(() => performance.now());
  await mark(`${label}-start`);
  await page.evaluate((roomNumber) => window.__CONFLUENCE_VALIDATION__?.goToRoomNumber(roomNumber), room);
  await page.waitForFunction(
    (roomNumber) => {
      const state = window.__CONFLUENCE_VALIDATION__;
      return Boolean(state && state.activeRoomIndex === roomNumber - 1 && !state.isTransitioning);
    },
    { timeout: 45_000 },
    room,
  );
  const end = await page.evaluate(() => performance.now());
  await mark(`${label}-end`);
  const gpuWork = await page.evaluate(() => window.__webglPerf?.snapshot() ?? null);
  const result = { label, room, settleMs: +(end - start).toFixed(1), gpuWork };
  console.log('transition', JSON.stringify(result));
  return result;
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
      return Boolean(state && !state.isTransitioning);
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

const transitionReports = transitions.map((transition) => {
  const frameStats = stats(between(`${transition.label}-start`, `${transition.label}-end`));
  const frameCount = frameStats?.frames || 1;
  const gpuWork = transition.gpuWork
    ? {
        ...transition.gpuWork,
        drawCallsPerFrame: +(transition.gpuWork.drawCalls / frameCount).toFixed(1),
        trianglesPerFrame: +(transition.gpuWork.triangles / frameCount).toFixed(1),
      }
    : null;
  return { ...transition, frames: frameStats, gpuWork };
});

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
const largestResources = [...data.resources]
  .sort((a, b) => (b.decodedBodySize || 0) - (a.decodedBodySize || 0))
  .slice(0, 12)
  .map((entry) => {
    let name = entry.name;
    try {
      name = new URL(entry.name).pathname;
    } catch {
      // Preserve the original resource name.
    }
    return {
      name,
      decodedMB: +((entry.decodedBodySize || 0) / 1024 / 1024).toFixed(3),
      transferMB: +((entry.transferSize || 0) / 1024 / 1024).toFixed(3),
      durationMs: +entry.duration.toFixed(1),
    };
  });

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
    largestResources,
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
console.log('cold gpu work ', JSON.stringify(report.transitions.find((item) => item.pass === 'first')?.gpuWork));
console.log('long tasks    ', JSON.stringify(report.longTasks));

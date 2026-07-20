#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer-core';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4178';
const outputDirectory = path.resolve('validation', 'composition-editor', 'motion');
mkdirSync(outputDirectory, { recursive: true });

const chromeCandidates = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const executablePath = chromeCandidates.find((candidate) => existsSync(candidate));
if (!executablePath) throw new Error('No Chrome or Chromium executable found.');

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--enable-webgl',
  ],
});

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  passed: false,
  fatalError: null,
  checks: {},
  states: [],
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const near = (left, right, tolerance = 0.08) => Math.abs(left - right) <= tolerance;
const sameTuple = (left, right, tolerance = 0.04) => Array.isArray(left)
  && Array.isArray(right)
  && left.length === right.length
  && left.every((value, index) => near(value, right[index], tolerance));

try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    if (!sessionStorage.getItem('__confluence_motion_test_initialized__')) {
      localStorage.clear();
      sessionStorage.setItem('__confluence_motion_test_initialized__', '1');
    }
  });
  await page.setViewport({ width: 1920, height: 1180, deviceScaleFactor: 1 });
  page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => report.pageErrors.push(error.message));

  const editorState = () => page.evaluate(() => window.__CONFLUENCE_EDITOR__);
  const motionState = () => page.evaluate(() => window.__CONFLUENCE_MOTION__);
  const screenshot = async (name, viewportOnly = false) => {
    const destination = path.join(outputDirectory, name);
    if (viewportOnly) {
      const viewport = await page.$('[data-testid="composition-viewport"]');
      if (!viewport) throw new Error('Composition viewport missing.');
      await viewport.screenshot({ path: destination });
    } else {
      await page.screenshot({ path: destination, captureBeyondViewport: false });
    }
    report.screenshots.push(name);
  };
  const setAxis = async (axis, value) => {
    const selector = `input[data-transform-kind="position"][data-axis="${axis}"]`;
    await page.waitForSelector(selector, { visible: true, timeout: 30_000 });
    await page.$eval(selector, (element, nextValue) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(element, String(nextValue));
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.blur();
    }, value);
    await delay(180);
  };
  const setPosition = async ([x, y, z]) => {
    await setAxis(0, x);
    await setAxis(1, y);
    await setAxis(2, z);
  };

  await page.goto(`${baseUrl}/?editor=1&capture=1&scene=room-02-achievement-forum`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(
    () => window.__CONFLUENCE_EDITOR__?.ready === true
      && window.__CONFLUENCE_EDITOR__.sceneId === 'room-02-achievement-forum'
      && window.__CONFLUENCE_MOTION__?.ready === true,
    { timeout: 90_000 },
  );
  await page.waitForSelector('[data-asset-id="character-proxy"]', { visible: true, timeout: 30_000 });
  await delay(3500);

  const initial = await editorState();
  await page.$eval('[data-asset-id="character-proxy"]', (element) => {
    element.scrollIntoView({ block: 'center' });
    element.click();
  });
  await page.waitForFunction(
    (count) => window.__CONFLUENCE_EDITOR__?.instanceCount === count + 1,
    { timeout: 20_000 },
    initial.instanceCount,
  );
  const withCharacter = await editorState();
  const character = withCharacter.instances.find((instance) => instance.assetId === 'character-proxy');
  if (!character) throw new Error('Character proxy was not added.');

  const authoredPositions = [
    [0, 0, 5.8],
    [-3.6, 0, 4.5],
    [-1.6, 0, 1.2],
    [0, 0, -2.5],
    [0, 0, -5.2],
  ];
  await setPosition(authoredPositions[0]);
  await page.click('[data-testid="create-motion-track"]');
  await page.waitForFunction(
    () => window.__CONFLUENCE_MOTION__?.activeTrack?.waypointCount === 1,
    { timeout: 20_000 },
  );

  for (const position of authoredPositions.slice(1)) {
    await setPosition(position);
    await page.click('[data-testid="record-motion-waypoint"]');
    await delay(260);
  }
  await page.waitForFunction(
    (count) => window.__CONFLUENCE_MOTION__?.activeTrack?.waypointCount === count,
    { timeout: 20_000 },
    authoredPositions.length,
  );

  const authored = await motionState();
  report.states.push({ name: 'path-authored', motion: authored, editor: await editorState() });
  await screenshot('achievement-forum-motion-authored.png');
  await screenshot('achievement-forum-motion-path.png', true);

  const midpoint = authored.activeTrack.durationSeconds * 0.52;
  await page.$eval('[data-testid="motion-playhead"]', (element, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(element, String(value));
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, midpoint);
  await page.waitForFunction(
    (expected) => Math.abs((window.__CONFLUENCE_MOTION__?.playheadSeconds ?? -99) - expected) < 0.12
      && window.__CONFLUENCE_MOTION__?.previewEnabled === true,
    { timeout: 20_000 },
    midpoint,
  );
  await delay(500);
  const scrubbed = await motionState();
  report.states.push({ name: 'midpoint-scrubbed', motion: scrubbed });
  await screenshot('achievement-forum-motion-scrubbed.png');
  await screenshot('achievement-forum-motion-scrubbed-viewport.png', true);

  await page.click('[data-testid="motion-stop"]');
  await page.click('[data-testid="motion-play"]');
  await page.waitForFunction(
    () => window.__CONFLUENCE_MOTION__?.playing === true && window.__CONFLUENCE_MOTION__.playheadSeconds > 0.45,
    { timeout: 20_000 },
  );
  await delay(450);
  const playing = await motionState();
  report.states.push({ name: 'live-playback', motion: playing });
  await screenshot('achievement-forum-motion-playing.png');
  await page.click('[data-testid="motion-play"]');

  await page.click('[data-testid="save-composition"]');
  await page.waitForFunction(() => window.__CONFLUENCE_EDITOR__?.dirty === false, { timeout: 20_000 });
  const persistedBeforeReload = await page.evaluate(() => {
    const raw = localStorage.getItem('confluence-composition-editor-v2');
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.state?.document?.motionTracks ?? null;
  });

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(
    () => window.__CONFLUENCE_EDITOR__?.ready === true
      && window.__CONFLUENCE_EDITOR__.sceneId === 'room-02-achievement-forum'
      && window.__CONFLUENCE_MOTION__?.ready === true
      && window.__CONFLUENCE_MOTION__.trackCount === 1,
    { timeout: 90_000 },
  );
  await delay(1200);
  const reloaded = await motionState();
  const reloadedEditor = await editorState();
  report.states.push({ name: 'reloaded', motion: reloaded, editor: reloadedEditor });
  await screenshot('achievement-forum-motion-reloaded.png');

  const waypoints = authored.activeTrack.waypoints;
  const sampled = scrubbed.sampledTransform;
  const first = waypoints[0];
  const last = waypoints.at(-1);
  report.checks = {
    achievementForumLoaded: initial.sceneId === 'room-02-achievement-forum',
    characterAddedAsRoot: Boolean(character && !character.parentId),
    onePersistentTrackCreated: authored.trackCount === 1 && persistedBeforeReload?.length === 1,
    fiveWaypointsRecorded: waypoints.length === authoredPositions.length,
    waypointPositionsMatchAuthoredPath: waypoints.every((waypoint, index) => sameTuple(waypoint.position, authoredPositions[index])),
    timingDerivedFromDistance: authored.activeTrack.durationSeconds > 8 && authored.activeTrack.distanceMeters > 12,
    pathFacesDirection: authored.activeTrack.orientToPath === true,
    midpointProducesIntermediatePose: Boolean(
      sampled
      && !sameTuple(sampled.position, first.position, 0.25)
      && !sameTuple(sampled.position, last.position, 0.25)
      && Number.isFinite(sampled.rotation[1]),
    ),
    livePlaybackAdvanced: playing.playing === true && playing.playheadSeconds > 0.45,
    savedCompositionClean: reloadedEditor.dirty === false,
    movementSurvivedReload: reloaded.trackCount === 1,
    browserClean: report.consoleErrors.length === 0 && report.pageErrors.length === 0,
  };
  report.passed = Object.values(report.checks).every(Boolean);
} catch (error) {
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
} finally {
  await browser.close();
  writeFileSync(path.join(outputDirectory, 'runtime.json'), `${JSON.stringify(report, null, 2)}\n`);
}

if (!report.passed) process.exitCode = 1;

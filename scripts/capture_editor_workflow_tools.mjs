#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer-core';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4178';
const outputDirectory = path.resolve('validation', 'composition-editor');
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
const samePosition = (left, right, tolerance = 0.001) => Array.isArray(left)
  && Array.isArray(right)
  && left.length === right.length
  && left.every((value, index) => Math.abs(value - right[index]) <= tolerance);

try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => localStorage.clear());
  await page.setViewport({ width: 1760, height: 1040, deviceScaleFactor: 1 });
  page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => report.pageErrors.push(error.message));

  const editorState = () => page.evaluate(() => window.__CONFLUENCE_EDITOR__);
  const historyState = () => page.evaluate(() => window.__CONFLUENCE_EDITOR_HISTORY__?.state());
  const healthText = () => page.$eval('[data-testid="assembly-health-status"]', (element) => element.textContent ?? '');
  const screenshot = async (name) => {
    await page.screenshot({ path: path.join(outputDirectory, name), captureBeyondViewport: false });
    report.screenshots.push(name);
  };
  const selectInstance = async (id) => {
    const selector = `[data-instance-id="${id}"] .outliner-select`;
    await page.waitForSelector(selector, { visible: true, timeout: 30_000 });
    await page.$eval(selector, (element) => {
      element.scrollIntoView({ block: 'center' });
      element.click();
    });
    await page.waitForFunction((expected) => window.__CONFLUENCE_EDITOR__?.selectedId === expected, {}, id);
  };

  await page.goto(`${baseUrl}/?editor=1&capture=1&scene=room-02`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(
    () => window.__CONFLUENCE_EDITOR__?.ready === true
      && window.__CONFLUENCE_EDITOR__?.sceneId === 'room-02'
      && Boolean(window.__CONFLUENCE_EDITOR_HISTORY__),
    { timeout: 90_000 },
  );
  await page.waitForSelector('[data-testid="pack-selected-surface"]', { visible: true, timeout: 30_000 });
  await delay(3000);

  const initial = await editorState();
  const initialHistory = await historyState();
  report.states.push({ name: 'initial', editor: initial, history: initialHistory, health: await healthText() });

  await selectInstance('room-02-coaching-table');
  const addLaptop = async () => {
    await page.waitForSelector('[data-asset-id="academy-laptop"]', { visible: true, timeout: 20_000 });
    await page.$eval('[data-asset-id="academy-laptop"]', (element) => {
      element.scrollIntoView({ block: 'center' });
      element.click();
    });
    await delay(300);
  };
  await addLaptop();
  await addLaptop();
  await page.waitForFunction(
    (count) => window.__CONFLUENCE_EDITOR__?.instanceCount === count + 2,
    { timeout: 20_000 },
    initial.instanceCount,
  );
  await delay(350);

  const overlapped = await editorState();
  const coachingChildren = overlapped.instances.filter((instance) => instance.parentId === 'room-02-coaching-table');
  const overlapHealth = await healthText();
  const overlapHistory = await historyState();
  report.states.push({ name: 'overlap-detected', editor: overlapped, history: overlapHistory, health: overlapHealth });
  await screenshot('workflow-tools-overlap.png');

  await page.click('[data-testid="pack-selected-surface"]');
  await page.waitForFunction(() => {
    const children = window.__CONFLUENCE_EDITOR__?.instances.filter((instance) => instance.parentId === 'room-02-coaching-table') ?? [];
    return children.length === 2 && JSON.stringify(children[0]?.transform.position) !== JSON.stringify(children[1]?.transform.position);
  }, { timeout: 20_000 });
  await delay(300);

  const packed = await editorState();
  const packedChildren = packed.instances.filter((instance) => instance.parentId === 'room-02-coaching-table');
  const packedHealth = await healthText();
  const packedHistory = await historyState();
  report.states.push({ name: 'packed', editor: packed, history: packedHistory, health: packedHealth });
  await screenshot('workflow-tools-packed.png');

  await page.click('[data-testid="undo-composition"]');
  await page.waitForFunction(() => {
    const children = window.__CONFLUENCE_EDITOR__?.instances.filter((instance) => instance.parentId === 'room-02-coaching-table') ?? [];
    return children.length === 2 && JSON.stringify(children[0]?.transform.position) === JSON.stringify(children[1]?.transform.position);
  }, { timeout: 20_000 });
  await delay(250);

  const undone = await editorState();
  const undoneChildren = undone.instances.filter((instance) => instance.parentId === 'room-02-coaching-table');
  const undoHistory = await historyState();
  const undoHealth = await healthText();
  report.states.push({ name: 'undo-pack', editor: undone, history: undoHistory, health: undoHealth });
  await screenshot('workflow-tools-undone.png');

  await page.click('[data-testid="redo-composition"]');
  await page.waitForFunction(() => {
    const children = window.__CONFLUENCE_EDITOR__?.instances.filter((instance) => instance.parentId === 'room-02-coaching-table') ?? [];
    return children.length === 2 && JSON.stringify(children[0]?.transform.position) !== JSON.stringify(children[1]?.transform.position);
  }, { timeout: 20_000 });
  await delay(250);

  const redone = await editorState();
  const redoneChildren = redone.instances.filter((instance) => instance.parentId === 'room-02-coaching-table');
  const redoHistory = await historyState();
  const redoHealth = await healthText();
  report.states.push({ name: 'redo-pack', editor: redone, history: redoHistory, health: redoHealth });
  await screenshot('workflow-tools-redone.png');

  report.checks = {
    historyStartsEmpty: initialHistory?.canUndo === false && initialHistory?.canRedo === false,
    twoLaptopsAddedToSelectedHost: coachingChildren.length === 2
      && coachingChildren.every((instance) => instance.surfaceId === 'round-top'),
    overlapCreatedAtSharedDefaultPosition: coachingChildren.length === 2
      && samePosition(coachingChildren[0]?.transform.position, coachingChildren[1]?.transform.position),
    overlapAuditDetected: /overlap/i.test(overlapHealth),
    packSeparatedChildren: packedChildren.length === 2
      && !samePosition(packedChildren[0]?.transform.position, packedChildren[1]?.transform.position),
    packClearedOverlapAudit: !/surface overlap/i.test(packedHealth),
    packRecordedInHistory: packedHistory?.canUndo === true && /pack|edit|transform/i.test(packedHistory?.undoLabel ?? ''),
    undoRestoredOverlap: undoneChildren.length === 2
      && samePosition(undoneChildren[0]?.transform.position, undoneChildren[1]?.transform.position)
      && /overlap/i.test(undoHealth),
    undoEnabledRedo: undoHistory?.canRedo === true,
    redoRestoredPackedLayout: redoneChildren.length === 2
      && !samePosition(redoneChildren[0]?.transform.position, redoneChildren[1]?.transform.position)
      && !/surface overlap/i.test(redoHealth),
    redoReturnedToUndoStack: redoHistory?.canUndo === true,
  };
  report.passed = Object.values(report.checks).every(Boolean)
    && report.consoleErrors.length === 0
    && report.pageErrors.length === 0;
} catch (error) {
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
} finally {
  await browser.close();
  writeFileSync(path.join(outputDirectory, 'workflow-tools.json'), `${JSON.stringify(report, null, 2)}\n`);
}

if (!report.passed) process.exitCode = 1;

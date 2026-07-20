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
  schemaVersion: 3,
  generatedAt: new Date().toISOString(),
  passed: false,
  fatalError: null,
  screenshots: [],
  states: [],
  checks: {},
  consoleErrors: [],
  pageErrors: [],
};
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const near = (left, right, tolerance = 0.02) => Math.abs(left - right) <= tolerance;
const sameTuple = (left, right, tolerance = 0.0001) => Array.isArray(left)
  && Array.isArray(right)
  && left.length === right.length
  && left.every((value, index) => near(value, right[index], tolerance));

try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => localStorage.clear());
  await page.setViewport({ width: 1760, height: 1040, deviceScaleFactor: 1 });
  page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => report.pageErrors.push(error.message));

  const state = () => page.evaluate(() => window.__CONFLUENCE_EDITOR__);
  const selectInstance = async (id) => {
    const selector = `[data-instance-id="${id}"] .outliner-select`;
    await page.waitForSelector(selector, { visible: true, timeout: 30_000 });
    await page.$eval(selector, (element) => {
      element.scrollIntoView({ block: 'center' });
      element.click();
    });
    await page.waitForFunction((expected) => window.__CONFLUENCE_EDITOR__?.selectedId === expected, {}, id);
  };
  const setAxis = async (kind, axis, value) => {
    const selector = `input[data-transform-kind="${kind}"][data-axis="${axis}"]`;
    await page.waitForSelector(selector, { visible: true, timeout: 30_000 });
    await page.$eval(selector, (element, nextValue) => {
      const input = element;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, String(nextValue));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.blur();
    }, value);
    await delay(240);
  };
  const composeInstance = async (id, values) => {
    await selectInstance(id);
    if (values.x !== undefined) await setAxis('position', 0, values.x);
    if (values.y !== undefined) await setAxis('position', 1, values.y);
    if (values.z !== undefined) await setAxis('position', 2, values.z);
    if (values.rotationY !== undefined) await setAxis('rotation', 1, values.rotationY);
  };
  const writeScreenshot = async (name, element = null) => {
    const destination = path.join(outputDirectory, name);
    if (element) await element.screenshot({ path: destination });
    else await page.screenshot({ path: destination, captureBeyondViewport: false });
    report.screenshots.push(name);
  };
  const find = (snapshot, id) => snapshot.instances.find((instance) => instance.id === id);

  await page.goto(`${baseUrl}/?editor=1&capture=1&scene=room-02`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(() => window.__CONFLUENCE_EDITOR__?.ready === true && window.__CONFLUENCE_EDITOR__?.sceneId === 'room-02', { timeout: 90_000 });
  await page.waitForSelector('[data-testid="composition-viewport"] canvas', { timeout: 90_000 });
  await delay(4200);

  const initialState = await state();
  report.states.push({ name: 'room-02-assembly-initial', value: initialState });
  await writeScreenshot('room-02-assembly-before.png');
  const viewport = await page.$('[data-testid="composition-viewport"]');
  await writeScreenshot('room-02-assembly-viewport-before.png', viewport);

  const laptopId = 'room-02-laptop-front-left';
  const parentId = 'room-02-bench-front-left';
  await selectInstance(laptopId);
  await page.waitForSelector('[data-testid="selected-attachment-status"]', { visible: true, timeout: 20_000 });
  await writeScreenshot('room-02-laptop-selected.png');

  const clampCountBeforeLaptop = initialState.boundaryClampCount;
  await setAxis('position', 0, 99);
  await page.waitForFunction(
    (previous) => window.__CONFLUENCE_EDITOR__?.boundaryClampCount > previous,
    { timeout: 20_000 },
    clampCountBeforeLaptop,
  );
  const laptopClampedState = await state();
  report.states.push({ name: 'laptop-tabletop-clamped', value: laptopClampedState });
  await writeScreenshot('room-02-laptop-tabletop-clamp.png');

  await composeInstance(laptopId, { x: 0.31, z: 0.07, rotationY: 22 });
  const laptopPlacedState = await state();
  const laptopBeforeParentMove = find(laptopPlacedState, laptopId);
  report.states.push({ name: 'laptop-repositioned-locally', value: laptopPlacedState });
  await writeScreenshot('room-02-laptop-repositioned.png');

  await composeInstance(parentId, { x: -3.25, z: 3.25, rotationY: 165 });
  const parentMovedState = await state();
  const laptopAfterParentMove = find(parentMovedState, laptopId);
  report.states.push({ name: 'parent-moved-with-laptop', value: parentMovedState });

  await selectInstance('room-02-coaching-table');
  const beforeAddedLaptopCount = parentMovedState.instanceCount;
  await page.waitForSelector('[data-asset-id="academy-laptop"]', { visible: true, timeout: 20_000 });
  await page.$eval('[data-asset-id="academy-laptop"]', (element) => {
    element.scrollIntoView({ block: 'center' });
    element.click();
  });
  await page.waitForFunction(
    (previous) => window.__CONFLUENCE_EDITOR__?.instanceCount === previous + 1,
    { timeout: 20_000 },
    beforeAddedLaptopCount,
  );
  const addedLaptopState = await state();
  const addedLaptop = find(addedLaptopState, addedLaptopState.selectedId);
  report.states.push({ name: 'laptop-added-to-selected-table', value: addedLaptopState });
  await composeInstance(addedLaptop.id, { x: 0.52, z: -0.25, rotationY: -28 });
  const piledState = await state();
  const finalAddedLaptop = find(piledState, addedLaptop.id);
  await writeScreenshot('room-02-multi-surface-assembly.png');
  await writeScreenshot('room-02-multi-surface-viewport.png', viewport);

  await selectInstance('room-02-credential-stack');
  const clampBeforeRoomTest = piledState.boundaryClampCount;
  await setAxis('position', 0, 99);
  await page.waitForFunction(
    (previous) => window.__CONFLUENCE_EDITOR__?.boundaryClampCount > previous,
    { timeout: 20_000 },
    clampBeforeRoomTest,
  );
  const roomClampedState = await state();
  await composeInstance('room-02-credential-stack', { x: 5.55, z: -4.55, rotationY: -90 });
  await page.click('[data-testid="save-composition"]');
  await page.waitForFunction(() => window.__CONFLUENCE_EDITOR__?.dirty === false, { timeout: 20_000 });
  await delay(1200);

  const finalState = await state();
  report.states.push({ name: 'room-02-assembly-final', value: finalState });
  await writeScreenshot('room-02-assembly-after.png');
  await writeScreenshot('room-02-assembly-viewport-after.png', viewport);

  const initialLaptops = initialState.instances.filter((instance) => instance.assetId === 'academy-laptop');
  const clampedLaptop = find(laptopClampedState, laptopId);
  const finalLaptop = find(finalState, laptopId);
  const finalParent = find(finalState, parentId);
  const finalCredential = find(finalState, 'room-02-credential-stack');
  const clampedCredential = find(roomClampedState, 'room-02-credential-stack');
  report.checks = {
    exactRoomDimensions: JSON.stringify(initialState?.dimensions) === JSON.stringify([15.2, 13.8, 5.7]),
    assemblyObjectCount: initialState?.instanceCount === 15,
    sixLaptopChildrenLoaded: initialLaptops.length === 6
      && initialLaptops.every((instance) => instance.parentId && instance.surfaceId === 'tabletop'),
    hierarchyCountsCorrect: initialState?.rootCount === 9 && initialState?.attachedCount === 6,
    laptopSelectableAsDistinctObject: initialState.instances.some((instance) => instance.id === laptopId && instance.parentId === parentId),
    laptopTabletopBoundaryClamped: Boolean(
      clampedLaptop
      && Math.abs(clampedLaptop.transform.position[0]) < 0.55
      && near(clampedLaptop.transform.position[1], 0.86)
      && laptopClampedState.boundaryClampCount > clampCountBeforeLaptop,
    ),
    laptopMovedLocally: Boolean(
      finalLaptop
      && near(finalLaptop.transform.position[0], 0.31)
      && near(finalLaptop.transform.position[2], 0.07)
      && near(finalLaptop.transform.rotation[1], MathUtilsRadians(22)),
    ),
    parentMovePreservedChildLocalTransform: Boolean(
      laptopBeforeParentMove
      && laptopAfterParentMove
      && sameTuple(laptopBeforeParentMove.transform.position, laptopAfterParentMove.transform.position)
      && sameTuple(laptopBeforeParentMove.transform.rotation, laptopAfterParentMove.transform.rotation),
    ),
    parentRecomposedWithChild: Boolean(finalParent && near(finalParent.transform.position[0], -3.25) && near(finalParent.transform.position[2], 3.25)),
    libraryLaptopAttachedToSelectedHost: Boolean(
      addedLaptop
      && addedLaptop.assetId === 'academy-laptop'
      && addedLaptop.parentId === 'room-02-coaching-table'
      && addedLaptop.surfaceId === 'round-top',
    ),
    addedLaptopMovedOnRoundTable: Boolean(
      finalAddedLaptop
      && near(finalAddedLaptop.transform.position[0], 0.52)
      && near(finalAddedLaptop.transform.position[2], -0.25),
    ),
    roomBoundaryStillClamped: Boolean(clampedCredential?.transform?.position?.[0] < 7.6 && roomClampedState.boundaryClampCount > clampBeforeRoomTest),
    credentialRecomposed: Boolean(finalCredential && near(finalCredential.transform.position[0], 5.55) && near(finalCredential.transform.position[2], -4.55)),
    finalHierarchyPersisted: finalState?.attachedCount === 7 && finalState?.instanceCount === 16,
    saved: finalState?.dirty === false,
  };
  report.passed = Object.values(report.checks).every(Boolean) && report.consoleErrors.length === 0 && report.pageErrors.length === 0;
} catch (error) {
  report.fatalError = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
} finally {
  await browser.close();
  writeFileSync(path.join(outputDirectory, 'runtime.json'), `${JSON.stringify(report, null, 2)}\n`);
}

function MathUtilsRadians(degrees) {
  return degrees * Math.PI / 180;
}

if (!report.passed) process.exitCode = 1;

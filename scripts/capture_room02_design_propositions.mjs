#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer-core';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4178';
const outputDirectory = path.resolve('validation', 'composition-editor', 'propositions');
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

const propositions = [
  {
    sceneId: 'room-02-academy-axis',
    propositionId: 'academy-axis',
    slug: 'academy-axis',
    expectedZoneCount: 4,
  },
  {
    sceneId: 'room-02-credential-gallery',
    propositionId: 'credential-gallery',
    slug: 'credential-gallery',
    expectedZoneCount: 5,
  },
  {
    sceneId: 'room-02-learning-forum',
    propositionId: 'learning-forum',
    slug: 'learning-forum',
    expectedZoneCount: 4,
  },
];

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
  screenshots: [],
  propositions: [],
  checks: {},
  consoleErrors: [],
  pageErrors: [],
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const rootByAsset = (snapshot, assetId) => snapshot.rootTransforms.find((item) => item.assetId === assetId);
const rootsByAsset = (snapshot, assetId) => snapshot.rootTransforms.filter((item) => item.assetId === assetId);
const signature = (snapshot) => JSON.stringify(
  snapshot.rootTransforms
    .map((item) => ({ assetId: item.assetId, position: item.transform.position, rotation: item.transform.rotation }))
    .sort((left, right) => left.assetId.localeCompare(right.assetId) || JSON.stringify(left.position).localeCompare(JSON.stringify(right.position))),
);

try {
  for (const definition of propositions) {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => localStorage.clear());
    await page.setViewport({ width: 1920, height: 1180, deviceScaleFactor: 1 });
    const localConsoleErrors = [];
    const localPageErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        localConsoleErrors.push(message.text());
        report.consoleErrors.push(`${definition.slug}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => {
      localPageErrors.push(error.message);
      report.pageErrors.push(`${definition.slug}: ${error.message}`);
    });

    await page.goto(`${baseUrl}/?editor=1&capture=1&scene=${definition.sceneId}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForFunction(
      (sceneId, propositionId) => window.__CONFLUENCE_PROPOSITION__?.ready === true
        && window.__CONFLUENCE_PROPOSITION__.sceneId === sceneId
        && window.__CONFLUENCE_PROPOSITION__.propositionId === propositionId
        && window.__CONFLUENCE_EDITOR__?.ready === true
        && window.__CONFLUENCE_EDITOR__.sceneId === sceneId,
      { timeout: 90_000 },
      definition.sceneId,
      definition.propositionId,
    );
    await page.waitForSelector('[data-testid="design-proposition-brief"]', { visible: true, timeout: 30_000 });
    await page.waitForSelector('[data-testid="composition-viewport"] canvas', { visible: true, timeout: 90_000 });
    await delay(4500);
    await page.keyboard.press('Escape');
    await delay(400);

    const snapshot = await page.evaluate(() => ({
      proposition: window.__CONFLUENCE_PROPOSITION__,
      editor: window.__CONFLUENCE_EDITOR__,
    }));

    const fullScreenshot = `${definition.slug}-editor.png`;
    const viewportScreenshot = `${definition.slug}-viewport.png`;
    await page.screenshot({ path: path.join(outputDirectory, fullScreenshot), captureBeyondViewport: false });
    const viewport = await page.$('[data-testid="composition-viewport"]');
    if (!viewport) throw new Error(`Viewport missing for ${definition.sceneId}.`);
    await viewport.screenshot({ path: path.join(outputDirectory, viewportScreenshot) });
    report.screenshots.push(fullScreenshot, viewportScreenshot);

    report.propositions.push({
      ...definition,
      title: snapshot.proposition.title,
      thesis: snapshot.proposition.thesis,
      experientialPromise: snapshot.proposition.experientialPromise,
      hierarchy: snapshot.proposition.hierarchy,
      zoneCount: snapshot.proposition.zoneCount,
      circulationPointCount: snapshot.proposition.circulationPointCount,
      rootTransforms: snapshot.proposition.rootTransforms,
      dimensions: snapshot.editor.dimensions,
      instanceCount: snapshot.editor.instanceCount,
      rootCount: snapshot.editor.rootCount,
      attachedCount: snapshot.editor.attachedCount,
      boundaryClampCount: snapshot.editor.boundaryClampCount,
      consoleErrors: localConsoleErrors,
      pageErrors: localPageErrors,
      screenshots: [fullScreenshot, viewportScreenshot],
    });
    await page.close();
  }

  const [academy, gallery, forum] = report.propositions;
  const academyHero = rootByAsset(academy, 'room-02');
  const academyBenches = rootsByAsset(academy, 'academy-workbench');
  const galleryCredential = rootByAsset(gallery, 'academy-credential-stack');
  const galleryBenches = rootsByAsset(gallery, 'academy-workbench');
  const forumHero = rootByAsset(forum, 'room-02');
  const forumTable = rootByAsset(forum, 'academy-coaching-table');
  const forumBenches = rootsByAsset(forum, 'academy-workbench');
  const signatures = report.propositions.map(signature);

  report.checks = {
    threePropositionsCaptured: report.propositions.length === 3,
    exactRoomDimensionsPreserved: report.propositions.every((item) => JSON.stringify(item.dimensions) === JSON.stringify([15.2, 13.8, 5.7])),
    propositionMetadataComplete: report.propositions.every((item) => item.title && item.thesis && item.experientialPromise && item.hierarchy.length === 4),
    expectedZoneStructures: report.propositions.every((item) => item.zoneCount === item.expectedZoneCount && item.circulationPointCount >= 5),
    editableAssemblyCountsPreserved: report.propositions.every((item) => item.instanceCount === 15 && item.rootCount === 9 && item.attachedCount === 6),
    noTemplateBoundaryCorrections: report.propositions.every((item) => item.boundaryClampCount === 0),
    transformSignaturesDistinct: new Set(signatures).size === 3,
    thesesDistinct: new Set(report.propositions.map((item) => item.thesis)).size === 3,
    academyAxisReadsAsFrontFacingRows: Boolean(
      academyHero?.transform.position[2] < -3.5
      && academyBenches.length === 6
      && academyBenches.every((item) => item.transform.rotation[1] > 3.0)
      && academyBenches.filter((item) => item.transform.position[2] > 2.5).length === 3,
    ),
    credentialGalleryReadsAsPromenade: Boolean(
      galleryCredential?.transform.position[2] < -5.5
      && galleryBenches.length === 6
      && galleryBenches.every((item) => Math.abs(item.transform.position[0]) > 5.0),
    ),
    learningForumReadsAsCollaborativeRing: Boolean(
      forumTable
      && Math.abs(forumTable.transform.position[0]) < 0.1
      && Math.abs(forumTable.transform.position[2]) < 0.1
      && forumHero?.transform.position[0] > 4.5
      && forumBenches.length === 6
      && new Set(forumBenches.map((item) => item.transform.rotation[1].toFixed(2))).size >= 5,
    ),
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

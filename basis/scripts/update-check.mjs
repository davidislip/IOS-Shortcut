import { chromium } from '../.tools/browser/node_modules/playwright/index.mjs';
import { cp, mkdir, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toolsRoot = await realpath(path.join(root, '.tools'));
const baseURL = 'http://127.0.0.1:4174/';
const historicalBuild = '848aa0d4108161b9';
const draft = '# Preserved by updater\n40 + 2';
const expectedArgument = process.argv.indexOf('--expected-build');
const expectedBuild = expectedArgument === -1 ? null : process.argv[expectedArgument + 1];
if (expectedArgument !== -1 && !/^[a-f\d]{16}$/.test(expectedBuild ?? '')) throw new Error('--expected-build requires a 16-character build ID');
const report = { checkedAt: new Date().toISOString(), physicalIPad: false, engine: 'chromium', checks: [], errors: [], passed: false };
let context;
let page;
let expired = false;
const deadline = setTimeout(() => {
  expired = true;
  context?.close().catch(() => {});
}, 180000);
const check = async (name, action) => {
  if (expired) throw new Error('Update integration check exceeded its 180-second deadline');
  const start = Date.now();
  await action();
  report.checks.push({ name, passed: true, ms: Date.now() - start });
  console.log(`PASS ${name}`);
};
const editor = () => page.getByRole('textbox', { name: 'Julia source code' });
const editorText = () => editor().locator('.cm-line').allTextContents().then(lines => lines.join('\n'));
async function ready(dark = false) {
  await page.locator('#run:not([disabled])').waitFor();
  await page.locator('#offline-state').filter({ hasText: 'Ready for offline use' }).waitFor();
  if (dark) {
    await page.locator('html[data-theme="dark"]').waitFor();
    await page.waitForFunction(() => document.body.dataset.offlineReady === 'true');
  }
}
async function snapshot() {
  return page.evaluate(async () => ({
    url: location.href,
    build: (await fetch('./provenance.json').then(response => response.json())).build,
    theme: document.documentElement.dataset.theme ?? null,
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    rootBackground: getComputedStyle(document.documentElement).backgroundColor,
    cacheNames: await caches.keys(),
    savedDraft: JSON.parse(localStorage.getItem('basis.julia-draft.v1') || 'null')?.source ?? null,
  }));
}

try {
  await check('served target matches the completed local build', async () => {
    const local = JSON.parse(await readFile(path.join(root, 'dist', 'provenance.json'), 'utf8'));
    const response = await fetch(new URL('provenance.json', baseURL), { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    assert.equal(response.ok, true, `Provenance fetch returned ${response.status}`);
    const served = await response.json();
    assert.equal(served.build, local.build, 'HTTP server is serving a different build');
    if (expectedBuild) assert.equal(served.build, expectedBuild);
    assert.notEqual(served.build, historicalBuild);
    report.targetBuild = served.build;
    report.runtimeSHA256 = served.runtime.sha256;
  });

  await check('copy the historical project-owned profile without changing its source', async () => {
    const historical = JSON.parse(await readFile(path.join(root, 'reports', 'browser-check-editor.json'), 'utf8'));
    assert.equal(historical.provenance.build, historicalBuild);
    const original = await realpath(historical.profile);
    assert.equal(path.dirname(original), toolsRoot, 'Only a project-local test profile may be copied');
    assert.ok(path.basename(original).startsWith('browser-profile-'));
    const profile = path.join(await mkdtemp(path.join(toolsRoot, 'update-profile-')), 'profile');
    assert.notEqual(profile, original);
    await cp(original, profile, { recursive: true, force: false, errorOnExist: true });
    report.originalProfile = original;
    report.profile = profile;
    report.originalProfileModified = false;
  });

  context = await chromium.launchPersistentContext(report.profile, {
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    offline: true,
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 1,
    serviceWorkers: 'allow',
    timeout: 180000,
  });
  context.setDefaultTimeout(180000);
  context.setDefaultNavigationTimeout(180000);
  report.browser = context.browser().version();
  await context.setOffline(true);
  page = context.pages()[0] ?? await context.newPage();
  page.on('pageerror', error => report.errors.push(String(error)));

  await check('open the real old beige build while offline', async () => {
    await page.goto(baseURL);
    await ready();
    report.before = await snapshot();
    assert.equal(report.before.build, historicalBuild);
    assert.notEqual(report.before.theme, 'dark');
    assert.ok([report.before.bodyBackground, report.before.rootBackground].includes('rgb(244, 242, 236)'), 'Historical page is not the expected beige UI');
    assert.ok(report.before.cacheNames.includes(`basis-${historicalBuild}`));
  });

  await check('save a distinct learner draft through the old editor', async () => {
    await editor().fill(draft);
    await page.waitForFunction(expected => JSON.parse(localStorage.getItem('basis.julia-draft.v1') || 'null')?.source === expected, draft);
    assert.equal(await editorText(), draft);
    report.draft = draft;
  });

  await check('direct updater activates the new dark pack and preserves the exact draft', async () => {
    await context.setOffline(false);
    await page.goto(new URL('update.html', baseURL).href, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(url => url.href === baseURL);
    await ready(true);
    report.after = await snapshot();
    assert.equal(report.after.build, report.targetBuild);
    assert.equal(report.after.savedDraft, draft);
    assert.equal(await editorText(), draft);
    assert.ok(report.after.cacheNames.includes(`basis-${report.targetBuild}`));
    assert.ok(report.after.cacheNames.includes(`basis-${historicalBuild}`), 'Previous complete offline pack was removed');
    assert.equal(report.after.bodyBackground, 'rgb(22, 24, 29)');
    report.draftPreserved = true;
  });

  await check('new dark build reloads offline and executes the preserved Julia source', async () => {
    await context.setOffline(true);
    await page.reload();
    await ready(true);
    report.offline = await snapshot();
    assert.equal(report.offline.build, report.targetBuild);
    assert.equal(report.offline.savedDraft, draft);
    assert.equal(await editorText(), draft);
    await page.locator('#run').click();
    await page.waitForFunction(() => ['Complete', 'Error'].includes(document.getElementById('run-state').textContent));
    assert.equal(await page.locator('#run-state').innerText(), 'Complete', await page.locator('#output').innerText());
    const value = JSON.parse(await page.locator('#structured-value').textContent());
    assert.equal(value.value, 42);
    report.offlineResult = value.value;
  });
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.failure = expired ? `180-second deadline exceeded: ${error}` : String(error.stack || error);
  if (page && !page.isClosed()) {
    report.failureUI = await page.evaluate(() => ({
      url: location.href,
      update: document.getElementById('update-progress')?.textContent,
      offline: document.getElementById('offline-state')?.textContent,
      run: document.getElementById('run-state')?.textContent,
      theme: document.documentElement.dataset.theme,
    })).catch(() => null);
  }
  console.error(report.failure);
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  await context?.close().catch(() => {});
  await mkdir(path.join(root, 'reports'), { recursive: true });
  await writeFile(path.join(root, 'reports', 'update-check.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Update integration: ${report.passed ? 'PASS' : 'FAIL'}; report: basis/reports/update-check.json`);
}

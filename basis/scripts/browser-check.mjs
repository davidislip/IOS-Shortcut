import { chromium, webkit } from '../.tools/browser/node_modules/playwright/index.mjs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { tmpdir } from 'node:os';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engine = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const browserType = engine === 'webkit' ? webkit : chromium;
const editorChecks = process.argv.includes('--editor');
const workbenchChecks = process.argv.includes('--workbench');
const live = process.argv.includes('--live');
const urlIndex = process.argv.indexOf('--url');
if (urlIndex >= 0 && (!process.argv[urlIndex + 1] || process.argv[urlIndex + 1].startsWith('--'))) throw new Error('--url requires an HTTP or HTTPS app directory URL');
const target = new URL(urlIndex >= 0 ? process.argv[urlIndex + 1] : 'http://127.0.0.1:4174/');
if (!['http:', 'https:'].includes(target.protocol) || target.search || target.hash) throw new Error('--url must be an HTTP or HTTPS app directory URL without a query or fragment');
// A directory URL preserves relative assets and the service worker's subpath scope.
if (!target.pathname.endsWith('/')) target.pathname += '/';
const targetURL = target.href;
const suffix = `${live ? '-live' : workbenchChecks ? '-workbench' : editorChecks ? '-editor' : ''}${engine === 'webkit' ? '-webkit' : ''}`;
await mkdir(path.join(root, '.tools'), { recursive: true });
// WebKit's nested cache paths can exceed Windows MAX_PATH under this workspace.
const profile = await mkdtemp(engine === 'webkit' ? path.join(tmpdir(), 'bw-') : path.join(root, '.tools', 'browser-profile-'));
// The Windows WebKit embedder also creates relative Storage/AlternativeServices.
if (engine === 'webkit') process.chdir(profile);
const browserOptions = { ...(engine === 'chromium' ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' } : {}), headless: true, viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1, serviceWorkers: 'allow' };
let context = await browserType.launchPersistentContext(profile, browserOptions);
const report = { engine, browser: context.browser().version(), checkedAt: new Date().toISOString(), targetURL, profile, physicalIPad: false, checks: [], errors: [] };
let page = context.pages()[0] ?? await context.newPage();
const listen = current => current.on('pageerror', error => report.errors.push(String(error)));
listen(page);
const check = async (name, action) => {
  const start = Date.now();
  await action();
  report.checks.push({ name, passed: true, ms: Date.now() - start });
  console.log(`PASS ${name}`);
};
const ready = async () => {
  await page.locator('#run:not([disabled])').waitFor({ timeout: 180000 });
  await page.locator('#offline-state').filter({ hasText: 'Ready for offline use' }).waitFor({ timeout: 180000 });
};
const editor = () => page.getByRole('textbox', { name: 'Julia source code' });
// Fixtures are short enough that every line is rendered (CodeMirror virtualizes long files).
const sourceText = () => editor().locator('.cm-line').allTextContents().then(lines => lines.join('\n'));
const writeSource = async source => {
  const codeTab = page.locator('[data-show-pane="code"]');
  if (await codeTab.isVisible()) await codeTab.click();
  await editor().fill(source);
  await page.waitForFunction(expected => JSON.parse(localStorage.getItem('basis.julia-draft.v1'))?.source === expected, source);
};
const run = async (source, expected) => {
  await writeSource(source);
  await page.locator('#run').click();
  await page.waitForFunction(() => ['Complete', 'Error'].includes(document.querySelector('#run-state').textContent), null, { timeout: 180000 });
  const state = await page.locator('#run-state').innerText();
  if (state !== 'Complete') throw new Error(await page.locator('#output').innerText());
  const output = await page.locator('#value').innerText();
  if (!output.includes(expected)) throw new Error(`Expected ${expected}; got ${output}`);
};
try {
  await check('install complete offline pack and initialize Julia', async () => {
    await page.goto(targetURL);
    await ready();
    report.serviceWorker = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return { scope: registration?.scope, scriptURL: registration?.active?.scriptURL };
    });
    if (report.serviceWorker.scope !== targetURL) throw new Error(`Expected service worker scope ${targetURL}; got ${report.serviceWorker.scope}`);
    report.runtime = await page.locator('#runtime-state').innerText();
    report.provenance = await page.evaluate(async () => {
      const metadata = await fetch('./provenance.json').then(response => response.json());
      return { build: metadata.build, runtime: metadata.runtime };
    });
  });
  await check('matrix values render in row and column order', async () => {
    await run('[1.0 2.0; 3.0 4.0]', 'Float64');
    const rows = await page.locator('#value tr').evaluateAll(rows => rows.map(row => [...row.querySelectorAll('td')].map(cell => Number(cell.textContent))));
    if (JSON.stringify(rows) !== JSON.stringify([[1, 2], [3, 4]])) throw new Error(`Wrong matrix order: ${JSON.stringify(rows)}`);
  });
  await check('new Julia computation after offline reload', async () => {
    await context.setOffline(true);
    await page.reload();
    await ready();
    await run('using LinearAlgebra\nA = [2.0 1.0; 1.0 3.0]\nb = [4.0, 5.0]\nx = A \\ b\nnorm(A*x-b) < 1e-10', 'true');
  });
  if (editorChecks) {
    await check('Julia highlighting distinguishes adjoints, characters, Unicode and nested comments offline', async () => {
      const code = ['using LinearAlgebra', '#= outer comment', '#= nested comment =#', 'still a comment', '=#', 'A = [2.0 1.0; 1.0 3.0]', 'α = 2', "c = 'x'", 's = "hello # text"', "A' * A"].join('\n');
      await writeSource(code);
      await page.locator('#source .jl-keyword').filter({ hasText: 'using' }).waitFor();
      const styled = await editor().evaluate(node => ({
        comments: [...node.querySelectorAll('.jl-comment')].map(span => span.textContent).join('\n'),
        strings: [...node.querySelectorAll('.jl-string')].map(span => span.textContent).join(''),
        lastLine: [...node.querySelectorAll('.cm-line')].at(-1).textContent,
        lastLineStrings: [...node.querySelectorAll('.cm-line')].at(-1).querySelectorAll('.jl-string').length,
        numbers: node.querySelectorAll('.jl-literal').length,
        keywordColor: getComputedStyle(node.querySelector('.jl-keyword')).color,
        textColor: getComputedStyle(node).color,
      }));
      if (!styled.comments.includes('still a comment') || !styled.comments.includes('nested comment')) throw new Error('Nested block comment highlighting ended too early');
      if (!styled.strings.includes("'x'") || !styled.strings.includes('"hello # text"')) throw new Error('Character or string highlighting missing');
      if (styled.lastLineStrings || styled.lastLine !== "A' * A") throw new Error('Adjoint mistaken for a string');
      if (!styled.numbers || styled.keywordColor === styled.textColor) throw new Error('Syntax colors missing');
      if (await sourceText() !== code) throw new Error('Highlighting changed Julia source');
      report.highlighting = styled;
    });
    await check('indent, undo, redo and keyboard execution preserve source', async () => {
      const original = '# Keyboard editing\nα = 3\nα^2';
      await writeSource(original);
      await editor().press('Control+Home');
      await editor().press('ArrowDown');
      await editor().press('Tab');
      if (await sourceText() !== original.replace('α =', '    α =')) throw new Error('Tab did not indent');
      await editor().press('Shift+Tab');
      if (await sourceText() !== original) throw new Error('Shift+Tab did not unindent');
      await page.waitForTimeout(600);
      await editor().press('Control+End');
      await page.keyboard.insertText(' + 1');
      if (await sourceText() !== original + ' + 1') throw new Error('Typing lost source');
      await editor().press('Control+z');
      if (await sourceText() !== original) throw new Error('Undo lost source');
      await editor().press('Control+y');
      if (await sourceText() !== original + ' + 1') throw new Error('Redo lost source');
      await editor().press('Escape');
      await editor().press('Tab');
      if (await editor().evaluate(node => node.contains(document.activeElement))) throw new Error('Cannot leave editor with Escape then Tab');
      await writeSource('using LinearAlgebra\nnorm([3.0, 4.0])');
      await editor().press('Control+Enter');
      await page.waitForFunction(() => document.querySelector('#run-state').textContent === 'Complete');
      if (!(await page.locator('#value').innerText()).includes('5')) throw new Error('Run shortcut failed');
    });
  }
  if (process.argv.includes('--rectangular')) await check('rectangular least squares in offline browser', async () => {
    await run('using LinearAlgebra\nA = [1.0 0.0; 1.0 1.0; 1.0 2.0]\nb = [1.0, 2.0, 2.0]\nx = A \\ b\nnorm(A\'*(A*x-b)) < 1e-10', 'true');
  });
  await check('dimension error is visible and the next run recovers', async () => {
    await writeSource('using LinearAlgebra\n[1.0 0.0; 0.0 1.0] \\ [1.0]');
    await page.locator('#run').click();
    await page.waitForFunction(() => ['Complete', 'Error'].includes(document.querySelector('#run-state').textContent), null, { timeout: 180000 });
    if (await page.locator('#run-state').innerText() !== 'Error') throw new Error('Invalid dimensions were accepted');
    if (!/dimension|rows|size/i.test(await page.locator('#output').innerText())) throw new Error('Missing dimension diagnostic');
    await run('3 + 4', '7');
  });
  await check('stop runaway code and restart worker', async () => {
    await writeSource('while true\nend');
    await page.locator('#run').click();
    await page.locator('#stop:not([disabled])').waitFor();
    await page.waitForTimeout(1500);
    // Editing must remain responsive while WASM is occupied by the loop.
    await writeSource('# Edited while the previous run is busy\n40 + 2');
    await page.locator('#stop').click();
    await ready();
    await run('40 + 2', '42');
  });
  const draft = '# Draft survives a closed tab — α\n[3.0, 4.0]\n';
  await check('draft and offline pack survive closing tab', async () => {
    await writeSource(draft);
    await page.close();
    page = await context.newPage();
    listen(page);
    await page.goto(targetURL);
    await ready();
    if (await sourceText() !== draft) throw new Error('Draft not restored');
    await run(draft, 'Float64');
  });
  await check('cold browser restart preserves offline execution and draft', async () => {
    await context.close();
    context = await browserType.launchPersistentContext(profile, browserOptions);
    await context.setOffline(true);
    page = context.pages()[0] ?? await context.newPage();
    listen(page);
    await page.goto(targetURL);
    await ready();
    if (await sourceText() !== draft) throw new Error('Draft lost after browser restart');
    await run('using LinearAlgebra\nnorm([3.0, 4.0])', '5');
  });
  await check('export preserves the current Julia source', async () => {
    const expected = '# Unicode, adjoint, string and trailing newline\nα = [1.0 2.0; 3.0 4.0]\ns = "quoted # text"\nα\' * α\n';
    await writeSource(expected);
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#download').click()]);
    if (download.suggestedFilename() !== 'basis-experiment.jl') throw new Error('Wrong export filename');
    if (await readFile(await download.path(), 'utf8') !== expected) throw new Error('Export differs from editor');
  });
  if (workbenchChecks) {
    const { checkWorkbench } = await import('./workbench-checks.mjs');
    await checkWorkbench({ page, check, ready, writeSource, sourceText, run, root, screenshotSuffix: live ? suffix : '' });
  }
  await check('tablet and narrow viewport fit without horizontal overflow', async () => {
    for (const width of [1024, 768, 390]) {
      await page.setViewportSize({ width, height: 1024 });
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Horizontal overflow at ${width}px`);
    }
  });
  await mkdir(path.join(root, 'reports'), { recursive: true });
  if (editorChecks) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await run('using LinearAlgebra\n\n# Reconstruct b from the columns of A.\nA = [2.0 1.0; 1.0 3.0]\nb = [4.0, 5.0]\n\nx = A \\ b\nprintln(\"Reconstruction error: \", norm(b - A * x))\nx', 'Float64');
  }
  await page.screenshot({ path: path.join(root, `reports/browser-lab${suffix}.png`), fullPage: true });
  if (report.errors.length) throw new Error(report.errors.join('\n'));
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = String(error.stack || error);
  try { report.ui = await page.evaluate(() => Object.fromEntries(['run-state', 'offline-state', 'runtime-state', 'output', 'value'].map(id => [id, document.getElementById(id)?.textContent]))); } catch {}
  process.exitCode = 1;
  console.error(report.failure);
} finally {
  await mkdir(path.join(root, 'reports'), { recursive: true });
  await writeFile(path.join(root, `reports/browser-check${suffix}.json`), JSON.stringify(report, null, 2) + '\n');
  await context.close();
}

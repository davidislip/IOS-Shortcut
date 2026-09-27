// Windows WebKit diagnosis, distinct from the full offline acceptance gate.
import { webkit } from '../.tools/browser/node_modules/playwright/index.mjs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { tmpdir } from 'node:os';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Windows WebKit appends several hashed directories and filenames to this path.
const profile = await mkdtemp(path.join(tmpdir(), 'bwd-'));
process.chdir(profile);
const context = await webkit.launchPersistentContext(profile, { headless: true, serviceWorkers: 'allow' });
const page = context.pages()[0] ?? await context.newPage();
const report = { engine: 'Windows Playwright WebKit', version: context.browser().version(), checkedAt: new Date().toISOString(), profile, physicalIPad: false, console: [], failedRequests: [] };
page.on('console', message => report.console.push({ type: message.type(), text: message.text() }));
page.on('requestfailed', request => report.failedRequests.push({ url: request.url(), failure: request.failure() }));
try {
  await page.goto('http://127.0.0.1:4174');
  await page.locator('#run:not([disabled])').waitFor({ timeout: 120000 });
  report.storage = await page.evaluate(async () => ({
    secure: isSecureContext, serviceWorker: 'serviceWorker' in navigator,
    caches: typeof caches, estimate: await navigator.storage?.estimate?.(),
    persisted: await navigator.storage?.persisted?.(),
    offlineText: document.querySelector('#offline-state').textContent,
  }));
  report.cacheProbes = await page.evaluate(async () => {
    const results = [];
    const cache = await caches.open('basis-webkit-diagnostic');
    for (const asset of ['./icon.svg', './runtime/subset_julia_vm_web_bg.wasm']) {
      try {
        const response = await fetch(asset);
        const status = response.status;
        await cache.put(asset, response);
        results.push({ asset, status, cached: !!await cache.match(asset) });
      } catch (error) { results.push({ asset, error: String(error), name: error.name, message: error.message, stack: error.stack }); }
    }
    await caches.delete('basis-webkit-diagnostic');
    return results;
  });
  console.log(JSON.stringify({ storage: report.storage, cacheProbes: report.cacheProbes }, null, 2));
  await page.locator('#source').fill('using LinearAlgebra\nfunction fit(A, b)\n A \\ b\nend\nA = [1.0 0.0; 1.0 1.0; 1.0 2.0]\nx = fit(A, [1.0, 2.0, 2.0])\nisapprox(x, [7/6, 1/2])');
  await page.locator('#run').click();
  await page.waitForFunction(() => ['Complete', 'Error'].includes(document.querySelector('#run-state').textContent), null, { timeout: 120000 });
  report.learnerFunction = { state: await page.locator('#run-state').innerText(), value: await page.locator('#value').innerText(), output: await page.locator('#output').innerText() };
  report.learnerFunction.passed = report.learnerFunction.state === 'Complete' && report.learnerFunction.value.includes('true');
  console.log(JSON.stringify({ learnerFunction: report.learnerFunction }));
} catch (error) { report.failure = String(error.stack ?? error); process.exitCode = 1; }
finally {
  await writeFile(path.join(root, 'reports/webkit-diagnostic.json'), JSON.stringify(report, null, 2) + '\n');
  await context.close();
}

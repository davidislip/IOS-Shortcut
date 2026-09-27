// Reproduce CacheStorage behavior without loading Basis or its Julia runtime.
import { webkit } from '../.tools/browser/node_modules/playwright/index.mjs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const profile = await mkdtemp(path.join(tmpdir(), 'bwc-'));
process.chdir(profile);
const context = await webkit.launchPersistentContext(profile, { headless: true });
const page = context.pages()[0];
const report = { checkedAt: new Date().toISOString(), version: context.browser().version(), profile, scope: 'CacheStorage API on a plain origin page; Basis and Julia are not loaded.' };
try {
  await page.goto('http://127.0.0.1:4174/__cache_diagnostic__');
  report.probes = await page.evaluate(async () => {
    const cache = await caches.open('minimal-round-trip');
    const output = [];
    for (const [name, response] of [
      ['synthetic', new Response('cache-round-trip', { headers: { 'Content-Type': 'text/plain' } })],
      ['fetched', await fetch('/icon.svg')],
    ]) {
      const url = new URL('/cache-probe-' + name, location.href).href;
      try {
        await cache.put(new Request(url), response);
        const found = await cache.match(new Request(url));
        output.push({ name, url, keys: (await cache.keys()).map(request => request.url), matched: !!found, body: found ? await found.text() : null });
      } catch (error) { output.push({ name, error: String(error) }); }
    }
    return output;
  });
  console.log(JSON.stringify(report, null, 2));
} catch (error) { report.failure = String(error); process.exitCode = 1; }
finally {
  await writeFile(new URL('../reports/webkit-cache-check.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  await context.close();
}

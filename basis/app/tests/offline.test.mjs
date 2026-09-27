import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

test('Complete offline packs serve runtime assets; failed updates preserve the old cache', async () => {
  const script = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  const stores = new Map();
  let failDownload = false;
  const caches = {
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async addAll(requests) { if (failDownload) throw new Error('Network interrupted'); for (const request of requests) store.set(request.url, { url: request.url, cached: true }); },
        async match(url) { return store.get(typeof url === 'string' ? url : url.url); },
      };
    },
  };
  function load(version) {
    const events = new Map();
    vm.runInNewContext(script.replace("'__BASIS_BUILD__'", JSON.stringify(version)).replace('__BASIS_ASSETS__', JSON.stringify(['./index.html', './runtime/subset_julia_vm_web_bg.wasm'])), {
      self: { registration: { scope: 'https://basis.invalid/lab/' }, addEventListener(type, callback) { events.set(type, callback); }, clients: { async claim() {} } },
      caches, URL, Request,
      fetch() { throw new Error('Network is offline'); },
    });
    return events;
  }
  let pending;
  const current = load('working');
  current.get('install')({ waitUntil(promise) { pending = promise; } });
  await pending;
  current.get('fetch')({ request: { url: 'https://basis.invalid/lab/runtime/subset_julia_vm_web_bg.wasm', method: 'GET' }, respondWith(promise) { pending = promise; } });
  assert.equal((await pending).cached, true);
  failDownload = true;
  const update = load('incomplete');
  update.get('install')({ waitUntil(promise) { pending = promise; } });
  await assert.rejects(pending, /Network interrupted/);
  assert.deepEqual(await caches.keys(), ['basis-working']);
  let response;
  current.get('message')({ data: { type: 'CHECK_CACHE' }, ports: [{ postMessage(value) { response = value; } }], waitUntil(promise) { pending = promise; } });
  await pending;
  assert.equal(response.complete, true);
});

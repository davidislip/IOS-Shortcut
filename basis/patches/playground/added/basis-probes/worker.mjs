import { parentPort, workerData } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const runtimeDir = workerData?.wasmDir ?? fileURLToPath(new URL('../pkg/', import.meta.url));
const runtime = await import(pathToFileURL(join(runtimeDir, 'subset_julia_vm_web.js')));

// Fail any unexpected fetch: this probe must load and execute local assets only.
globalThis.fetch = () => { throw new Error('Network fetch prohibited by the probe'); };
const started = performance.now();
const exports = await runtime.default({ module_or_path: readFileSync(join(runtimeDir, 'subset_julia_vm_web_bg.wasm')) });
const linearMemoryBytes = () => exports.memory?.buffer.byteLength ?? null;
parentPort.postMessage({ type: 'ready', version: runtime.get_version(), abi: runtime.abi_version?.() ?? null, initMs: performance.now() - started, linearMemoryBytes: linearMemoryBytes() });
parentPort.on('message', ({ id, source }) => {
  const before = performance.now();
  try {
    const result = runtime.run_from_source(source, 42n);
    // wasm-bindgen returns Maps; ordinary JSON.stringify would lose their contents.
    const normalized = JSON.parse(JSON.stringify(result, (_, value) =>
      value instanceof Map ? Object.fromEntries(value) : typeof value === 'bigint' ? value.toString() : value));
    parentPort.postMessage({ type: 'result', id, result: normalized, ms: performance.now() - before, linearMemoryBytes: linearMemoryBytes() });
  } catch (error) {
    parentPort.postMessage({ type: 'result', id, thrown: String(error), ms: performance.now() - before, linearMemoryBytes: linearMemoryBytes() });
  }
});

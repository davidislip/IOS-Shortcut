// Executes the actual built browser worker with only file-backed WASM fetch allowed.
import { parentPort, workerData } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
const wasmURL = new URL('./runtime/subset_julia_vm_web_bg.wasm', workerData.workerURL).href;
globalThis.self = globalThis;
globalThis.postMessage = data => parentPort.postMessage(data);
parentPort.on('message', data => globalThis.onmessage?.({ data }));
globalThis.fetch = async input => {
  const url = String(input);
  if (url !== wasmURL) throw new Error(`Unexpected network request: ${url}`);
  return new Response(await readFile(new URL(url)), { headers: { 'Content-Type': 'application/wasm' } });
};
await import(workerData.workerURL);

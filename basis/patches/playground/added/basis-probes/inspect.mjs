import { readFileSync } from 'node:fs';
import init, { get_version, abi_version, run_from_source } from '../pkg/subset_julia_vm_web.js';

const json = (value) => JSON.stringify(value, (_, item) => item instanceof Map ? Object.fromEntries(item) : typeof item === 'bigint' ? item.toString() : item);

const started = performance.now();
await init({ module_or_path: readFileSync(new URL('../pkg/subset_julia_vm_web_bg.wasm', import.meta.url)) });
console.log(JSON.stringify({ version: get_version(), abi: abi_version(), initMs: performance.now() - started }));
for (const source of ['1 + 1', '[1.0, 2.5, 3.0]', 'using LinearAlgebra\nA = [1.0 0.0; 1.0 1.0; 1.0 2.0]\ny = [1.0, 2.0, 2.0]\nA \\ y']) {
  const before = performance.now();
  try {
    console.log(json({ source, result: run_from_source(source, 42n), ms: performance.now() - before }));
  } catch (error) {
    console.log(JSON.stringify({ source, error: String(error), ms: performance.now() - before }));
  }
}

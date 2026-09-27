import init, * as vm from './runtime/subset_julia_vm_web.js';
import { normalize } from './value.js';

function boundedResult(raw) {
  const result = normalize(raw);
  for (const field of ['output', 'error', 'error_message']) {
    if (typeof result[field] === 'string' && result[field].length > 100000) { result[field] = result[field].slice(0, 100000); result.truncated = true; }
  }
  // ExecutionResult uses error_message; thrown host failures use error.
  if (!result.error && result.error_message) result.error = result.error_message;
  // Artifacts can contain executable graph callbacks; this proof renders values only.
  delete result.artifacts;
  if (result.typed_value && JSON.stringify(result.typed_value).length > 200000) {
    const value = result.typed_value;
    result.typed_value = { type: value.type, julia_type: value.julia_type, shape: value.shape, display: String(value.display ?? 'Large result').slice(0, 100000) };
    result.truncated = true;
  }
  return result;
}

async function start() {
  await init({ module_or_path: new URL('./runtime/subset_julia_vm_web_bg.wasm', import.meta.url) });
  const execute = vm.run_from_source_typed ?? vm.run_from_source;
  // Offline readiness includes executing newly supplied source, not just loading WASM.
  const check = normalize(execute('1 + 1', 42n));
  if (!check.success || (check.typed_value?.value ?? check.value) !== 2) throw new Error('Runtime execution self-check failed');
  self.onmessage = ({ data }) => {
    if (data.type !== 'run' || !Number.isInteger(data.id) || typeof data.source !== 'string') return;
    const before = performance.now();
    try {
      const result = boundedResult(execute(data.source, 42n));
      self.postMessage({ type: 'result', id: data.id, result, ms: performance.now() - before });
    } catch (error) {
      self.postMessage({ type: 'result', id: data.id, result: boundedResult({ success: false, error: String(error) }), ms: performance.now() - before });
    }
  };
  self.postMessage({ type: 'ready', version: vm.get_version(), abi: vm.abi_version?.() ?? null });
}
start().catch(error => self.postMessage({ type: 'fatal', error: String(error) }));

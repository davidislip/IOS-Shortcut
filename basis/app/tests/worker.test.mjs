import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { access } from 'node:fs/promises';

const workerURL = new URL('../../dist/worker.js', import.meta.url).href;
async function start() {
  await access(new URL(workerURL));
  const worker = new Worker(new URL('./node-worker.mjs', import.meta.url), { workerData: { workerURL } });
  try {
    const [ready] = await once(worker, 'message');
    assert.equal(ready.type, 'ready', JSON.stringify(ready));
    return worker;
  } catch (error) { await worker.terminate(); throw error; }
}
async function run(worker, id, source) {
  const received = once(worker, 'message');
  worker.postMessage({ type: 'run', id, source });
  const [message] = await received;
  assert.equal(message.id, id);
  return message.result;
}
test('Built browser worker executes new Julia offline, returns structured arrays, and resets state', { timeout: 120000 }, async () => {
  const worker = await start();
  try {
    const result = await run(worker, 1, `using LinearAlgebra\nfunction solve_demo()\n A = [2.0 1.0; 1.0 3.0]\n b = [4.0, 5.0]\n x = A \\ b\n println("done")\n x\nend\nsolve_demo()`);
    assert.equal(result.success, true, result.error);
    assert.match(result.output, /done/);
    assert.deepEqual(result.typed_value.shape, [2]);
    assert.ok(Math.abs(result.typed_value.elements[0].value - 1.4) < 1e-12);
    assert.ok(Math.abs(result.typed_value.elements[1].value - 1.2) < 1e-12);
    assert.equal(result.artifacts, undefined);
    const fresh = await run(worker, 2, 'solve_demo()');
    assert.equal(fresh.success, false, 'User definitions must not leak between runs');
    assert.ok(fresh.error?.length > 0, 'A failed run must carry visible error text');
    const matrix = await run(worker, 3, '[1.0 2.0; 3.0 4.0]');
    assert.deepEqual(matrix.typed_value.elements.map(value => value.value), [1, 3, 2, 4]);
    const large = await run(worker, 4, 'zeros(4000)');
    assert.equal(large.success, true, large.error);
    assert.equal(large.truncated, true);
    assert.equal(large.typed_value.elements, undefined);
    assert.deepEqual(large.typed_value.shape, [4000]);
    const invalidDimensions = await run(worker, 5, '[1.0 0.0; 0.0 1.0] * [1.0, 2.0, 3.0]');
    assert.equal(invalidDimensions.success, false);
    assert.match(invalidDimensions.error, /dimension|length|size/i);
    const recovered = await run(worker, 6, '1 + 2');
    assert.equal(recovered.success, true, recovered.error);
    assert.equal(recovered.typed_value?.value ?? recovered.value, 3);
  } finally { await worker.terminate(); }
});

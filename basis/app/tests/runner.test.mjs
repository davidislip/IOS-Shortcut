import test from 'node:test';
import assert from 'node:assert/strict';
import { JuliaRunner } from '../runner.js';
import { normalize, arrayRows, jsonValue } from '../value.js';

function setup() {
  const workers = [];
  const events = [];
  const runner = new JuliaRunner({
    notify: event => events.push(event),
    makeWorker() {
      const worker = { sent: [], postMessage(message) { this.sent.push(message); }, terminate() { this.terminated = true; }, emit(data) { this.onmessage({ data }); } };
      workers.push(worker);
      return worker;
    },
  });
  return { runner, workers, events };
}
test('Stop kills execution and rejects a terminated worker’s delayed result', () => {
  const { runner, workers, events } = setup();
  try {
    workers[0].emit({ type: 'ready', version: 'test' });
    assert.equal(runner.run('slow source'), true);
    assert.equal(runner.run('second simultaneous source'), false);
    const oldId = workers[0].sent[0].id;
    runner.stop();
    assert.equal(workers[0].terminated, true);
    assert.equal(workers.length, 2);
    workers[1].emit({ type: 'ready', version: 'test' });
    runner.run('new source');
    workers[0].emit({ type: 'result', id: oldId, result: { success: true } });
    assert.equal(events.filter(event => event.type === 'result').length, 0);
    workers[1].emit({ type: 'result', id: workers[1].sent[0].id, result: { success: true } });
    assert.equal(events.at(-1).source, 'new source');
    assert.equal(runner.active, null);
  } finally { runner.dispose(); }
});
test('Deadline restarts a worker that never responds', async () => {
  const { runner, workers, events } = setup();
  try {
    workers[0].emit({ type: 'ready' });
    runner.run('while true; end', 10);
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(workers[0].terminated, true);
    assert.equal(workers.length, 2);
    assert.match(events.find(event => event.type === 'stopped').reason, /Time limit/);
  } finally { runner.dispose(); }
});
test('VM Maps, typed arrays, large integers, and column-major shapes remain meaningful', () => {
  const value = normalize(new Map([['array', new Float64Array([1, 2])], ['integer', 9007199254740993n]]));
  assert.deepEqual(value, { array: [1, 2], integer: '9007199254740993' });
  const typed = { type: 'array', shape: [2, 3], elements: [1, 2, 3, 4, 5, 6] };
  assert.deepEqual(arrayRows(typed), [[1, 3, 5], [2, 4, 6]]);
  assert.equal(arrayRows({ ...typed, shape: [3, 3] }), null);
  assert.match(jsonValue({ a: NaN, b: Infinity }), /"NaN"/);
});

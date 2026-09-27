import test from 'node:test';
import assert from 'node:assert/strict';
import { flatNumeric, parseNativeValues } from './numeric.mjs';

test('typed numbers reject missing, nonnumeric, and nonfinite values', () => {
  for (const type of ['float', 'int']) {
    for (const value of [null, undefined, false, true, NaN, Infinity, -Infinity, '', ' ', 'NaN', 'Infinity', '0x0', [], {}]) {
      assert.equal(flatNumeric({ type, value }), null, type + ': ' + String(value));
    }
  }
  assert.equal(flatNumeric({ type: 'int', value: 0.5 }), null);
  assert.equal(flatNumeric({ type: 'int', value: '0.5' }), null);
  assert.equal(flatNumeric({ type: 'int', value: '1e2' }), null);
  assert.equal(flatNumeric({ type: 'float', value: '0.0' }), null);
});

test('NaN serialized through the worker cannot satisfy an expected zero', () => {
  const serialized = JSON.parse(JSON.stringify({
    type: 'array', elements: [{ type: 'float', value: NaN }],
  }));
  assert.equal(serialized.elements[0].value, null);
  assert.equal(flatNumeric(serialized), null);
  assert.notDeepEqual(flatNumeric(serialized), [0]);
});

test('finite numbers and validated serialized integers remain supported', () => {
  assert.deepEqual(flatNumeric({ type: 'float', value: 0 }), [0]);
  assert.deepEqual(flatNumeric({ type: 'float', value: -1.25e-12 }), [-1.25e-12]);
  assert.deepEqual(flatNumeric({ type: 'int', value: 42 }), [42]);
  assert.deepEqual(flatNumeric({ type: 'int', value: '-42' }), [-42]);
  assert.deepEqual(flatNumeric({
    type: 'array', elements: [{ type: 'int', value: '0' }, { type: 'float', value: 1.5 }],
  }), [0, 1.5]);
  assert.equal(flatNumeric({ type: 'array', elements: [{ type: 'float', value: 1 }, { type: 'int', value: null }] }), null);
  assert.equal(flatNumeric({ type: 'array' }), null);
  assert.equal(flatNumeric(null), null);
});

test('native output rejects missing or blank numeric fields', () => {
  for (const value of [null, undefined, '', ' ', ',', '0,', ',0', '0,,1', '0, ,1', '0,NaN', 'Inf', '0x0', 'true', '1e9999']) {
    assert.equal(parseNativeValues(value), null, String(value));
  }
});

test('native output accepts complete finite decimal fields', () => {
  assert.deepEqual(parseNativeValues('0'), [0]);
  assert.deepEqual(parseNativeValues('1.25,-2,3.0e-6'), [1.25, -2, 3e-6]);
  assert.deepEqual(parseNativeValues(' 0.0, +2, .5 '), [0, 2, 0.5]);
});


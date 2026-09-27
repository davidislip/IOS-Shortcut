import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadRuntime, selectRuntime } from '../../runtime-selection.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
async function fixture(t) {
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(path.join(parent, 'basis-runtime-lock-'));
  t.after(async () => {
    // Only remove the temporary directory created by this test, inside tmpdir.
    const target = await realpath(root);
    assert.equal(path.dirname(target), parent);
    assert.ok(path.basename(target).startsWith('basis-runtime-lock-'));
    await rm(target, { recursive: true, force: true });
  });
  const runtimeDir = path.join(root, 'candidate', 'pkg');
  await mkdir(runtimeDir, { recursive: true });
  const wasm = 'tiny fake binary; never instantiated';
  const glue = '// tiny fake glue; never imported';
  const patch = 'tracked source patch fixture';
  const metadata = { source: 'https://example.invalid/runtime', revision: 'source-revision', wasmSHA256: sha(wasm), trackedPatchSHA256: sha(patch) };
  const record = JSON.stringify(metadata);
  const lock = { schemaVersion: 1, runtimeDir: 'candidate/pkg', noticesDir: 'source', version: '0.11.1', wasmSHA256: sha(wasm), glueSHA256: sha(glue), provenanceSHA256: sha(record) };
  await writeFile(path.join(runtimeDir, 'subset_julia_vm_web_bg.wasm'), wasm);
  await writeFile(path.join(runtimeDir, 'subset_julia_vm_web.js'), glue);
  await writeFile(path.join(runtimeDir, 'package.json'), JSON.stringify({ name: 'subset_julia_vm_web', version: '0.11.1' }));
  await writeFile(path.join(runtimeDir, 'runtime-source.patch'), patch);
  await writeFile(path.join(runtimeDir, 'runtime-provenance.json'), record);
  await writeFile(path.join(root, 'runtime-lock.json'), JSON.stringify(lock));
  return { root, runtimeDir, metadata, record, lock, glue };
}

test('Locked selection imports explicit source provenance without inferring a parent commit', async t => {
  const { root, runtimeDir, metadata } = await fixture(t);
  const result = await loadRuntime(root);
  assert.equal(result.kind, 'locked');
  assert.equal(result.runtimeDir, runtimeDir);
  assert.equal(result.pkg.version, '0.11.1');
  assert.deepEqual(result.sourceBuild.metadata, metadata);
  assert.equal(result.sourceBuild.verifiedWasmSHA256, metadata.wasmSHA256);
  assert.equal(result.commit, undefined);
});

test('Changed candidate binary is rejected; a present lock never falls back', async t => {
  const { root, runtimeDir, lock } = await fixture(t);
  await writeFile(path.join(runtimeDir, 'subset_julia_vm_web_bg.wasm'), 'unapproved replacement');
  await assert.rejects(loadRuntime(root), /runtime-lock.json WASM SHA-256/);
  await writeFile(path.join(root, 'runtime-lock.json'), JSON.stringify({ ...lock, runtimeDir: 'missing/pkg' }));
  await assert.rejects(loadRuntime(root), error => error.code === 'ENOENT' && error.path.includes(path.join('missing', 'pkg')));
});

test('Locked package version, glue and source record must match their approved values', async t => {
  const { root, runtimeDir, record, glue } = await fixture(t);
  await writeFile(path.join(runtimeDir, 'subset_julia_vm_web.js'), 'unapproved glue');
  await assert.rejects(loadRuntime(root), /runtime-lock.json glue SHA-256/);
  await writeFile(path.join(runtimeDir, 'subset_julia_vm_web.js'), glue);
  await writeFile(path.join(runtimeDir, 'package.json'), JSON.stringify({ version: 'unexpected-version' }));
  await assert.rejects(loadRuntime(root), /runtime-lock.json version/);
  await writeFile(path.join(runtimeDir, 'package.json'), JSON.stringify({ version: '0.11.1' }));
  await writeFile(path.join(runtimeDir, 'runtime-provenance.json'), `${record}\n`);
  await assert.rejects(loadRuntime(root), /runtime-lock.json provenance SHA-256/);
});

test('Explicit overrides still validate provenance and tracked source patch', async t => {
  const { root, runtimeDir, metadata } = await fixture(t);
  await writeFile(path.join(root, 'runtime-lock.json'), 'invalid lock bypassed only by explicit selection');
  assert.equal((await loadRuntime(root, { runtimeDir })).kind, 'explicit');
  await writeFile(path.join(runtimeDir, 'runtime-source.patch'), 'changed patch');
  await assert.rejects(loadRuntime(root, { runtimeDir }), /runtime-source.patch/);
  await writeFile(path.join(runtimeDir, 'runtime-provenance.json'), JSON.stringify({ ...metadata, wasmSHA256: '0'.repeat(64) }));
  await assert.rejects(loadRuntime(root, { runtimeDir }), /runtime-provenance.json.*WASM SHA-256/);
});

test('Baseline is selected only when no lock exists; malformed and escaping locks fail', async t => {
  const { root, lock } = await fixture(t);
  await writeFile(path.join(root, 'runtime-lock.json'), JSON.stringify({ ...lock, runtimeDir: '../elsewhere' }));
  await assert.rejects(selectRuntime(root), /must stay inside/);
  await writeFile(path.join(root, 'runtime-lock.json'), JSON.stringify({ ...lock, noticesDir: '../elsewhere' }));
  await assert.rejects(selectRuntime(root, { noticesDir: path.join(root, 'source') }), /must stay inside/);
  await writeFile(path.join(root, 'runtime-lock.json'), '{');
  await assert.rejects(selectRuntime(root), SyntaxError);
  await rm(path.join(root, 'runtime-lock.json'));
  const selection = await selectRuntime(root);
  assert.equal(selection.kind, 'baseline');
  assert.equal(selection.runtimeDir, path.join(root, 'upstream', 'subset_julia', 'pkg'));
});

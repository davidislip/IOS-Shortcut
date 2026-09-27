import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const BASELINE_SHA256 = '4b4e4613382444e25fa41500e7fcbfa2c29c8af8149b047077687e1097eb2353';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const isHash = value => typeof value === 'string' && /^[a-f\d]{64}$/i.test(value);
const matchesHash = (expected, actual) => isHash(expected) && expected.toLowerCase() === actual;

function lockedPath(root, value, field) {
  if (typeof value !== 'string' || !value || path.isAbsolute(value) || path.win32.isAbsolute(value)) throw new Error(`runtime-lock.json ${field} must be a project-relative path.`);
  const resolved = path.resolve(root, ...value.split(/[\\/]/));
  const relative = path.relative(root, resolved);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(`runtime-lock.json ${field} must stay inside the Basis project.`);
  return resolved;
}

export async function selectRuntime(root, { runtimeDir, noticesDir } = {}) {
  const defaultNotices = path.join(root, 'upstream', 'julia-vm-oss');
  if (runtimeDir) return { kind: 'explicit', runtimeDir: path.resolve(runtimeDir), noticesDir: noticesDir ?? defaultNotices, lock: null };
  let bytes;
  try { bytes = await readFile(path.join(root, 'runtime-lock.json')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!bytes) return { kind: 'baseline', runtimeDir: path.join(root, 'upstream', 'subset_julia', 'pkg'), noticesDir: noticesDir ?? defaultNotices, lock: null };
  const lock = JSON.parse(bytes.toString('utf8'));
  if (!lock || lock.schemaVersion !== 1 || typeof lock.version !== 'string' || !lock.version || !isHash(lock.wasmSHA256) || !isHash(lock.provenanceSHA256) || (lock.glueSHA256 !== undefined && !isHash(lock.glueSHA256))) {
    throw new Error('runtime-lock.json requires schemaVersion 1, version, wasmSHA256 and provenanceSHA256; glueSHA256 is optional.');
  }
  const lockedNotices = lockedPath(root, lock.noticesDir, 'noticesDir');
  return {
    kind: 'locked',
    runtimeDir: lockedPath(root, lock.runtimeDir, 'runtimeDir'),
    noticesDir: noticesDir ?? lockedNotices,
    lock: { file: 'runtime-lock.json', sha256: sha(bytes), metadata: lock },
  };
}

export async function loadRuntime(root, options = {}) {
  const selection = await selectRuntime(root, options);
  const { runtimeDir, lock } = selection;
  const wasm = await readFile(path.join(runtimeDir, 'subset_julia_vm_web_bg.wasm'));
  const wasmHash = sha(wasm);
  const pkg = JSON.parse(await readFile(path.join(runtimeDir, 'package.json'), 'utf8'));
  const glueHash = sha(await readFile(path.join(runtimeDir, 'subset_julia_vm_web.js')));
  if (selection.kind === 'baseline' && (wasmHash !== BASELINE_SHA256 || pkg.version !== '0.12.2')) throw new Error('Default bundled runtime differs from the inspected 0.12.2 snapshot. Select the intended build with --runtime-dir.');
  if (lock) {
    if (!matchesHash(lock.metadata.wasmSHA256, wasmHash)) throw new Error('runtime-lock.json WASM SHA-256 does not match the candidate. Validate the rebuilt candidate before updating the lock.');
    if (lock.metadata.version !== pkg.version) throw new Error('runtime-lock.json version does not match the candidate package.');
    if (lock.metadata.glueSHA256 !== undefined && !matchesHash(lock.metadata.glueSHA256, glueHash)) throw new Error('runtime-lock.json glue SHA-256 does not match the candidate.');
  }
  let sourceBuild = null;
  let recordBytes;
  try { recordBytes = await readFile(path.join(runtimeDir, 'runtime-provenance.json')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (lock && (!recordBytes || !matchesHash(lock.metadata.provenanceSHA256, sha(recordBytes)))) throw new Error('runtime-lock.json provenance SHA-256 does not match the candidate source build record.');
  if (recordBytes) {
    const metadata = JSON.parse(recordBytes.toString('utf8'));
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) || !matchesHash(metadata.wasmSHA256, wasmHash)) throw new Error('runtime-provenance.json does not identify the selected WASM SHA-256. Rebuild the runtime or select its matching package.');
    if (metadata.trackedPatchSHA256 !== undefined && !matchesHash(metadata.trackedPatchSHA256, sha(await readFile(path.join(runtimeDir, 'runtime-source.patch'))))) throw new Error('runtime-source.patch does not match its recorded SHA-256.');
    sourceBuild = { record: './runtime/runtime-provenance.json', recordSHA256: sha(recordBytes), verifiedWasmSHA256: wasmHash, metadata };
  }
  return { ...selection, pkg, wasmHash, wasmBytes: wasm.length, glueHash, sourceBuild };
}

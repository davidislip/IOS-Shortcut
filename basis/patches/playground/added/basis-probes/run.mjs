import { Worker } from 'node:worker_threads';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFile, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { cases } from './cases.mjs';
import { flatNumeric, parseNativeValues } from './numeric.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const options = { wasmDir: resolve(here, '../pkg'), report: resolve(here, 'results.json'), timeout: 30000 };
const usage = 'Usage: node basis-probes/run.mjs <julia-executable> [--wasm-dir DIR] [--report FILE] [--filter REGEX] [--timeout MS] [--skip-lifecycle]';
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--help') { console.log(usage); process.exit(0); }
  if (arg === '--skip-lifecycle') { options.skipLifecycle = true; continue; }
  const key = { '--julia': 'julia', '--wasm-dir': 'wasmDir', '--report': 'report', '--filter': 'filter', '--timeout': 'timeout' }[arg];
  if (key) {
    if (!process.argv[i + 1]) throw new Error('Missing value for ' + arg + '\n' + usage);
    options[key] = process.argv[++i];
  } else if (!arg.startsWith('--') && !options.julia) {
    options.julia = arg;
  } else { throw new Error('Unknown argument: ' + arg + '\n' + usage); }
}
if (!options.julia) throw new Error(usage);
options.wasmDir = resolve(options.wasmDir);
options.report = resolve(options.report);
options.timeout = Number(options.timeout);
if (!Number.isSafeInteger(options.timeout) || options.timeout < 100) throw new Error('--timeout must be an integer of at least 100 milliseconds');
const selected = options.filter ? cases.filter((item) => new RegExp(options.filter).test(item.name)) : cases;
if (!selected.length) throw new Error('No fixtures match --filter');
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
function git(...args) {
  const result = spawnSync('git', ['-C', resolve(here, '..'), ...args], { encoding: 'utf8', timeout: 5000 });
  return result.status === 0 ? result.stdout.trim() : null;
}
const provenancePath = resolve(options.wasmDir, 'runtime-provenance.json');
const report = {
  schemaVersion: 2,
  oracle: { product: 'standard Julia', requiredVersion: '1.12.1' },
  runtimeContract: { requiredABI: 3, executionExport: 'run_from_source', numericResultField: 'typed_value' },
  createdAt: new Date().toISOString(),
  environment: { node: process.version, platform: process.platform, arch: process.arch },
  options,
  artifacts: {
    provenance: existsSync(provenancePath) ? { path: provenancePath, sha256: sha256(provenancePath), data: JSON.parse(readFileSync(provenancePath, 'utf8').replace(/^\uFEFF/, '')) } : null,
    wasm: { path: resolve(options.wasmDir, 'subset_julia_vm_web_bg.wasm'), sha256: sha256(resolve(options.wasmDir, 'subset_julia_vm_web_bg.wasm')) },
    glue: { path: resolve(options.wasmDir, 'subset_julia_vm_web.js'), sha256: sha256(resolve(options.wasmDir, 'subset_julia_vm_web.js')) },
    suite: { sha256: sha256(resolve(here, 'cases.mjs')), runnerSHA256: sha256(fileURLToPath(import.meta.url)), workerSHA256: sha256(resolve(here, 'worker.mjs')), numericParserSHA256: sha256(resolve(here, 'numeric.mjs')) },
    playground: { revision: git('rev-parse', 'HEAD'), branch: git('branch', '--show-current'), status: git('status', '--short') },
  },
  scope: 'Local Node/V8 execution of local WASM with fetch disabled; not Safari/iPad, PWA, or general Julia compatibility validation.',
  cases: [],
};

let worker = null;
let nextId = 0;
async function start() {
  const previous = worker;
  worker = null;
  if (previous) await previous.terminate();
  const target = new Worker(new URL('./worker.mjs', import.meta.url), { workerData: { wasmDir: options.wasmDir } });
  worker = target;
  // Permanent handlers also cover failures between requests.
  target.on('error', () => { if (worker === target) worker = null; });
  target.on('exit', () => { if (worker === target) worker = null; });
  return new Promise((done) => {
    const finish = (value) => { clearTimeout(timer); target.off('message', message); target.off('error', error); target.off('exit', exit); done(value); };
    const message = (value) => { if (value.type === 'ready') finish(value); };
    const error = (value) => finish({ workerError: String(value) });
    const exit = (code) => finish({ workerError: 'Worker exited during startup: ' + code });
    const timer = setTimeout(() => {
      if (worker === target) worker = null;
      finish({ workerError: 'Worker startup timed out', timedOut: true });
      void target.terminate();
    }, options.timeout);
    target.on('message', message); target.once('error', error); target.once('exit', exit);
  });
}
async function run(source, timeoutMs = options.timeout) {
  if (!worker) {
    const startup = await start();
    if (startup.workerError) return startup;
  }
  const target = worker;
  const id = ++nextId;
  return new Promise((done) => {
    const finish = (value) => { clearTimeout(timer); target.off('message', message); target.off('error', error); target.off('exit', exit); done(value); };
    const message = (value) => { if (value.id === id) finish(value); };
    const error = (value) => finish({ workerError: String(value) });
    const exit = (code) => finish({ workerError: 'Worker exited during execution: ' + code });
    const timer = setTimeout(() => {
      if (worker === target) worker = null;
      finish({ timedOut: true, timeoutMs });
      void target.terminate();
    }, timeoutMs);
    target.on('message', message); target.once('error', error); target.once('exit', exit);
    try { target.postMessage({ id, source }); } catch (value) { error(value); }
  });
}
function nativeExec(args) {
  return new Promise((done) => {
    const before = performance.now();
    execFile(options.julia, args, { encoding: 'utf8', timeout: options.timeout, maxBuffer: 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      done({ status: error ? (error.code ?? null) : 0, killed: error?.killed ?? false, signal: error?.signal ?? null,
        stdout, stderr, error: error && typeof error.code !== 'number' ? error.message : undefined, ms: performance.now() - before });
    });
  });
}
async function nativeRun(fixture) {
  const native = await nativeExec(['--startup-file=no', '--history-file=no', '-e',
    'try; value = include(ARGS[1]); println("__BASIS_RESULT__" * join(vec(value), ",")); println("__BASIS_SHAPE__" * join(size(value), ",")); catch exception; while exception isa LoadError; exception = exception.error; end; showerror(stderr, exception); println(stderr); exit(2); end', fixture]);
  const line = native.stdout?.split(/\r?\n/).find((item) => item.startsWith('__BASIS_RESULT__'));
  const shapeLine = native.stdout?.split(/\r?\n/).find((item) => item.startsWith('__BASIS_SHAPE__'));
  native.shape = shapeLine ? parseNativeValues(shapeLine.slice('__BASIS_SHAPE__'.length)) : null;
  native.values = line ? parseNativeValues(line.slice('__BASIS_RESULT__'.length)) : null;
  return native;
}
function matchesShape(actual, expected) {
  return !expected || (Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => value === expected[index]));
}
function matches(actual, expected, fixture) {
  return actual?.length === expected.length && actual.every((value, index) => Number.isFinite(value) &&
    Math.abs(value - expected[index]) <= (fixture.atol ?? 1e-10) + (fixture.rtol ?? 1e-9) * Math.abs(expected[index]));
}
function describeFailure(wasm) {
  return wasm.result?.error_message ?? wasm.thrown ?? wasm.workerError ?? (wasm.timedOut ? 'Timed out' : JSON.stringify(wasm.values));
}
try {
  report.nativeRuntime = await nativeExec(['--startup-file=no', '--history-file=no', '--version']);
  if (report.nativeRuntime.status !== 0) throw new Error('Native Julia could not start: ' + (report.nativeRuntime.error ?? report.nativeRuntime.stderr));
  report.oracle.versionMatches = report.nativeRuntime.stdout.trim() === 'julia version ' + report.oracle.requiredVersion;
  if (!report.oracle.versionMatches) throw new Error('Expected standard Julia ' + report.oracle.requiredVersion + ', got ' + report.nativeRuntime.stdout.trim());
  report.runtime = await start();
  if (report.runtime.workerError) throw new Error(report.runtime.workerError);
  if (report.runtime.abi !== report.runtimeContract.requiredABI) throw new Error('Expected WASM ABI ' + report.runtimeContract.requiredABI + ', got ' + report.runtime.abi);
  report.warmup = await run('1 + 1');
  console.log('Runtime ' + report.runtime.version + '; Julia ' + report.nativeRuntime.stdout.trim() + '; ' + selected.length + ' fixtures');
  for (const fixture of selected) {
    const path = resolve(here, 'fixtures', fixture.name + '.jl');
    const [native, wasm] = await Promise.all([nativeRun(path), run(readFileSync(path, 'utf8'))]);
    const actual = flatNumeric(wasm.result?.typed_value);
    const expectedError = fixture.error ? new RegExp(fixture.error, 'i') : null;
    native.pass = expectedError
      ? native.status === 2 && !native.killed && !native.error && expectedError.test(native.stderr)
      : native.status === 0 && matches(native.values, fixture.expected, fixture) && matchesShape(native.shape, fixture.shape);
    const wasmPass = expectedError
      ? wasm.result?.success === false && expectedError.test(wasm.result.error_message ?? '')
      : wasm.result?.success === true && matches(actual, fixture.expected, fixture) && matchesShape(wasm.result.typed_value?.shape, fixture.shape);
    const nativeAgreement = expectedError ? native.pass && wasmPass : native.status === 0 && matches(actual, native.values ?? [], fixture);
    const result = { ...fixture, fixtureSHA256: sha256(path), native, wasm: { pass: wasmPass, values: actual, shape: wasm.result?.typed_value?.shape ?? null, ...wasm }, nativeAgreement };
    report.cases.push(result);
    console.log(fixture.name + ': Julia=' + (native.pass ? 'PASS' : 'FAIL') + ' WASM=' + (wasmPass ? 'PASS' : 'FAIL') +
      ' ' + Math.round(wasm.ms ?? 0) + ' ms' + (!wasmPass ? ' ' + describeFailure(result.wasm) : ''));
  }
  if (!options.skipLifecycle) {
    const defined = await run('basis_private_value = 99\nbasis_private_value');
    const absent = await run('basis_private_value');
    report.freshState = { defined, absent, pass: defined.result?.value === 99 && absent.result?.success === false && /not defined|UndefVarError/.test(absent.result?.error_message ?? '') };
    console.log('Fresh run state: ' + (report.freshState.pass ? 'PASS' : 'FAIL'));
    const runaway = await run('while true\nend', 1500);
    report.cancellation = { runaway, pass: runaway.timedOut === true };
    report.restart = await start();
    report.recovery = await run('2 + 3');
    report.cancellation.pass = report.cancellation.pass && report.recovery.result?.value === 5;
    console.log('Worker cancellation/restart: ' + (report.cancellation.pass ? 'PASS' : 'FAIL'));
  }
} catch (error) {
  report.fatalError = String(error.stack ?? error);
  console.error(report.fatalError);
} finally {
  if (worker) await worker.terminate();
  const failures = report.cases.filter((item) => !item.native.pass || !item.wasm.pass || !item.nativeAgreement).length;
  report.summary = { suiteCount: cases.length, selected: selected.length, executed: report.cases.length, passed: report.cases.length - failures, failures,
    nativePassed: report.cases.filter((item) => item.native.pass).length,
    wasmPassed: report.cases.filter((item) => item.wasm.pass).length,
    lifecycleSkipped: !!options.skipLifecycle };
  report.summary.pass = !report.fatalError && report.warmup?.result?.value === 2 && report.summary.executed === selected.length && !failures &&
    !!(options.skipLifecycle || (report.freshState?.pass && report.cancellation?.pass));
  report.summary.fullGatePass = report.summary.pass && selected.length === cases.length && !options.skipLifecycle;
  report.completedAt = new Date().toISOString();
  mkdirSync(dirname(options.report), { recursive: true });
  writeFileSync(options.report, JSON.stringify(report, null, 2) + '\n');
  console.log('Result: ' + report.summary.passed + '/' + selected.length + ' passed both runtimes; report ' + options.report);
  process.exitCode = report.summary.pass ? 0 : 1;
}






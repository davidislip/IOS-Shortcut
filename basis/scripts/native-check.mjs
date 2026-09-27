// Rebuilt native SubsetJuliaVM gate. This is not the standard-Julia oracle.
// CLI contract: sjulia.rs documents file / -e execution; runners.rs exits 1
// for VM errors or any_test_failed(), while trailing script values stay silent.
import { execFile, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const basis = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = resolve(basis, 'upstream/julia-vm-oss');
const probeDir = resolve(basis, 'upstream/subset_julia/basis-probes/fixtures');
const options = { report: resolve(basis, 'reports/native-runtime.json'), timeout: 120000, maxBuffer: 1024 * 1024 };
const usage = 'Usage: node basis/scripts/native-check.mjs <sjulia.exe> [--report FILE] [--timeout MS] [--filter REGEX] [--skip-control]';
for (let i = 2; i < process.argv.length; i++) {
  const argument = process.argv[i];
  if (argument === '--help') { console.log(usage); process.exit(0); }
  if (argument === '--skip-control') { options.skipControl = true; continue; }
  const key = { '--report': 'report', '--timeout': 'timeout', '--filter': 'filter' }[argument];
  if (key) {
    if (!process.argv[i + 1]) throw new Error('Missing value for ' + argument + '\n' + usage);
    options[key] = process.argv[++i];
  } else if (!argument.startsWith('--') && !options.executable) {
    options.executable = resolve(argument);
  } else { throw new Error('Unknown argument: ' + argument + '\n' + usage); }
}
if (!options.executable) throw new Error(usage);
options.report = resolve(options.report);
options.timeout = Number(options.timeout);
if (!Number.isSafeInteger(options.timeout) || options.timeout < 100) throw new Error('--timeout must be an integer of at least 100 milliseconds');

const fixtures = [
  ['basis_square_solve', 'linalg/basis_square_solve.jl'],
  ['basis_rectangular_solve', 'linalg/basis_rectangular_solve.jl'],
  ['basis_solve_errors_shapes', 'linalg/basis_solve_errors_shapes.jl'],
  ['basis_learner_function_solve', 'linalg/basis_learner_function_solve.jl'],
  ['vec_1d', 'array/vec_1d.jl'],
  ['vec_2d', 'array/vec_2d.jl'],
].map(([name, path]) => ({ name, path: resolve(sourceDir, 'subset_julia_vm/tests/fixtures', path), mode: 'file' }));
fixtures.push({ name: 'conditioning-sweep', path: resolve(probeDir, 'conditioning-sweep.jl'), mode: 'expression' });
const selected = options.filter ? fixtures.filter((fixture) => new RegExp(options.filter).test(fixture.name)) : fixtures;
if (!selected.length) throw new Error('No fixtures match --filter');

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function hashFile(path) {
  // Native binaries can be large; never load the entire executable into memory.
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
function git(args, binary = false) {
  const result = spawnSync('git', ['-C', sourceDir, ...args], {
    encoding: binary ? undefined : 'utf8', timeout: 10000, maxBuffer: 8 * 1024 * 1024, windowsHide: true,
  });
  if (result.status !== 0 || result.error) throw new Error('Source provenance command failed: git ' + args.join(' ') + ': ' + (result.error?.message ?? String(result.stderr)));
  return binary ? result.stdout : result.stdout.trim();
}
const report = {
  schemaVersion: 1, startedAt: new Date().toISOString(),
  scope: 'Sequential execution of the rebuilt native SubsetJuliaVM CLI; no stock Julia, WASM, browser, or iPad validation.',
  environment: { node: process.version, platform: process.platform, arch: process.arch },
  options,
  cacheEnvironment: {
    CARGO_TARGET_DIR: process.env.CARGO_TARGET_DIR ?? null,
    SJULIA_BASE_CACHE: process.env.SJULIA_BASE_CACHE ?? null,
    SJULIA_PRELUDE_PROGRAM_CACHE: process.env.SJULIA_PRELUDE_PROGRAM_CACHE ?? null,
  },
  cliContract: {
    invocation: ['sjulia file.jl', 'sjulia -e SOURCE'],
    evidence: ['subset_julia_vm/src/bin/sjulia.rs', 'subset_julia_vm/src/bin/sjulia/runners.rs'],
    assertionFailureExit: 'run_compiled_program uses vm.any_test_failed() to select exit code 1; runtime and pipeline errors also exit 1.',
    trailingValues: 'Script results are silent, so conditioning-sweep receives an explicit numerical @test and success marker.',
  },
  cases: [],
};
function save() {
  mkdirSync(dirname(options.report), { recursive: true });
  writeFileSync(options.report, JSON.stringify(report, null, 2) + '\n');
}
let currentChild = null;
let interrupted = null;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { interrupted = signal; currentChild?.kill('SIGTERM'); });
}
function execute(args) {
  return new Promise((done) => {
    const before = performance.now();
    currentChild = execFile(options.executable, args, {
      cwd: sourceDir, encoding: 'utf8', timeout: options.timeout, maxBuffer: options.maxBuffer, windowsHide: true,
    }, (error, stdout, stderr) => {
      currentChild = null;
      const outputLimited = error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
      done({
        status: error ? (typeof error.code === 'number' ? error.code : null) : 0,
        signal: error?.signal ?? null, killed: error?.killed ?? false,
        timedOut: !!error?.killed && !outputLimited && !interrupted,
        outputLimited, interrupted,
        error: error ? { code: error.code ?? null, message: error.message } : null,
        stdout, stderr, durationMs: performance.now() - before,
      });
    });
  });
}
try {
  report.binary = { path: options.executable, sha256: await hashFile(options.executable) };
  const changed = git(['diff', '--name-only', 'HEAD', '-z']).split('\0').filter(Boolean);
  const added = git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter((path) => /\.(jl|rs|toml)$/.test(path));
  const paths = [...new Set([
    'Cargo.toml', 'Cargo.lock',
    'subset_julia_vm/src/bin/sjulia.rs', 'subset_julia_vm/src/bin/sjulia/runners.rs',
    'subset_julia_vm/src/julia/base/array.jl',
    'subset_julia_vm/src/julia/stdlib/LinearAlgebra/src/LinearAlgebra.jl',
    'subset_julia_vm_vm/src/vm/builtins_linalg.rs', ...changed, ...added,
  ])].sort();
  report.source = {
    directory: sourceDir, revision: git(['rev-parse', 'HEAD']), branch: git(['branch', '--show-current']),
    status: git(['status', '--short']), trackedPatchSHA256: sha(git(['diff', '--binary', 'HEAD'], true)),
    files: Object.fromEntries(paths.map((path) => [path, existsSync(resolve(sourceDir, path)) ? sha(readFileSync(resolve(sourceDir, path))) : null])),
    note: 'Hashes capture the current source snapshot; build provenance is required separately to tie it to the executable.',
  };
  report.runnerSHA256 = sha(readFileSync(fileURLToPath(import.meta.url)));
  save();
  for (const fixture of selected) {
    if (interrupted) break;
    const input = readFileSync(fixture.path, 'utf8');
    const assertion = '\nusing Test\n@test isapprox(changes, [1.0, 1.0, 1.0]; atol=1e-10, rtol=1e-9)\nprintln("__BASIS_CONDITIONING_PASS__")\n';
    const expression = fixture.mode === 'expression' ? input + assertion : null;
    const args = expression ? ['-e', expression] : [fixture.path];
    console.log('Running ' + fixture.name + ' (deadline ' + options.timeout + ' ms)');
    const result = await execute(args);
    const pass = result.status === 0 && !result.error && !result.interrupted &&
      (fixture.mode !== 'expression' || result.stdout.includes('__BASIS_CONDITIONING_PASS__'));
    report.cases.push({
      ...fixture, fixtureSHA256: sha(input), invocation: args,
      executedSourceSHA256: sha(expression ?? input), expectedStatus: 0, pass, ...result,
    });
    console.log(fixture.name + ': ' + (pass ? 'PASS' : 'FAIL') + ' status=' + result.status + ' ' + Math.round(result.durationMs) + ' ms' +
      (result.timedOut ? ' timeout' : '') + (result.outputLimited ? ' output limit' : ''));
    save();
  }
  if (!options.skipControl && !interrupted) {
    const source = 'using Test\n@test false\n';
    console.log('Running expected-failing @test control');
    const result = await execute(['-e', source]);
    report.failureControl = {
      source, sourceSHA256: sha(source), expectedStatus: 1,
      pass: result.status === 1 && !result.timedOut && !result.outputLimited && !result.interrupted &&
        /Test Failed/.test(result.stdout + result.stderr),
      ...result,
    };
    console.log('Assertion failure exit: ' + (report.failureControl.pass ? 'PASS' : 'FAIL'));
  }
} catch (error) {
  report.fatalError = String(error.stack ?? error);
  console.error(report.fatalError);
} finally {
  report.completedAt = new Date().toISOString();
  report.summary = {
    selected: selected.length, executed: report.cases.length,
    passed: report.cases.filter((fixture) => fixture.pass).length,
    failures: report.cases.filter((fixture) => !fixture.pass).length,
    completeFixtureSelection: selected.length === fixtures.length,
    failureControlSkipped: !!options.skipControl, interrupted,
  };
  report.summary.pass = !report.fatalError && !interrupted && report.summary.executed === selected.length &&
    report.summary.failures === 0 && !!(options.skipControl || report.failureControl?.pass);
  report.summary.fullGatePass = report.summary.pass && report.summary.completeFixtureSelection && !options.skipControl;
  save();
  console.log('Native gate: ' + report.summary.passed + '/' + selected.length + ' fixtures; report ' + options.report);
  process.exitCode = report.summary.pass ? 0 : 1;
}

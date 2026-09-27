import { cp, mkdir, readFile, readdir, rm, lstat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build as bundle } from 'esbuild';
import { loadRuntime } from './runtime-selection.mjs';
import { editorNotices } from './scripts/editor-notices.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  if (!['--runtime-dir', '--notices-dir'].includes(key) || !process.argv[i + 1]) throw new Error('Usage: node build.mjs [--runtime-dir pkg] [--notices-dir runtime-source-root]');
  options[key] = path.resolve(process.argv[i + 1]);
}
const runtime = await loadRuntime(root, { runtimeDir: options['--runtime-dir'], noticesDir: options['--notices-dir'] });
const { runtimeDir, noticesDir, pkg, wasmHash, wasmBytes, sourceBuild } = runtime;
const destination = path.resolve(root, 'dist');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
await readFile(path.join(noticesDir, 'LICENSE'));
// Validate and bundle in memory before replacing the last working offline build.
const editorBundle = await bundle({
  absWorkingDir: root,
  entryPoints: ['app/editor.js'],
  outfile: 'dist/editor.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['safari16', 'chrome110'],
  minify: true,
  legalComments: 'none',
  metafile: true,
  write: false,
  logLevel: 'warning',
});
const editorLicenses = await editorNotices(root, editorBundle.metafile);
async function listFiles(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'tests' || entry.name === 'node_modules') continue;
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink not allowed in build inputs: ${relative}`);
    if (entry.isDirectory()) result.push(...await listFiles(path.join(directory, entry.name), relative));
    else result.push(relative);
  }
  return result.sort();
}
function gitInfo(directory) {
  try {
    return { commit: execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(), dirty: !!execFileSync('git', ['-C', directory, 'status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() };
  } catch { return { commit: null, dirty: null }; }
}
// This is the sole deletion target: a fixed, non-symlink child of this project.
if (destination !== path.join(root, 'dist') || path.dirname(destination) !== root) throw new Error('Unsafe build destination');
try { if ((await lstat(destination)).isSymbolicLink()) throw new Error('Build destination must not be a symlink'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const file of await listFiles(path.join(root, 'app'))) {
  if (file === 'sw.js' || file === 'editor.js' || file.endsWith('.md')) continue;
  await mkdir(path.dirname(path.join(destination, file)), { recursive: true });
  await cp(path.join(root, 'app', file), path.join(destination, file));
}
for (const output of editorBundle.outputFiles) await writeFile(output.path, output.contents);
await writeFile(path.join(destination, 'EDITOR-LICENSES.txt'), editorLicenses.text);
await cp(runtimeDir, path.join(destination, 'runtime'), { recursive: true, filter: source => !['node_modules', '.git'].includes(path.basename(source)) });
await cp(path.join(noticesDir, 'LICENSE'), path.join(destination, 'RUNTIME-LICENSE.txt'));
// The vendored package combines notices to avoid hundreds of offline downloads.
// Source rebuilds may still use the upstream notice directory directly.
let dependencyNoticesPath = 'THIRD-PARTY-LICENSES.txt';
try { await cp(path.join(noticesDir, 'THIRD_PARTY_NOTICES.txt'), path.join(destination, dependencyNoticesPath)); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  dependencyNoticesPath = 'THIRD_PARTY_NOTICES/';
  await cp(path.join(noticesDir, 'THIRD_PARTY_NOTICES'), path.join(destination, 'THIRD_PARTY_NOTICES'), { recursive: true });
}
const binaryNote = runtime.kind !== 'baseline'
  ? sourceBuild
    ? 'Selected runtime source build metadata is preserved in runtime/runtime-provenance.json and verified against the selected WASM SHA-256. Any recorded tracked source patch is also retained and hash-checked.'
    : 'Runtime directory explicitly selected at build time. No runtime-provenance.json was supplied, so its source build is unknown. See provenance.json for the selected package version and WASM SHA-256.'
  : 'The default prebuilt package declares version 0.12.2. The retained public source notices are from version 0.11.1; they do not establish that this binary can be reproduced from that older source. This package remains an internal local prototype.';
await writeFile(path.join(destination, 'THIRD-PARTY.txt'), `Basis Julia runtime prototype\n\nRuntime: SubsetJuliaVM ${pkg.version}\nDeclared package license: ${pkg.license}\nSource: https://github.com/AtelierArith/julia-vm-oss\nPlayground: https://github.com/terasakisatoshi/subset_julia\n\n${binaryNote}\n\nThe source Apache-2.0 license is retained in RUNTIME-LICENSE.txt.\nSource dependency notices are retained in ${dependencyNoticesPath}.\nPackage metadata and README are retained under runtime/.\nThe locally bundled CodeMirror editor and Pluto Julia grammar notices are retained in EDITOR-LICENSES.txt.\nNo graph callbacks, CDN scripts, or remote fonts are used by the shell.\n`);
const files = await listFiles(destination);
const digests = {};
for (const file of files) digests[file] = sha(await readFile(path.join(destination, file)));
const swTemplate = await readFile(path.join(root, 'app', 'sw.js'), 'utf8');
const identity = {
  editor: { bundle: 'editor.js', packages: editorLicenses.packages },
  runtime: {
    name: pkg.name, version: pkg.version, license: pkg.license, sha256: wasmHash, bytes: wasmBytes,
    selection: runtime.kind, lock: runtime.lock, glueSHA256: runtime.glueHash,
    sourceBuild,
    // Only the known default distribution checkout is inferred from its location.
    // A custom pkg can live under an unrelated parent repository.
    distributionCheckout: runtime.kind === 'baseline' ? { repository: 'https://github.com/terasakisatoshi/subset_julia', ...gitInfo(runtimeDir) } : null,
  },
  notices: { purpose: 'License and notice source; not a claim about the binary build source', ...gitInfo(noticesDir) },
  note: binaryNote,
};
const build = sha(JSON.stringify({ digests, swTemplate, identity })).slice(0, 16);
await writeFile(path.join(destination, 'provenance.json'), JSON.stringify({
  build,
  ...identity,
  assets: digests,
}, null, 2) + '\n');
const assets = [...files, 'provenance.json'].map(file => `./${file}`);
await writeFile(path.join(destination, 'sw.js'), swTemplate.replace("'__BASIS_BUILD__'", JSON.stringify(build)).replace('__BASIS_ASSETS__', JSON.stringify(assets)));
console.log(`Built Basis ${build}: SubsetJuliaVM ${pkg.version} (${runtime.kind}), ${assets.length} offline assets, ${(wasmBytes / 1024 / 1024).toFixed(1)} MiB WASM.\n${destination}`);

// Package an already validated runtime for CI. This does not compile or select it.
import { readFile, readdir, mkdir, copyFile, cp, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'upstream', 'julia-vm-oss');
const input = path.join(root, 'runtime-build', 'pkg');
const destination = path.join(root, 'vendor', 'subset-julia');
const notices = path.join(destination, 'notices');
const thirdParty = path.join(notices, 'THIRD_PARTY_NOTICES');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const options = Object.fromEntries(process.argv.slice(2).map(argument => {
  const separator = argument.indexOf('=');
  if (separator < 0) throw new Error('Options must use --name=value.');
  return [argument.slice(0, separator), argument.slice(separator + 1)];
}));
for (const name of Object.keys(options)) {
  if (!['--julia-license-dir'].includes(name)) throw new Error(`Unknown option: ${name}`);
}
const julia = options['--julia-license-dir'];
if (!julia) throw new Error('Supply --julia-license-dir=<Julia installation> to retain its source licenses.');
const juliaLicense = await readFile(path.join(julia, 'LICENSE.md'));
const linearAlgebraLicense = await readFile(path.join(julia, 'share', 'julia', 'stdlib', 'v1.12', 'LinearAlgebra', 'LICENSE.md'));
const metadataBytes = await readFile(path.join(input, 'runtime-provenance.json'));
const metadata = JSON.parse(metadataBytes);
const lock = JSON.parse(await readFile(path.join(root, 'runtime-lock.json')));
const wasm = await readFile(path.join(input, 'subset_julia_vm_web_bg.wasm'));
const glue = await readFile(path.join(input, 'subset_julia_vm_web.js'));
const patch = await readFile(path.join(input, 'runtime-source.patch'));
if (sha(wasm) !== lock.wasmSHA256 || sha(wasm) !== metadata.wasmSHA256 || sha(glue) !== lock.glueSHA256 || sha(metadataBytes) !== lock.provenanceSHA256 || sha(patch) !== metadata.trackedPatchSHA256) {
  throw new Error('The local runtime does not match the validated runtime lock and provenance.');
}

// Depfiles enumerate crates built for this WASM target. They are a conservative
// input inventory: some compiled code can be removed from the final binary.
const dependencyDirectory = path.join(root, 'runtime-build', 'target', 'wasm32-unknown-unknown', metadata.wasmProfile, 'deps');
const crates = new Set();
for (const file of await readdir(dependencyDirectory)) {
  if (!file.endsWith('.d')) continue;
  const text = await readFile(path.join(dependencyDirectory, file), 'utf8');
  for (const match of text.matchAll(/registry[\\/]src[\\/]index\.crates\.io-[^\\/\s]+[\\/]([^\\/\s]+)/g)) crates.add(match[1]);
}
if (!crates.size) throw new Error('No WASM crate dependency inventory found.');
const registryRoot = path.join(root, '.tools', 'cargo', 'registry', 'src');
const registries = (await readdir(registryRoot)).filter(name => name.startsWith('index.crates.io-'));
const noticePattern = /^(licen[sc]e|copying|notice|copyright|unlicense)([-_.].*)?$/i;
const inventory = [];
for (const crate of [...crates].sort()) {
  let directory;
  for (const registry of registries) {
    const candidate = path.join(registryRoot, registry, crate);
    try { await readFile(path.join(candidate, 'Cargo.toml')); directory = candidate; break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!directory) throw new Error(`Missing cached crate: ${crate}`);
  const manifest = await readFile(path.join(directory, 'Cargo.toml'), 'utf8');
  const field = name => manifest.match(new RegExp(`^${name} = "([^"\\n]+)"`, 'm'))?.[1] ?? null;
  const entries = (await readdir(directory, { withFileTypes: true })).filter(entry => noticePattern.test(entry.name));
  if (!entries.length) throw new Error(`Missing crate license files: ${crate}`);
  inventory.push({ directory, crate, name: field('name'), version: field('version'), license: field('license'), repository: field('repository'), entries });
}

await mkdir(destination, { recursive: true });
await cp(input, path.join(destination, 'pkg'), { recursive: true, filter: filename => path.basename(filename) !== '.gitignore' });
await mkdir(notices, { recursive: true });
await copyFile(path.join(source, 'LICENSE'), path.join(notices, 'LICENSE'));
await cp(path.join(source, 'THIRD_PARTY_NOTICES'), thirdParty, { recursive: true });
for (const item of inventory) {
  const target = path.join(thirdParty, item.crate);
  await mkdir(target, { recursive: true });
  for (const entry of item.entries) await cp(path.join(item.directory, entry.name), path.join(target, entry.name), { recursive: true });
  const record = { name: item.name, version: item.version, license: item.license, repository: item.repository, source: 'Exact cached crates.io package selected by Cargo.lock and observed in WASM target depfiles.', noticeFiles: item.entries.map(entry => entry.name).sort() };
  await writeFile(path.join(target, 'BASIS-METADATA.json'), JSON.stringify(record, null, 2) + '\n');
}
const vendorDirectory = path.join(thirdParty, 'astro-float-num-vendored');
await mkdir(vendorDirectory, { recursive: true });
await copyFile(path.join(source, 'vendor', 'astro-float-num', 'LICENSE'), path.join(vendorDirectory, 'LICENSE'));
await writeFile(path.join(vendorDirectory, 'METADATA.txt'), 'Source: vendor/astro-float-num in SubsetJuliaVM\nRevision: ' + metadata.revision + '\nThis is the locally patched path dependency selected by the workspace Cargo.toml.\n');
const juliaDirectory = path.join(thirdParty, 'julia-source');
await mkdir(juliaDirectory, { recursive: true });
await writeFile(path.join(juliaDirectory, 'LICENSE.md'), juliaLicense);
await writeFile(path.join(juliaDirectory, 'LINEARALGEBRA-LICENSE.md'), linearAlgebraLicense);
await writeFile(path.join(juliaDirectory, 'METADATA.txt'), 'Source licenses retained for Julia-derived Base and LinearAlgebra code.\nLicense texts copied without modification from the Julia 1.12.1 installation used for Basis parity checks.\nSources: https://github.com/JuliaLang/julia/blob/v1.12.1/LICENSE.md and https://github.com/JuliaLang/LinearAlgebra.jl\nThis app distributes the SubsetJuliaVM interpreter, not the official Julia executable.\n');
const sourceLock = await readFile(path.join(source, 'Cargo.lock'));
await writeFile(path.join(thirdParty, 'BASIS-WASM-INVENTORY.json'), JSON.stringify({
  source: metadata.source, revision: metadata.revision, wasmSHA256: sha(wasm), cargoLockSHA256: sha(sourceLock),
  scope: 'Conservative registry-crate input inventory observed in WASM target dependency files; not a claim that every listed crate contributes live code. Upstream direct-dependency and bundled Julia-package notices are also retained, including notices for other targets. Local Rust workspace crates use the root license; the vendored astro-float-num and Julia-derived source notices are included separately.',
  crates: inventory.map(({ crate, name, version, license, repository }) => ({ crate, name, version, license, repository })),
}, null, 2) + '\n');
await writeFile(path.join(thirdParty, 'BASIS-NOTICES.md'), `# Basis runtime notices\n\nThe original upstream README.md describes the upstream direct-dependency notice collection. Basis supplements that collection with licenses copied from the exact cached packages for all ${inventory.length} registry crates observed in the WASM target depfiles. See BASIS-WASM-INVENTORY.json. This conservative build-input inventory may include compiled code removed during linking; retained upstream notices can also describe native or development dependencies.\n\nThe vendored astro-float-num path dependency and Julia/LinearAlgebra source notices are included separately. Source-license texts are preserved unchanged.\n\nBasis modified the runtime to correct array flattening, LU row permutations, and square/rectangular linear solves. The exact modifications are distributed in runtime-source.patch next to the WASM, with its hash and upstream revision in runtime-provenance.json.\n`);
const noticeFiles = [];
async function walk(directory, relative = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = path.posix.join(relative, entry.name);
    if (name === 'THIRD_PARTY_NOTICES.txt') continue;
    if (entry.isDirectory()) await walk(path.join(directory, entry.name), name);
    else noticeFiles.push({ path: name });
  }
}
await walk(notices);
noticeFiles.sort((a, b) => a.path.localeCompare(b.path));
const noticeContents = new Array(noticeFiles.length);
let nextNotice = 0;
await Promise.all(Array.from({ length: Math.min(16, noticeFiles.length) }, async () => {
  while (nextNotice < noticeFiles.length) {
    const index = nextNotice++;
    const item = noticeFiles[index];
    const bytes = await readFile(path.join(notices, item.path));
    item.sha256 = sha(bytes);
    noticeContents[index] = Buffer.concat([
      Buffer.from(`\n===== ${item.path} =====\n\n`),
      bytes,
      Buffer.from('\n'),
    ]);
  }
}));
await writeFile(path.join(destination, 'notice-manifest.json'), JSON.stringify({ sourceRevision: metadata.revision, files: noticeFiles }, null, 2) + '\n');
// Preserve every source notice byte while deploying one offline asset instead
// of hundreds of requests. The source tree and manifest remain available here.
await writeFile(path.join(notices, 'THIRD_PARTY_NOTICES.txt'), Buffer.concat([
  Buffer.from('Basis runtime licenses and notices\n\nThis aggregate preserves the complete contents of the source notice inventory.\nEach section names its relative source file. Original files and SHA-256 hashes\nare retained in the vendored notices tree and notice-manifest.json.\n'),
  ...noticeContents,
]));
console.log(`Packaged exact runtime ${sha(wasm)} with ${inventory.length} WASM crate notice records at ${destination}`);

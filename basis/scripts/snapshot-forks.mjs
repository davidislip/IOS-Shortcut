// Preserve local changes outside the ignored Git checkouts, without publishing.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, copyFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
for (const [name, folder, allowed] of [
  ['engine', 'julia-vm-oss', ['docs/vm/BASIS_SOLVES.md', 'scripts/basis_', 'subset_julia_vm/tests/fixtures/']],
  ['playground', 'subset_julia', ['basis-probes/']],
]) {
  const checkout = path.join(root, 'upstream', folder);
  const destination = path.join(root, 'patches', name);
  await mkdir(destination, { recursive: true });
  const git = args => execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  const baseRevision = git(['rev-parse', 'HEAD']).trim();
  const diff = git(['diff', '--binary', 'HEAD']);
  await writeFile(path.join(destination, 'tracked.patch'), diff);
  const addedFiles = {};
  for (const file of git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean)) {
    if (!allowed.some(prefix => file.startsWith(prefix))) throw new Error(`Review unexpected local file before snapshot: ${folder}/${file}`);
    const target = path.resolve(destination, 'added', file);
    if (!target.startsWith(path.join(destination, 'added') + path.sep)) throw new Error('Unsafe added file path');
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(checkout, file), target);
    addedFiles[file] = sha(await readFile(target));
  }
  await writeFile(path.join(destination, 'snapshot.json'), JSON.stringify({
    baseRevision, upstream: git(['remote', 'get-url', 'upstream']).trim(),
    patchSHA256: sha(diff), addedFiles,
    restore: 'Check out baseRevision; git apply tracked.patch; copy each addedFiles entry from added/ to its matching checkout path.',
  }, null, 2) + '\n');
  console.log(`Saved ${name}: tracked patch and ${Object.keys(addedFiles).length} added files.`);
}

import { readFile } from 'node:fs/promises';
import path from 'node:path';

// The bundle's input list determines which dependency notices ship offline.
export async function editorNotices(root, metafile) {
  const packageDirs = new Set();
  for (const input of Object.keys(metafile.inputs)) {
    const segments = path.relative(root, path.resolve(root, input)).split(path.sep);
    const index = segments.lastIndexOf('node_modules');
    if (index < 0) continue;
    const count = segments[index + 1].startsWith('@') ? 3 : 2;
    packageDirs.add(path.join(root, ...segments.slice(0, index + count)));
  }
  const packages = [];
  for (const directory of [...packageDirs].sort()) {
    const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
    let licenseText;
    for (const file of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE']) {
      try { licenseText = await readFile(path.join(directory, file), 'utf8'); break; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    if (!licenseText) throw new Error(`Missing editor dependency license: ${pkg.name}`);
    const repository = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
    packages.push({ name: pkg.name, version: pkg.version, license: pkg.license, repository, licenseText: licenseText.trim() });
  }
  const text = 'Basis editor third-party notices\n\nThese packages are included in the locally bundled editor.\n\n'
    + packages.map(pkg => `${pkg.name} ${pkg.version}\nLicense: ${pkg.license}\n${pkg.repository ? `Source: ${pkg.repository}\n` : ''}\n${pkg.licenseText}\n`).join('\n' + '='.repeat(72) + '\n\n');
  return { text, packages: packages.map(({ licenseText, ...metadata }) => metadata) };
}

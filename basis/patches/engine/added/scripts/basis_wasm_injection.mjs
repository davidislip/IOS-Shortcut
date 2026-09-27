// Diagnostic only: validate new Pure Julia helper syntax against the previous
// bundled WASM. This cannot certify the rebuilt runtime or the LU adapter fix.
import { readFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';

const impl = readFileSync(new URL('../subset_julia_vm/src/julia/stdlib/LinearAlgebra/src/LinearAlgebra.jl', import.meta.url), 'utf8');
const block = impl.split('# BEGIN BASIS-001 SOLVES')[1].split('# END BASIS-001 SOLVES')[0].replaceAll('Base.:\\(', 'basis_solve(');
const arrays = readFileSync(new URL('../subset_julia_vm/src/julia/base/array.jl', import.meta.url), 'utf8');
const vecStart = arrays.indexOf('# Upstream Base/abstractarraymath.jl: flatten');
const vecBlock = arrays.slice(vecStart, arrays.indexOf('# =============================================================================', vecStart)).replaceAll('function vec(', 'function Base.vec(');
const prefix = 'using LinearAlgebra\nstruct SingularException <: Exception\ninfo::Int64\nend\n' + vecBlock + '\n' + block;
const worker = new Worker(new URL('../../subset_julia/basis-probes/worker.mjs', import.meta.url));
const cases = [
  ['square-matrix-direct', 'A=[2.0 1.0;1.0 3.0]; _matrix_solve(A,[4.0 8.0;5.0 10.0])'],
  ['square', 'A=[2.0 1.0;1.0 3.0]; basis_solve(A,[4.0,5.0])'],
  ['tall', 'A=[1.0 0.0;1.0 1.0;1.0 2.0]; basis_solve(A,[1.0,2.0,2.0])'],
  ['learner-function', 'function learner()\nA=[2.0 1.0;1.0 3.0]\nb=[4.0,5.0]\nreturn basis_solve(A,b)\nend\nlearner()'],
  ['rank-deficient', 'A=[1.0 2.0;2.0 4.0;3.0 6.0]; basis_solve(A,[1.0,2.0,4.0])'],
  ['wide', 'A=[1.0 0.0 1.0;0.0 1.0 1.0]; basis_solve(A,[1.0,2.0])'],
];
let nextId = 0;
function messageFor(send, select) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { clean(); reject(new Error('Diagnostic timed out')); }, 120000);
    const message = value => { if (select(value)) { clean(); resolve(value); } };
    const error = value => { clean(); reject(value); };
    const clean = () => { clearTimeout(timer); worker.off('message', message); worker.off('error', error); };
    worker.on('message', message); worker.on('error', error);
    if (send) worker.postMessage(send);
  });
}
try {
  console.log(JSON.stringify(await messageFor(null, value => value.type === 'ready')));
  for (const [name, source] of cases) {
    const id = ++nextId;
    const result = await messageFor({ id, source: prefix + '\n' + source }, value => value.id === id);
    console.log(JSON.stringify({ name, ...result }));
  }
} finally {
  await worker.terminate();
}

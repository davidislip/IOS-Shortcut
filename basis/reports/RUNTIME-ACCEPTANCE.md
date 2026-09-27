# Basis runtime acceptance evidence

Historical baseline prepared 2026-09-26, before candidate execution. This records the **original bundled runtime**. For subsequent source-built runtime and browser results, see [candidate acceptance](RUNTIME-CANDIDATE.md).

## Result

The expanded suite has 28 fixtures. Bundled SubsetJuliaVM **0.12.2 passed 18/28**, and its fresh-state and worker cancellation/restart checks passed. Standard Julia 1.12.1 passed 27/28 in the full run; its singular-error fixture hit a 30-second timeout during concurrent Rust compilation. A native-only rerun with a 60-second deadline passed in 18.1 seconds.

Thus all 28 analytic expectations were validated against standard Julia across the two runs. The preserved full-run report correctly says **17/28 passed both runtimes in that run**, rather than concealing the timed-out oracle. Timings were affected by concurrent builds and are not benchmarks.

| Fixture group | Cases | Bundled WASM |
|---|---:|---|
| Columns, composition, dependence | 3 | 3 pass |
| Square solve, pivoting, matrix RHS, small/large scaling | 5 | 5 pass |
| Projection, learner function, zero-direction guard | 3 | 3 pass |
| Rectangular numerical solves | 8 | 8 fail |
| Conditioning and sensitivity sweep | 2 | 1 pass, 1 fail |
| Explicit QR least squares | 1 | 1 pass |
| Broadcasting and array-language operations | 2 | 2 pass |
| Dimension and singular diagnostics | 4 | 3 pass, 1 fail |
| **Total** | **28** | **18 pass, 10 fail** |

The ten WASM failures are:

- **Eight rectangular numerical cases:** `least-squares`, `least-squares-properties`, `least-squares-matrix-rhs`, `least-squares-near-dependent`, `least-squares-small-scale`, `least-squares-large-scale`, `least-squares-rank-deficient`, `wide-minimum-norm`. All report `inv: matrix must be square`.
- **One incorrect diagnostic:** `least-squares-dimension-error` returns the same square-only error instead of explaining the incompatible RHS length.
- **One learner-function failure:** `conditioning-sweep` returns `MethodError: no method matching zero(::DataType)` when square solves occur in a function called from a loop. Top-level square solves pass.

## Artifacts and reproduction

- [Full bundled baseline](results-bundled-0.12.2.json)
- [Native singular retry](results-singular-native-rerun.json)
- [Fixture manifest](../upstream/subset_julia/basis-probes/cases.mjs)
- [Runner documentation](../upstream/subset_julia/basis-probes/README.md)

Environment: Windows x64, Node v24.19.0, standard Julia 1.12.1, bundled WASM 0.12.2 / ABI 3. Playground revision: `561587e7a6f3914a24afd883a0dba52d51f3453d`.

WASM SHA-256: `4b4e4613382444e25fa41500e7fcbfa2c29c8af8149b047077687e1097eb2353`. The full JSON also records glue, worker, runner, suite and fixture hashes.

The full baseline command, executed from `basis/upstream/subset_julia`, was:

~~~powershell
node basis-probes/run.mjs 'C:\Users\david\.julia\juliaup\julia-1.12.1+0.x64.w64.mingw32\bin\julia.exe' --report basis-probes/results-bundled-0.12.2.json
~~~

The native-only retry executed this Julia command via Node's `spawnSync` with `timeout: 60000`, `maxBuffer: 1024 * 1024`, UTF-8 output, and hidden window:

~~~powershell
& 'C:\Users\david\.julia\juliaup\julia-1.12.1+0.x64.w64.mingw32\bin\julia.exe' --startup-file=no --history-file=no -e 'try; include(ARGS[1]); println("UNEXPECTED SUCCESS"); exit(1); catch exception; showerror(stderr, exception); println(stderr); exit(2); end' basis-probes/fixtures/singular.jl
~~~

Expected exit status was 2 with `LinearAlgebra.SingularException(2)`; the saved retry report records both. This retry did not create a WASM worker.

To run a candidate after the build is ready:

~~~powershell
node basis-probes/run.mjs 'C:\Users\david\.julia\juliaup\julia-1.12.1+0.x64.w64.mingw32\bin\julia.exe' --wasm-dir 'C:\path\to\candidate-pkg' --timeout 60000 --report basis-probes/results-candidate.json
~~~

## Harness safeguards and limits

Fixtures check numerical answers against both analytic values and standard Julia, with scale-aware residuals and orthogonality checks. Matrix-RHS fixtures check shape; rank-deficient and wide fixtures check minimum-norm solutions using nullspace orthogonality. Default numerical tolerance is 1e-10 absolute plus 1e-9 relative; the near-dependent coefficient fixture uses 1e-6 absolute. Expected-error cases require the relevant diagnostic.

Both worker execution and the native oracle have deadlines. Worker crashes, traps, and timeouts fail the affected case rather than escaping the harness. After the baseline, the runner gained optional `runtime-provenance.json` ingestion, corrected terminated-process status reporting, and native `LoadError` unwrapping before diagnostic matching so filenames cannot satisfy error checks. Those changes do not alter the fixture sources or analytic answers; the original report preserves the hashes of the earlier runner.

Fetch is disabled in the worker and assets load from disk. This demonstrates local Node/V8 execution only. No source-built candidate, Safari/iPad behavior, offline PWA installation, storage recovery, or general Julia/package compatibility is certified by this evidence. Browser and device validation remain separate requirements.

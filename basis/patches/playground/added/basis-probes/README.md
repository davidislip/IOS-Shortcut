# Basis runtime acceptance probes

These fixtures define the small, real, dense-array Julia contract needed by the six Basis launch lessons. They run unchanged in standard Julia and in a local WebAssembly build. They do not certify arbitrary Julia programs or packages.

## Run

From this checkout, use Node and a standard Julia 1.12.1 executable:

~~~powershell
node basis-probes/run.mjs 'C:\path\to\julia.exe' --report basis-probes/results-bundled.json
~~~

Select a rebuilt runtime without replacing the original package:

~~~powershell
node basis-probes/run.mjs 'C:\path\to\julia.exe' --wasm-dir 'C:\path\to\candidate-pkg' --report basis-probes/results-candidate.json
~~~

The directory must contain both `subset_julia_vm_web.js` and `subset_julia_vm_web_bg.wasm`. Use `--filter REGEX` for targeted checks, `--timeout MS` to adjust the default 30-second limit, and `--skip-lifecycle` when iterating on numerical fixtures. A filtered or lifecycle-skipped run is explicitly marked in the report and is not a full acceptance run.

~~~powershell
node basis-probes/run.mjs 'C:\path\to\julia.exe' --filter 'least-squares|wide' --skip-lifecycle --report basis-probes/results-solves.json
~~~

## What is checked

The manifest in `cases.mjs` has 29 named fixtures:

- Matrix columns, composition, transformed origin, a known nullspace direction, and equivalent coefficient vectors.
- Pivoted square solves, multiple right-hand sides, relative reconstruction residuals, and uniformly small/large systems.
- Projection written as a learner function, invariance under rescaling the direction, orthogonal residuals, and an explicit zero-direction guard.
- Direct rectangular least squares, matrix right-hand sides and output dimensions, nonzero optimal residuals, column-space orthogonality, near dependence, and uniform rescaling.
- Rank-deficient and underdetermined minimum-norm solves; nullspace orthogonality distinguishes the requested solution from an arbitrary least-squares minimizer.
- Residual versus solution error, sensitivity sweeps, explicit QR, user functions and loops, slicing, mutation, ranges, transpose, and broadcasting.
- Meaningful errors for incompatible dimensions and a singular square system.

Each numerical result must match both an analytically known answer and the standard Julia oracle. Residual fixtures normalize by input scale. The near-dependent example has a looser explicit tolerance for solution coefficients. Expected-error cases require the relevant diagnostic, so an unrelated parser error cannot pass.

The lifecycle checks require independent run state, terminate an infinite-loop worker, and execute valid source in a fresh worker. Worker exceptions and execution timeouts become failed case results instead of crashing the entire harness. Each Julia oracle process also has a deadline and output limit.

## Evidence and limits

Reports include the native Julia version, actual runtime version/ABI, Node/OS information, selected cases, SHA-256 hashes of the WASM, JavaScript glue, worker, runner, suite manifest, and individual fixtures, and playground Git state. A candidate's `runtime-provenance.json` is included when present, so source revisions and build settings can accompany artifact hashes. Reports always state the exact tested scope.

`results.json` preserves the earlier nine-probe report. Separate `results-bundled-0.12.2.json` and candidate reports allow before/after comparison with the expanded suite. That earlier 8/9 result should not be confused with expanded-suite acceptance.

The worker forbids fetch and loads assets from disk. This establishes local execution in Node/V8; it does not establish Safari behavior, iPad performance, offline PWA installation, or persistent-storage behavior. Those need separate device validation.

Structured runtime values can contain JavaScript Maps. The worker normalizes them before JSON serialization; plain JSON.stringify would otherwise lose their contents.


## Recorded bundled-runtime result

On 2026-09-26, bundled runtime 0.12.2 passed 18/28 expanded fixtures plus fresh-state and cancellation/restart checks. Eight rectangular numerical cases and the rectangular RHS diagnostic failed with `inv: matrix must be square`. The sensitivity sweep failed with `zero(::DataType)` when a learner function performed square solves inside a loop.

Native Julia 1.12.1 passed 27/28 in that run; formatting the singular exception exceeded the 30-second deadline during concurrent Rust builds. The native-only 60-second rerun in `results-singular-native-rerun.json` passed and confirmed `LinearAlgebra.SingularException(2)`. All 28 native expectations are therefore validated across those two runs. The full original report correctly remains failed (17/28 passed both in that single run); it has not been rewritten to hide the timeout.

These timings reflect heavy concurrent build load and are not performance benchmarks. After this baseline, the runner gained optional build-provenance ingestion, corrected terminated-process status reporting, and unwrapped native `LoadError` before matching diagnostics so a fixture filename cannot satisfy an error check. Those harness changes preserved the 28 fixture sources and expectations; the later 29th fixture is described below.


## Numeric-parser regression checks

~~~powershell
node --test basis-probes/numeric.test.mjs
~~~

The parser rejects null, undefined, booleans, nonfinite values, malformed integer strings, and blank native result fields before conversion. This prevents JSON-serialized NaN from turning into a passing zero through `Number(null)`. The five Node-only checks also cover valid finite values and serialized integer results. Re-reading the saved baseline with the strict parser preserved all 23 recorded numerical-case values; no Julia or WASM runtime was needed for that verification. Future reports include the numeric-parser SHA-256.



## Active 29-case candidate suite

The active manifest now adds `learner-function-solves`: tall, rank-deficient, and wide solves inside one learner function, called from a loop at scales 1e-20, 1, and 1e20. Its 3 × 7 output is checked against analytic coefficients and an explicit shape in both runtimes. All original 28 fixture files and expectations were verified unchanged with a Node-only comparison against the saved report.

The runner requires standard Julia **1.12.1** and WASM **ABI 3**. The checked-out web binding source exposes the required ABI and typed-result protocol; the built candidate still needs execution. See [candidate acceptance](../../../reports/RUNTIME-CANDIDATE.md) for the pending 29-case gate. The historical 18/28 WASM baseline remains a 28-case result and does not include this new fixture.



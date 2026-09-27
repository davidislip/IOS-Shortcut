# Basis candidate runtime acceptance

**The rebuilt candidate passed the complete 29-case WASM numerical gate against standard Julia 1.12.1, plus fresh-state and cancellation/recovery checks.** The separate native CLI gate also passed 7/7 fixtures. These are Windows/Node and native-runtime results; Safari/iPad acceptance remains outstanding.

## WASM result

The unfiltered run completed on 2026-09-26 at 19:14:35 UTC with exit status 0. [results-candidate.json](results-candidate.json) records `fullGatePass: true`, **29/29 native oracle passes**, **29/29 WASM passes**, and no unexpected failures or timeouts.

| Evidence | Observed result |
|---|---|
| Runtime identity | Rebuilt SubsetJuliaVM **0.11.1**, ABI **3** |
| Oracle identity | Standard Julia **1.12.1**, version checked before execution |
| Original 28 cases | **28/28 pass** in both runtimes; original bundled 0.12.2 passed 18/28 |
| New learner-function case | **Pass**: analytic coefficients, native agreement, and 3 × 7 shape |
| Fresh-state execution | **Pass**: the previous run's private variable is undefined in the next run |
| Cancellation | **Pass**: the deliberate infinite loop is terminated after the 1,500 ms deadline |
| Recovery | **Pass**: a fresh worker returns 5 for newly executed `2 + 3` |
| Complete gate | **29/29 plus lifecycle checks**, no filtering or skipped lifecycle checks |

All ten previously failing WASM cases now pass: eight rectangular numerical cases, the rectangular RHS dimension diagnostic, and the sensitivity sweep using square solves inside a learner function. The [historical 28-case baseline](RUNTIME-ACCEPTANCE.md) and its raw reports remain unchanged.

The new `learner-function-solves` fixture calls one generic function from a loop for full-rank tall, rank-deficient tall, and wide systems at scales `1e-20`, `1`, and `1e20`. Both runtimes returned a 3 × 7 matrix whose rows match:

~~~text
[7/6, 1/2, 3/5, 6/5, 1/3, 4/3, 5/3]
~~~

A static audit before the run confirmed that all original 28 fixture sources and analytic expectations were unchanged. Existing cases also check residuals, nullspace orthogonality, near dependence, matrix right-hand sides, scaling, projections, learner functions, loops, array operations, and meaningful errors. The numerical parser rejects null/nonfinite values and missing native fields before conversion, preventing JSON-serialized NaN from passing as zero.

## Artifact and build identity

Tested WASM SHA-256:

~~~text
b9c7256c6d94e6a0529205d9d8e9774ea898b8d4d95ede37eff102c828f35548
~~~

This matches the expected candidate hash and the embedded build-provenance report. The raw acceptance JSON includes the JavaScript glue hash, fixture/suite/runner/worker/parser hashes, and the complete `runtime-provenance.json` contents.

The candidate was built from source revision `4fde7027e533214e9e97c0799b523bc6ee7d1396` with local changes. The tracked patch SHA-256 is `6f058071f20922deceb0b1032947c87c2b553f8781b0b77ae14ffaa932dde12b`. Provenance records Rust 1.95.0, wasm-pack 0.15.0, wasm-bindgen 0.2.122, both embedded caches and their hashes, and the native executable hash. The WASM build used `release-fast` with optimization level 1, no LTO, and no wasm-opt; these settings matter when interpreting performance.

## Memory and timing observations

Measurements came from Node v24.19.0 on Windows x64 during this run.

| Observation | Recorded value |
|---|---:|
| WASM linear memory immediately after initialization | 19,070,976 bytes / 18.1875 MiB |
| Linear memory after first `1 + 1` warmup | 101,777,408 bytes / 97.0625 MiB |
| Largest recorded linear-memory value | **139,329,536 bytes / 132.875 MiB** |
| Fresh recovery worker after `2 + 3` | 101,777,408 bytes / 97.0625 MiB |
| Initial WASM initialization | 0.545 seconds |
| First source warmup | 5.390 seconds |
| Individual fixture execution observations | 0.347–3.523 seconds |

Recorded linear memory reached 132.875 MiB at the square-solve fixture and stayed at that value through the remaining fixtures and fresh-state checks. The measurements are samples after initialization and execution; they do not measure all memory used by Node, JavaScript objects, or the browser. They therefore do not establish an iPad memory requirement or limit.

The full oracle-and-WASM run took about 101 seconds. These are observations from one local validation run, not a device benchmark or an iPad performance prediction.

## Rebuilt native CLI evidence

The final rebuilt native VM passed **7/7 fixtures**, covering **76 passing assertions**, plus the expected-failing assertion control. [native-final.json](native-final.json) records executable/source hashes, exact invocations, stdout, exit statuses, and timing data.

| Native fixture | Passing assertions |
|---|---:|
| `basis_square_solve` | 15 |
| `basis_rectangular_solve` | 22 |
| `basis_solve_errors_shapes` | 14 |
| `basis_learner_function_solve` | 15 |
| `vec_1d` | 3 |
| `vec_2d` | 6 |
| `conditioning-sweep` with explicit numerical assertion | 1 |
| **Total** | **76** |

The four solve fixtures account for 66 assertions; the two vector-shape/aliasing fixtures add 9, and the conditioning assertion adds 1. All seven fixture processes exited 0. The control printed `Test Failed: false` and exited 1 as required.

Native executable SHA-256: `fb2968f5a7a9013519e0f094e574c59c45552ab8716d96c9b66a0021a87186ed`. That run completed at 18:51:37 UTC without timeouts, output-limit failures, or interruption.

## App and browser evidence

The default app build now selects the hash-pinned local runtime in
`runtime-lock.json`. Tested build: **bfb04ac80e384894**, 137 offline assets,
36.5 MiB WASM. The runtime binary is the same artifact tested above.

`node --test basis/app/tests/*.test.mjs` passed **10/10 tests**. These cover the
built worker executing source without network access, fresh variables, typed
results, errors, output bounds, cancellation/deadlines, incomplete-update
recovery, and rejection of mismatched runtime locks/provenance.

Desktop **Chrome 153.0.8010.50 passed 10/10 browser checks**. See
[browser-check.json](browser-check.json) and [verified screenshot](browser-lab.png).
The browser actually downloaded the complete pack, went offline, executed new
square and rectangular solves, recovered from an error, stopped a runaway loop,
restored a draft after closing a tab, and restarted the entire browser offline.
Source export matched the editor exactly; 768/1024-pixel layouts had no horizontal
overflow. This is desktop Chrome evidence, not an iPad test.

Windows Playwright **WebKit 26.0 executed a learner-defined least-squares
function successfully**, but its offline gate did **not** pass. The original
[browser report](browser-check-webkit.json) records failed offline installation.
Long profile paths produced a filesystem-write error even for a tiny icon;
repeating outside the filesystem sandbox did not remove that error. A shorter
temporary profile removed the write exception, but cached entries could not be
read back. See the [short-profile diagnostic](webkit-diagnostic.json),
[original sandbox diagnostic](webkit-diagnostic-sandbox.json), and
[unrestricted diagnostic](webkit-diagnostic-unrestricted.json).

A [minimal cache test](webkit-cache-check.json) then reproduced an empty key
list and failed lookup after `cache.put` for both a synthetic tiny response and
a fetched icon, on a plain origin page **without Basis or Julia loaded**. The
same result occurred [inside the sandbox](webkit-cache-check-sandbox.json),
[outside it](webkit-cache-check-unrestricted.json), and with the process working
directory isolated inside its short temporary profile. This isolates an unresolved local WebKit cache problem; it does not
prove its exact cause or establish Safari/iPad behavior. No app workaround or
false offline-ready state was introduced. The test host is Windows 10, below
Playwright 1.58.2's [documented Windows requirements](https://github.com/microsoft/playwright/blob/v1.58.2/docs/src/intro-js.md#system-requirements).

## Reproduction

The completed WASM run used this exact command from the workspace root:

~~~powershell
node basis/upstream/subset_julia/basis-probes/run.mjs 'C:\Users\david\.julia\juliaup\julia-1.12.1+0.x64.w64.mingw32\bin\julia.exe' --wasm-dir basis/runtime-build/pkg --timeout 120000 --report basis/reports/results-candidate.json
~~~

For future runs, choose a new report filename to preserve this evidence. The runner requires ABI 3 and standard Julia 1.12.1. A filtered run or a run with `--skip-lifecycle` does not receive `fullGatePass: true`.

## Scope and remaining acceptance

The Node worker loads local assets and prohibits fetch. This result establishes the tested small dense-array Julia curriculum operations in the rebuilt native and WASM runtimes. It does not certify arbitrary Julia programs or package compatibility.

Chrome integration and offline behavior passed as recorded above. The Windows
WebKit offline gate remains unresolved. Actual Safari/iPad installation,
airplane-mode reopening and fresh code execution, touch/keyboard behavior,
performance, and memory suitability still require a physical-device check.

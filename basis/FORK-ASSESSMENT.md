# Local SubsetJulia fork: feasibility and effort

This is the initial inspection snapshot. Implementation has since added an
offline runtime lab, 28 acceptance fixtures, numerical source fixes, and a
reproducible build workflow. Current evidence is in
[reports/RUNTIME-ACCEPTANCE.md](reports/RUNTIME-ACCEPTANCE.md); build instructions
are in [BUILDING.md](BUILDING.md). Statements below about unattempted builds and
absent UI describe the initial inspection, not the current workspace.

Assessed 2026-09-26. Verdict: **moderate for the six-lesson Basis app; hard and open-ended for general Julia compatibility.** The first useful prototype can use much of the existing browser runtime. Stable numerical behavior, offline packaging, and iPad usability still need targeted work.

## Local forks created

| Checkout | Branch | Upstream snapshot | Purpose |
|---|---|---|---|
| [upstream/subset_julia](upstream/subset_julia/) | `basis/offline-scope` | `561587e7a6f3914a24afd883a0dba52d51f3453d`, 2026-08-12 | User-requested playground and bundled runtime 0.12.2 |
| [upstream/julia-vm-oss](upstream/julia-vm-oss/) | `basis/offline-scope` | `4fde7027e533214e9e97c0799b523bc6ee7d1396`, 2026-07-20 | Full runtime source, version 0.11.1 |

These are independent local Git checkouts with remotes named `upstream`. No GitHub fork, upstream issue, pull request, push, or deployment was created. `basis/.gitignore` excludes the nested repositories from the parent monorepo. The scope documents and result snapshot remain outside that exclusion.

Added a runnable [compatibility harness](upstream/subset_julia/basis-probes/README.md), nine Julia fixtures, a worker, and diagnostic scripts to the playground checkout. These additions are uncommitted local work. Production UI and runtime source/binaries remain unchanged.

## What was actually tested

Loaded the exact 26,217,180-byte bundled WASM locally using Node 24.19.0 on Windows. The runtime reports version 0.12.2 and ABI 3. Network fetch was disabled in the worker. Ran identical fixture files in installed standard Julia 1.12.1 and compared results with known answers.

| Probe | Standard Julia | Bundled WASM |
|---|---|---|
| User function, loop, column indexing, matrix-vector multiplication | Pass | Pass |
| Nonsingular square solve | Pass | Pass |
| Dot product and projection | Pass | Pass |
| Direct rectangular least squares, `A \ b` | Pass | **Fail: inverse requires a square matrix** |
| Sensitivity example; residual versus solution error | Pass | Pass |
| Explicit QR factorization followed by a square solve | Pass | Pass |
| Broadcasting and multiplication | Pass | Pass |
| Reject invalid matrix dimensions | Pass | Pass |
| Reject the tested singular square system | Pass | Pass |

Result: **8/9 numerical/error probes passed in both runtimes.** Additional checks passed for fresh-run variable state and terminating/restarting a Node worker after a runaway execution attempt. Structured vector results preserve values and dimensions, so a numeric connection to diagrams is feasible without parsing printed output.

The QR probe uses `Matrix(qr(A).Q)` and `Matrix(qr(A).R)` explicitly. Its success does not establish that the runtime's factorization types have identical behavior to standard Julia, or that its triangular solve avoids matrix inversion.

Recorded warmup was about 3.7 seconds; individual probes ranged from about 0.25 to 6 seconds on this desktop. These are exploratory single-run measurements with mixed first-use compilation costs, not a controlled benchmark or an iPad speed prediction. Interactive parameter changes should use immediate browser previews and explicit code runs until latency is measured on the device.

Raw evidence: [recorded results](reports/subset-julia-probes.json). WASM SHA-256: `4b4e4613382444e25fa41500e7fcbfa2c29c8af8149b047077687e1097eb2353`.

No Safari, physical iPad, Home Screen installation, offline page reload, or service-worker test was performed. Rust/WASM rebuilding has not been attempted. These distinctions matter: the runtime can execute without a network, while the current web page still downloads its editor from a CDN.

## Easy changes

- Add and edit course examples and lesson text. The app already edits source and displays execution results.
- Connect numeric results to simple lesson diagrams. The required structured values already exist; normalize Maps before serialization.
- Add basic saved drafts and named local experiments. The current app saves code in shareable URLs, not a local lesson store.
- Remove obvious external script URLs by bundling dependencies. Complete Monaco asset packaging needs checking because its loader fetches additional files.

Existing Plotly and JSXGraph bundles can be reused where helpful. The package contains about 25 MiB of WASM, 4.3 MiB of Plotly, and 0.9 MiB of JSXGraph before editor assets. Download size and device memory need measurement before adding unnecessary dependencies.

## Moderate changes

| Area | Concrete change | Main verification |
|---|---|---|
| Offline installation | Bundle editor/LZString assets; add manifest, versioned service worker, download status, complete caching, update behavior | Cold-open the installed app in airplane mode and write/run new code |
| Responsive execution | Move WASM initialization, warmup, and execution into a worker; implement Stop, timeout, restart, and run IDs | Runaway code cannot freeze the UI; later results cannot overwrite a newer experiment |
| Editor integration | Move Unicode completion calls to worker messages or preload completion data | Avoid a second full runtime solely for editor completion |
| Lesson workspace | Add lesson navigation, math explanations, controlled inputs, numeric feedback, hints, and reflection | One complete lesson works before building all six |
| Persistence | Autosave drafts and inputs, version records, export/import, preserve work through updates | Restore the same experiment after closing and reopening |
| iPad layout | Adjust split-view threshold, viewport/keyboard behavior, zoom, touch selection and symbol entry | Test hardware and software keyboards, portrait, landscape, and split view |
| Narrow least-squares support | Use QR plus actual triangular back-substitution for tall, full-column-rank real problems | Compare coefficients and residual properties against standard Julia across scales |

The current synchronous `run_from_source` runs on the UI thread. A timer added to that thread cannot interrupt it. The worker prototype demonstrates the architectural solution in Node; the browser implementation remains to be done.

Existing JSXGraph artifacts can contain JavaScript callback expressions executed on the UI thread. For the initial teaching diagrams, use validated numeric geometry rather than arbitrary executable callbacks; moving Julia into a worker alone would not make those callbacks cancellable.

## Runtime patch: bounded mathematics, uncertain rebuild

The public source provides both QR and SVD machinery through nalgebra. We do not need to invent a parser, compiler, or QR implementation for the initial least-squares lesson.

The inspected Pure Julia [matrix-backslash overload](upstream/julia-vm-oss/subset_julia_vm/src/julia/stdlib/LinearAlgebra/src/LinearAlgebra.jl) computes `inv(A) * b`, while the [Rust fallback](upstream/julia-vm-oss/subset_julia_vm_vm/src/vm/builtins_linalg.rs) has a separate square-only LU solve. Compiler dispatch can choose between these paths. A reliable fix needs to account for both.

A bounded first numerical change would:

1. Preserve square-system behavior through an actual solve rather than an explicit inverse.
2. Route tall, full-column-rank real systems through QR and triangular back-substitution.
3. Define dimension, finite-input, and singular/rank-deficient behavior explicitly. Do not claim general minimum-norm support from the narrow implementation.
4. Add parity fixtures with native Julia and numerical residual checks, including scaled and nearly dependent inputs.
5. Rebuild the WASM and rerun the existing Basis probes before replacing the bundled binary.

An explicit, portable Julia QR/back-substitution helper is also a possible initial lesson implementation if it passes the same checks. This would expose the algorithm to the learner without pretending that the runtime's built-in rectangular backslash has been repaired. The current assessment does not implement that helper or the engine patch.

The harder part is provenance: the playground ships **0.12.2**, but the matching public source was not found. The public source checkout is **0.11.1**. Shared playground files match that source tree, but this does not prove that the newer binary can be reproduced from it. [Bundled package metadata](https://github.com/terasakisatoshi/subset_julia/blob/561587e7a6f3914a24afd883a0dba52d51f3453d/pkg/package.json), [public source snapshot](https://github.com/AtelierArith/julia-vm-oss/tree/4fde7027e533214e9e97c0799b523bc6ee7d1396).

The build recipe exists and requires Rust at least 1.95, a native CLI build, generated caches, and wasm-pack. Rust/cargo/wasm-pack were not available on this machine's PATH during inspection. Before investing in engine changes, build the source snapshot and compare its behavior with the shipped binary; changes must not quietly lose newer functionality. A successful older-source build would establish a maintainable baseline, not reproduce 0.12.2.

Package metadata declares MIT / Apache licensing, and the full source has an Apache-2.0 license and notices. The playground has no root LICENSE file. Keep the current work local and retain provenance; identify the applicable notices for the exact distributed bundle when packaging the app. [Source license](https://github.com/AtelierArith/julia-vm-oss/blob/4fde7027e533214e9e97c0799b523bc6ee7d1396/LICENSE).

## What would make this hard

- Reproducing full Julia behavior across arbitrary packages and language features.
- General rectangular backslash with wide systems, rank deficiency, pivoting, complex arrays, type preservation, and compatible errors.
- Promising the source and prebuilt binary are interchangeable before testing their version gap.
- Achieving a tight execution-latency target on all iPads without measuring startup, allocation, and package compilation.
- Maintaining a broad compiler fork as upstream diverges. Keep changes narrow and numerical when possible.

## Recommended next sequence

1. Make a small offline page around the existing pinned 0.12.2 binary: locally bundled editor, worker execution, cancellation, saved draft, and one transformation/solve experiment.
2. In parallel, establish a reproducible source build and investigate the narrow QR solve change. Keep numerical compatibility reports for both versions.
3. Validate the page on the actual iPad in airplane mode, including restart, touch editing, keyboard use, and representative lesson runs.
4. Implement the first full lesson and the missing numerical support, then expand to the six-lesson scope only after those checks pass.

This is a reasonable project to pursue in stages. The current evidence supports a small offline learning app with an explicitly supported Julia subset. It does not support a promise of a drop-in Julia environment or an immediately maintainable rebuild of the newest binary.

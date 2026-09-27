# Basis: prove offline Julia execution first

Status: original investigation plan, retained to explain the runtime decision. Implementation has progressed beyond this initial nine-probe audit. See the [candidate evidence](reports/RUNTIME-CANDIDATE.md), [original baseline](reports/RUNTIME-ACCEPTANCE.md), and [build instructions](BUILDING.md) for current results. Physical iPad validation remains a separate gate. See [product scope](SCOPE.md).

## Question to settle

Can an installed iPad web app accept freshly written Julia source and execute the six launch lessons accurately, entirely offline, with usable errors and cancellation?

The proof must include code written after disconnecting. Running precompiled demonstrations, changing sliders in a frozen program, or queueing code for a remote computer does not establish this capability.

## Candidate assessment

| Route | Documented mechanism | Scoping decision |
|---|---|---|
| Pluto on another computer or server | Browser interface to Julia running elsewhere; the installation guide directs iPad users to remote access | Does not meet this user's offline requirement |
| PlutoSliderServer | Recalculates prepared notebooks in response to controls; arbitrary code changes are unsupported | Does not provide the requested coding workspace |
| WasmTarget.jl | Compiles Julia functions using the host Julia compiler's typed intermediate representation, then ships WebAssembly | Potentially useful for prepared interactive calculations; the documented pipeline does not establish compilation of newly typed source on an offline iPad |
| Keno's Julia WebAssembly port | Experimental port of Julia itself | Secondary research candidate; current build reproducibility, browser support, and numerical library coverage need verification |
| SubsetJuliaVM / julia-vm-oss | Independent Julia-subset parser and virtual machine, with browser WebAssembly execution | Most relevant candidate to investigate first; language and numerical compatibility are not established for this app |

Sources: [Pluto installation](https://plutojl.org/en/docs/install/), [PlutoSliderServer](https://plutojl.org/en/docs/plutosliderserver/), [WasmTarget source and build model](https://github.com/GroupTherapyOrg/WasmTarget.jl), [Julia's WebAssembly project description](https://julialang.org/jsoc/gsoc/wasm/), [Keno/julia-wasm](https://github.com/Keno/julia-wasm), and [julia-vm-oss](https://github.com/AtelierArith/julia-vm-oss).

SubsetJuliaVM is a compatibility implementation of part of Julia, not the official Julia runtime. The project's author describes an on-device interpreter and browser implementation. That is relevant evidence for feasibility, not proof that Basis's lessons run faithfully. [Author's project announcement and updates](https://discourse.julialang.org/t/subsetjuliavm-a-julia-subset-execution-environment-for-ios-and-web/134814)

The source audit examined commit `4fde7027e533214e9e97c0799b523bc6ee7d1396` (2026-07-20). Its browser API accepts new source through `run_from_source(source, seed)` and documents typed numerical results, including array shape and elements. This supports investigating a direct editor-to-runtime integration. [Pinned browser API documentation](https://github.com/AtelierArith/julia-vm-oss/blob/4fde7027e533214e9e97c0799b523bc6ee7d1396/subset_julia_vm_web/README.md)

There is a concrete gap: the inspected Rust backslash solver explicitly rejects nonsquare matrices, while a Julia-level matrix overload computes `inv(A) * b`. Neither inspected path supplies the required rectangular least-squares behavior. A square-system fixture does not resolve this. Confirm the browser's dispatch path, then assess a bounded, numerically sound remedy or a different candidate. Do not substitute normal equations merely to make a demonstration pass. [Rust solver](https://github.com/AtelierArith/julia-vm-oss/blob/4fde7027e533214e9e97c0799b523bc6ee7d1396/subset_julia_vm_vm/src/vm/builtins_linalg.rs#L734), [Julia overload](https://github.com/AtelierArith/julia-vm-oss/blob/4fde7027e533214e9e97c0799b523bc6ee7d1396/subset_julia_vm/src/julia/stdlib/LinearAlgebra/src/LinearAlgebra.jl#L1534).

The repository also acknowledges a difference between its QR representation and standard Julia. Its fixtures for dot products, norms, and solves are evidence of intended support; they are not substitute validation for our lessons. Core code is Apache-2.0 with third-party notices to review when packaging. [QR fixture](https://github.com/AtelierArith/julia-vm-oss/blob/4fde7027e533214e9e97c0799b523bc6ee7d1396/subset_julia_vm/tests/fixtures/linalg/qr.jl), [license](https://github.com/AtelierArith/julia-vm-oss/blob/4fde7027e533214e9e97c0799b523bc6ee7d1396/LICENSE).

## Small prototype

Build only a minimal installable page with:

- A source editor, Run, Stop, output, and a reset action.
- A locally bundled candidate runtime running in a worker, if supported.
- An offline asset pack and a visible readiness check.
- Draft persistence and a way to extract typed numerical output.
- One small matrix-input display to verify input/output correspondence.

Pin the candidate commit and record build commands, runtime version, artifacts, package size, and required browser features. Include license notices required by the pinned distribution. Reusing an existing runtime is in scope; creating a new language interpreter is not part of this prototype.

Each run has a unique ID and a source/input snapshot. Bound output growth. Stop must terminate runaway work and leave the interface usable. A fresh run must not inherit definitions or mutations from the previous one.

## Compatibility probes

These snippets are acceptance inputs with analytically known results. Equivalent numeric-output fixtures have now been compared between bundled WASM 0.12.2 and standard Julia 1.12.1; the rectangular backslash probe failed. The [fork assessment](FORK-ASSESSMENT.md) records exact tests and limits. Continue with learner-written variations and the target iPad, not only these fixtures.

### 1. Core syntax and arrays

```julia
function column_combination(A, x)
    y = zeros(size(A, 1))
    for j in 1:length(x)
        y = y + x[j] * A[:, j]
    end
    return y
end

A = [2.0 1.0; 1.0 3.0]
x = [1.0, 2.0]
column_combination(A, x) - A * x
```

Expected: a two-element zero vector. Also test one-based indexing, mutation, ranges, `.*` versus `*`, transpose, shape errors, and redefining a function between independent runs.

### 2. Square solve

```julia
using LinearAlgebra
A = [2.0 1.0; 1.0 3.0]
b = [4.0, 5.0]
x = A \ b
r = b - A * x
```

Expected: `x` approximately `[1.4, 1.2]`, with a small residual. Check both typed result extraction and numerical agreement. Probe a singular matrix separately and document the resulting behavior.

### 3. Projection

```julia
using LinearAlgebra
u = [2.0, 1.0]
b = [1.0, 3.0]
p = (dot(u, b) / dot(u, u)) * u
r = b - p
dot(u, r)
```

Expected: `p = [2.0, 1.0]`, `r = [-1.0, 2.0]`, and zero dot product within the declared tolerance. Verify both membership of `p` in the span of `u` and orthogonality of the residual; the latter alone would incorrectly accept `p = b`. Repeat with a target already on the line and with a zero direction; the latter must produce an explained invalid case.

### 4. Rectangular least squares

```julia
using LinearAlgebra
t = [0.0, 1.0, 2.0]
y = [1.0, 2.0, 2.0]
A = hcat(ones(length(t)), t)
c = A \ y
r = y - A * c
A' * r
```

Expected: `c` approximately `[7/6, 1/2]`; `r` approximately `[-1/6, 1/3, -1/6]`; `A' * r` approximately zero. The nonzero residual is correct. Probe near-dependent columns, rescaled inputs, and rank-deficient data separately; do not assume all coefficient solutions are unique.

### 5. Sensitivity and residual versus error

```julia
using LinearAlgebra
epsilon = 1.0e-6
A = [1.0 1.0; 0.0 epsilon]
b = [2.0, epsilon]
x_true = [1.0, 1.0]
x_bad = [0.0, 2.0]
residual_size = norm(b - A * x_bad)
relative_error = norm(x_bad - x_true) / norm(x_true)
b_changed = [2.0, 2.0 * epsilon]
x_changed = A \ b_changed
```

Expected: residual size approximately `epsilon`, relative error `1`, and `x_changed` approximately `[0.0, 2.0]`. Repeat for several nonzero epsilon values. Treat epsilon equal to zero as a distinct singular case.

Use scale-aware tolerances with explicit handling near zero. Test the mathematical properties and stable cases against independently known answers. Numerical algorithms need not produce identical floating-point bits, but discrepancies must be understood and must not undermine the lesson.

## Actual iPad acceptance

Record the device model, iPadOS/Safari version, and whether the test used Safari or the installed Home Screen app. Desktop browser success is useful preliminary evidence but does not close this gate.

1. Download once, close the app, disable connectivity, and reopen from the Home Screen.
2. Type a new function and run all five probes. Confirm that no network response is needed.
3. Change code and inputs repeatedly; verify outputs match the selected run and array dimensions survive serialization.
4. Run an infinite loop, press Stop, and then run a valid script successfully.
5. Produce syntax, unsupported-feature, dimension, and runtime errors. Confirm the user can distinguish unsupported features from mistakes in their own code.
6. Background the app, return, rotate, show the software keyboard, and reopen it. Preserve the latest saved source.
7. Test an interrupted download/update and ensure an existing offline installation remains usable.
8. Measure cold startup, warm execution, download size, and stability over repeated runs.

Initial responsiveness targets are a cached startup within about 10 seconds, ordinary small exercises within about 2 seconds after startup, and prompt cancellation without losing the draft. These are proposed product targets, not measured runtime claims. Record failures and actual timings before revising a target.

## Outcome and decision

Produce a short report listing the pinned candidate, supported lesson operations, unsupported Julia features, numerical differences, iPad results, performance, and required integration work.

- **Pass:** freshly entered code, all required mathematics, numerical extraction, cancellation, and offline device behavior work. The runtime and its limitations can be presented accurately to the learner. Proceed to the complete first lesson.
- **Partial:** browser execution works but a required operation or device behavior fails. Identify a small, bounded remedy and retest before committing to the curriculum build. The overall offline gate remains open.
- **Fail:** meeting the requirement requires a broad runtime/compiler port, unsupported semantics, or a remote service. Report that the proposed implementation cannot yet meet the agreed scope. Revisit the product/runtime choice with the user; do not silently replace offline execution with a server or a simulated Julia editor.

The desktop runtime probes provide preliminary evidence for the next prototype. They do not close the offline iPad gate or establish broad numerical compatibility.

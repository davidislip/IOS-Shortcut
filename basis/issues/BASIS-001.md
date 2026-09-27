# BASIS-001: reliable numerical solves for the offline lessons

Status: numerical runtime fixes implemented and verified in native/WASM gates; physical iPad validation remains open. Local fork issue, 2026-09-26.

The user authorized implementing the scoped Julia capabilities in local forks. This record replaces the upstream project's public issue/PR workflow for this local work; no upstream communication or publishing is authorized by the task.

## Reproduction

```julia
using LinearAlgebra
A = [1.0 0.0; 1.0 1.0; 1.0 2.0]
b = [1.0, 2.0, 2.0]
A \ b
```

Standard Julia 1.12.1 returns approximately `[7/6, 1/2]`. Bundled SubsetJuliaVM 0.12.2 fails with `inv: matrix must be square`. The public 0.11.1 source implements matrix backslash using an inverse and has a separate square-only Rust fallback.

## Required result

Support the six Basis lessons with true source execution offline: matrix arithmetic, vector operations, projection, stable square solves, and rectangular least squares. Define and verify dimension, singular, rank-deficient, and nonfinite cases. Preserve standard Julia syntax and compare fixture results with standard Julia.

Implement numerical semantics in the existing source layer, avoid normal-equation or inverse-based solve shortcuts, rebuild an identifiable local WASM, and test it through the same browser-facing interface. Track discovered additional gaps here or in separate local issues. Runtime identity and unsupported capabilities must remain explicit.

## Validation

- Native Julia reference fixtures and numerical properties.
- Rebuilt native/WASM execution where toolchain permits.
- Original and expanded Basis acceptance suites.
- Offline page execution, persistence, cancellation, and recovery.
- Physical iPad validation remains a separate device check until actually performed.

The rebuilt native gate passed 7/7 fixtures with 76 positive assertions and an
expected-failing assertion control. The source-built WASM passed 29/29 cases
against standard Julia 1.12.1, plus fresh-state and cancellation/recovery checks.
See [candidate evidence](../reports/RUNTIME-CANDIDATE.md) for hashes and reports.

## Explicit boundaries and follow-up

- Solve work arrays use Float64, matching the existing dense numerical backend.
  A broader compiler defect involving dynamically computed type parameters in
  `zeros(T, ...)` remains unresolved; the scoped solver no longer needs that path.
- The SVD-based numerical-rank cutoff can differ from Julia's pivoted-QR rank
  decision for values very close to the cutoff. Well-separated-rank examples are
  the validated lesson domain.
- General LU/rectangular factorization inputs must be finite. The local guard
  prevents nonconverging backend SVD calls; it is an explicit domain restriction.
- Arbitrary packages, sparse/complex factorizations, full language compatibility,
  physical iPad performance, and the six authored lessons are separate work.

Implementation details and the preserved algorithm experiments are in
[BASIS_SOLVES.md](../upstream/julia-vm-oss/docs/vm/BASIS_SOLVES.md).

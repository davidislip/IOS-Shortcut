# Basis dense solves (local BASIS-001)

This local fork change supports the six Basis lessons. Tracking lives at
`../../../../issues/BASIS-001.md` relative to this document. No upstream issue,
PR, or publishing action is part of this local task.

## Contract and source references

The no-JIT execution path continues to use the same Pure Julia methods in
`subset_julia_vm/src/julia/stdlib/LinearAlgebra/src/LinearAlgebra.jl` on native,
WASM, and iOS. It changes neither parser nor compiler semantics. The touched
invariants are True Subset, Pure Julia First, and no-JIT/panic-free execution.

The implementation was compared with the installed official Julia 1.12.1
`LinearAlgebra/src/generic.jl` (matrix backslash), `lu.jl`, `qr.jl`, `svd.jl`
(SVD solve threshold), and `exceptions.jl` (SingularException). The vendored
`julia/` checkout was unavailable. Those official source files are reference
only and were not changed.

- Square diagonal/triangular matrices use direct substitution, as upstream.
- Other square systems use the existing pivoted LU backend and Pure Julia
  forward/back substitution. They no longer compute an explicit inverse.
- Tall systems use QR. Singular values of its small R factor determine
  numerical rank; full rank uses back substitution, rank loss uses a truncated
  SVD solve in the projected coordinates.
- Wide systems use an SVD minimum-norm solve. All rectangular solves retain
  singular values above `min(m,n) * eps(Float64) * largest_singular_value`.
- Explicit SVD factorization solves use `eps(Float64)` relative tolerance,
  matching Julia's inclusive SVD solve convention. In particular,
  `svd(zeros(3,2)) \\ ones(3)` returns NaNs in Julia 1.12.1; matrix backslash
  instead returns the zero minimum-norm solution. A wide explicit `qr(A)`
  solve raises DimensionMismatch, matching the upstream Float64 QRCompactWY
  route; a wide matrix `A \\ b` remains supported.
- Vector and matrix right hand sides preserve the expected output shape.
  Source matrices, right hand sides, and factors are not mutated.
- Mismatched rows throw DimensionMismatch; zero triangular pivots throw
  SingularException. Nonfinite input to general LU/QR/SVD matrix solves throws
  ArgumentError before reaching the backend. Structured diagonal/triangular
  arithmetic follows upstream's direct-arithmetic route.

The existing decomposition backend converts real data to Float64. All solve
work arrays explicitly use Float64 as part of the launch contract. This change
does not promise Float32 result-type parity, complex matrix factorization,
sparse factorization, arbitrary precision, or package loading. Upstream matrix
backslash uses pivoted QR and a condition estimator for rank decisions. The
SVD cutoff here can choose a different rank for a matrix exactly near that
floating-point decision boundary; deterministic well-separated-rank cases are
the validation target. This difference is tracked under local BASIS-001.
Rectangular factorization inputs must be finite in this local runtime. Julia's
LAPACK QR sometimes returns a result for Inf/NaN input; the nalgebra SVD path
must not receive those values because convergence is not guaranteed. The local
ArgumentError guard is an explicit domain restriction tracked in BASIS-001,
not an upstream-parity claim. It is excluded from the shared parity fixtures.

## LU permutation defect and prevention

The Rust backend previously applied nalgebra's inverse row permutation to the
index vector used for `F.p`. That reverses the documented identity
`A[F.p, :] == F.L * F.U` when pivoting contains a cycle longer than two. It was
invisible to the previous 2-by-2/single-swap fixture. The corrected adapter uses
`permute_rows`, exactly as nalgebra 0.34.2's `LU::solve_mut` does. This is a data
representation correction, not a new numerical Rust builtin.

The regression fixture includes a three-row cycle and verifies both factor
reconstruction and vector/matrix solves. The broader blast radius includes
LU destructuring and user reconstruction code, not only backslash. The existing
SVD solve also divided small singular values unconditionally; new fixtures cover
rank-deficient systems, all-zero matrix minimum-norm solutions, and the distinct
upstream all-zero explicit-SVD behavior.

The first diagnostic run exposed a second root cause in Base: `vec(matrix)`
used `collect(matrix)`, which preserves the matrix's shape and copies storage.
Consequently a vector RHS produced a one-column matrix despite correct numbers.
`vec` now follows the two official `Base/abstractarraymath.jl` methods: reshape
an AbstractArray with shared storage, and return an AbstractVector unchanged.
The existing vec fixtures checked only linear element access/length, which
could not distinguish a matrix from a vector. They now assert shape, column
order, identity, empty shapes, and mutation through either alias. Solver fixtures
also assert the vector result shape directly.

Native validation subsequently exposed an allocation specialization defect:
`zeros(T, n, columns)` with a dynamically computed type T lost its type-parameter
binding when called through a learner's function. Top-level solve tests passed.
Since the supported dense real backend already works in Float64, the helper now
uses `zeros(n, columns)::Matrix{Float64}` with an explicit exact return type.
The new function-local fixture exercises triangular, general, tall,
rank-deficient, and wide solves across three input scales. The broader dynamic
type-binding compiler gap remains outside this bounded numerical change and is
tracked under BASIS-001; arbitrary output-type preservation is not claimed.

## Validation entry points

- `basis_square_solve.jl`: pivot cycles, triangular and general systems,
  multiple RHS, integer input, sensitivity, and unchanged inputs.
- `basis_rectangular_solve.jl`: least-squares coefficients and orthogonal
  residuals, close columns, rank deficiency, wide minimum norm, and zero data.
- `basis_solve_errors_shapes.jl`: catchable exceptions and empty shapes.
- `basis_learner_function_solve.jl`: repeated solves in learner functions,
  exercising allocation specialization and scales from 1e-20 to 1e20.

All four are registered in the linalg fixture manifest and end in `true`.
Run them with official Julia and the rebuilt VM. The local helper
`julia scripts/basis_solve_oracle.jl` additionally extracts the exact modified
Pure Julia solve block into an isolated module with the official factorization
backend, runs the same fixture assertions, then randomized and extreme-scale
comparisons. This isolates algorithm errors but cannot validate the VM parser,
dispatch, nalgebra integration, or WASM; those need the rebuilt-runtime gates.

Physical iPad/Safari verification is distinct from native/Node/WASM tests.

## Local algorithm validation, 2026-09-26

An earlier algorithm snapshot passed all 51 shared solve fixture assertions
under official Julia 1.12.1. The exact local Pure Julia solve block with official
factorization adapters passed the same 51 assertions and 122 additional
randomized/extreme-scale comparisons. The old 0.12.2 WASM diagnostic produced
correct square, tall, rank-deficient, wide, and learner-function coefficients;
it exposed the vec shape defect above. A subsequent native diagnostic overriding
only the proposed allocation helper passed all 15 learner-function assertions.

The final rebuilt native executable passed all seven selected regression cases,
including 76 assertions covering solves, errors, shapes, vec aliasing, and the
conditioning sweep. The negative control `@test false` correctly exited with
status 1, confirming that the gate detects failed assertions. Evidence and
executable/source hashes are in [native-final.json](../../../../reports/native-final.json).

The final rebuilt WASM runtime, reporting version 0.11.1 and ABI 3, passed all
29 acceptance cases against standard Julia 1.12.1. These exercised the actual
`run_from_source` interface in Node/V8 with network fetch disabled. Fresh state
between executions, cancellation of a runaway worker, and successful execution
after worker restart also passed. Evidence and build provenance are in
[results-candidate.json](../../../../reports/results-candidate.json). The tested
WASM SHA-256 is
`b9c7256c6d94e6a0529205d9d8e9774ea898b8d4d95ede37eff102c828f35548`.

These gates validate the corrected vec methods, LU permutation, and final
Float64 allocation helper in rebuilt native and WASM artifacts. They do not
establish general Julia compatibility or browser/PWA behavior. Physical iPad
testing remains pending; browser validation is a separate gate.

Reuse the build's `CARGO_TARGET_DIR` for native diagnostics: this also selects
its warm Base and prelude caches; omitting it caused repeated cold compiles
during diagnosis.

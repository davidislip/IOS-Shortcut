# Diagnose the exact Pure Julia solve code using the installed upstream Julia
# factorization backend. This complements, and does not replace, VM/WASM tests.
using Test
using LinearAlgebra
using Random

const repo = dirname(@__DIR__)
const fixture_dir = joinpath(repo, "subset_julia_vm", "tests", "fixtures", "linalg")
const fixtures = ["basis_square_solve.jl", "basis_rectangular_solve.jl", "basis_solve_errors_shapes.jl", "basis_learner_function_solve.jl"]

println("Official Julia ", VERSION, " fixture oracle")
for file in fixtures
    include(joinpath(fixture_dir, file))
end

module BasisSolveOracle
import LinearAlgebra as LA
using LinearAlgebra: istril, istriu, SingularException
struct LU
    L
    U
    p
end
struct QR
    Q
    R
end
struct SVD
    U
    S
    V
end
struct Cholesky
    L
    U
end
function lu(A)
    F = LA.lu(A)
    return LU(Matrix(F.L), Matrix(F.U), F.p)
end
function qr(A)
    F = LA.qr(A)
    return QR(Matrix(F.Q), Matrix(F.R))
end
function svd(A)
    F = LA.svd(A)
    return SVD(F.U, F.S, F.V)
end
function cholesky(A)
    F = LA.cholesky(A)
    return Cholesky(Matrix(F.L), Matrix(F.U))
end
end

const impl_file = joinpath(repo, "subset_julia_vm", "src", "julia", "stdlib", "LinearAlgebra", "src", "LinearAlgebra.jl")
const impl = split(split(read(impl_file, String), "# BEGIN BASIS-001 SOLVES")[2], "# END BASIS-001 SOLVES")[1]
Base.include_string(BasisSolveOracle, replace(impl, "Base.:\\(" => "solve("), impl_file)

# Replace calls in the actual regression fixtures, leaving upstream Base methods
# untouched. This tests the source helper bodies, not a hand-copied algorithm.
function replace_solve_calls(ex)
    ex isa Expr || return ex
    result = Expr(ex.head, map(replace_solve_calls, ex.args)...)
    if result.head == :call
        callee = result.args[1]
        if callee === :\
            result.args[1] = GlobalRef(BasisSolveOracle, :solve)
        elseif callee in (:lu, :qr, :svd, :cholesky)
            result.args[1] = GlobalRef(BasisSolveOracle, callee)
        end
    end
    return result
end

println("Extracted local solve code with official factorization backend")
for file in fixtures
    Base.include(replace_solve_calls, Main, joinpath(fixture_dir, file))
end

Random.seed!(42)
@testset "Basis solver source randomized oracle" begin
    for (m, n) in [(1, 1), (3, 3), (7, 7), (7, 3), (3, 7)]
        for scale in [1e-100, 1.0, 1e100]
            for repeat in 1:4
                A = scale * randn(m, n)
                B = scale * randn(m, 2)
                X = BasisSolveOracle.solve(A, B)
                @test isapprox(X, A \ B; rtol = 1e-10, atol = 1e-10)
                @test isapprox(BasisSolveOracle.solve(A, B[:, 1]), (A \ B)[:, 1]; rtol = 1e-10, atol = 1e-10)
            end
        end
    end
    # Exact rank loss has a unique minimum-norm least-squares solution.
    for (m, n) in [(6, 3), (3, 6)]
        A = randn(m, 2) * randn(2, n)
        B = randn(m, 2)
        @test isapprox(BasisSolveOracle.solve(A, B), A \ B; rtol = 1e-10, atol = 1e-10)
    end
end

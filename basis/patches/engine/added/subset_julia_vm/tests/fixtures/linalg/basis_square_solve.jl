# Local issue BASIS-001: stable square solves, including a non-involutory pivot.
using Test
using LinearAlgebra

@testset "Basis square and factorization solves (BASIS-001)" begin
    A = [0.0 2.0 1.0; 0.0 0.0 3.0; 4.0 1.0 1.0]
    x0 = [1.0, -2.0, 3.0]
    b = A * x0
    A0 = copy(A)
    b0 = copy(b)
    @test size(A \ b) == (3,)
    @test isapprox(A \ b, x0; atol = 1e-12)
    @test A == A0
    @test b == b0

    F = lu(A)
    @test isapprox(F.L * F.U, A[F.p, :]; atol = 1e-12)
    @test isapprox(F \ b, x0; atol = 1e-12)
    X0 = [1.0 2.0; -2.0 0.0; 3.0 -1.0]
    B = A * X0
    B0 = copy(B)
    @test isapprox(A \ B, X0; atol = 1e-12)
    @test isapprox(F \ B, X0; atol = 1e-12)
    @test B == B0

    # An integer input still produces the fractional solution.
    @test isapprox([2 1; 1 3] \ [4, 5], [1.4, 1.2]; atol = 1e-12)
    @test isapprox([1.0 2.0; 0.0 3.0] \ [5.0, 6.0], [1.0, 2.0]; atol = 1e-12)
    @test isapprox([2.0 0.0; 1.0 3.0] \ [2.0, 7.0], [1.0, 2.0]; atol = 1e-12)

    H = [4.0 1.0; 1.0 3.0]
    HB = [1.0 2.0; 3.0 4.0]
    C = cholesky(H)
    @test isapprox(H * (C \ HB), HB; atol = 1e-12)
    @test isapprox(H * (C \ [1.0, 3.0]), [1.0, 3.0]; atol = 1e-12)

    # Sensitivity lesson: test backward error, not an unrealistic fixed error
    # in an ill-conditioned solution.
    E = [1.0 1.0; 1.0 1.0 + 1e-10]
    eb = [2.0, 2.0 + 1e-10]
    ex = E \ eb
    @test norm(E * ex - eb) <= 1e-14 * (norm(E) * norm(ex) + norm(eb))
end
true

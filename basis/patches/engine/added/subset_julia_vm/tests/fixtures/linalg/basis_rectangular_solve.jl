# Local issue BASIS-001: least squares and minimum-norm rectangular solves.
using Test
using LinearAlgebra

@testset "Basis rectangular solves (BASIS-001)" begin
    A = [1.0 0.0; 1.0 1.0; 1.0 2.0]
    b = [1.0, 2.0, 2.0]
    x = A \ b
    @test length(x) == 2
    @test size(x) == (2,)
    @test isapprox(x, [7.0 / 6.0, 0.5]; atol = 1e-12)
    @test norm(transpose(A) * (A * x - b)) < 1e-12
    F = qr(A)
    @test isapprox(F \ b, x; atol = 1e-12)
    B = [1.0 2.0; 2.0 4.0; 2.0 4.0]
    X = A \ B
    @test size(X) == (2, 2)
    @test isapprox(F \ B, X; atol = 1e-12)
    @test isapprox(X[:, 2], 2.0 * x; atol = 1e-12)

    # Normal equations lose this small independent direction; QR preserves it.
    T = [1.0 1.0; 1.0 1.0 + 1e-8; 1.0 1.0 - 1e-8]
    tb = T * [1.0, 2.0]
    @test isapprox(T \ tb, [1.0, 2.0]; atol = 1e-6)

    D = [1.0 2.0; 2.0 4.0; 3.0 6.0]
    db = [1.0, 2.0, 4.0]
    dx = D \ db
    @test isapprox(dx, [17.0 / 70.0, 17.0 / 35.0]; atol = 1e-12)
    @test norm(transpose(D) * (D * dx - db)) < 1e-12
    @test abs(dot(dx, [-2.0, 1.0])) < 1e-12
    @test isapprox(svd(D) \ db, dx; atol = 1e-12)
    DB = [1.0 2.0; 2.0 4.0; 4.0 8.0]
    @test isapprox(svd(D) \ DB, D \ DB; atol = 1e-12)

    W = [1.0 0.0 1.0; 0.0 1.0 1.0]
    wb = [1.0, 2.0]
    wx = W \ wb
    @test size(wx) == (3,)
    @test isapprox(wx, [0.0, 1.0, 1.0]; atol = 1e-12)
    @test isapprox(W * wx, wb; atol = 1e-12)
    @test abs(dot(wx, [-1.0, -1.0, 1.0])) < 1e-12
    @test_throws DimensionMismatch qr(W) \ wb
    WB = [1.0 2.0; 2.0 1.0]
    @test isapprox(W \ WB, [0.0 1.0; 1.0 0.0; 1.0 1.0]; atol = 1e-12)

    @test isapprox(zeros(3, 2) \ ones(3), zeros(2); atol = 1e-12)
    zx = svd(zeros(3, 2)) \ ones(3)
    @test isnan(zx[1]) && isnan(zx[2])
end
true

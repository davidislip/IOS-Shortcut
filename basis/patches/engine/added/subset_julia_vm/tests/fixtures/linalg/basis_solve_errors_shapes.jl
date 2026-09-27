# Local issue BASIS-001: shape preservation and catchable numerical errors.
using Test
using LinearAlgebra

@testset "Basis solve errors and shapes (BASIS-001)" begin
    A = [2.0 1.0; 1.0 3.0]
    @test_throws DimensionMismatch A \ [1.0, 2.0, 3.0]
    @test_throws DimensionMismatch A \ zeros(3, 2)
    @test_throws DimensionMismatch lu(A) \ [1.0]
    @test_throws DimensionMismatch qr(A) \ [1.0]
    @test_throws DimensionMismatch svd(A) \ [1.0]
    @test_throws SingularException [1.0 2.0; 2.0 4.0] \ [1.0, 2.0]
    @test_throws SingularException [1.0 0.0; 0.0 0.0] \ [1.0, 2.0]
    @test_throws ArgumentError [NaN 1.0; 1.0 2.0] \ [1.0, 2.0]

    @test size(A \ zeros(2, 0)) == (2, 0)
    @test size([1.0 0.0; 1.0 1.0; 1.0 2.0] \ zeros(3, 0)) == (2, 0)
    @test size(zeros(0, 2) \ zeros(0)) == (2,)
    @test size(zeros(3, 0) \ ones(3)) == (0,)
    @test size(zeros(0, 2) \ zeros(0, 3)) == (2, 3)
    @test size(zeros(0, 0) \ zeros(0, 2)) == (0, 2)
end
true

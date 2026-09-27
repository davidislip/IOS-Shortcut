# Local BASIS-001: a solve inside a learner's function must bind allocation
# types correctly. Top-level fixtures did not exercise this specialization.
using LinearAlgebra
using Test

function scaled_sensitivity(epsilon)
    A = [1.0 1.0; 0.0 epsilon]
    b = [2.0, epsilon]
    x = A \ b
    y = A \ (b + [0.0, epsilon])
    return norm(y - x) / norm(x)
end

function learner_general(scale)
    A = scale * [2.0 1.0; 1.0 3.0]
    b = scale * [4.0, 5.0]
    return A \ b
end

function learner_tall(scale)
    A = scale * [1.0 0.0; 1.0 1.0; 1.0 2.0]
    b = scale * [1.0, 2.0, 2.0]
    return A \ b
end

function learner_rank_deficient(scale)
    A = scale * [1.0 2.0; 2.0 4.0; 3.0 6.0]
    b = scale * [1.0, 2.0, 4.0]
    return A \ b
end

function learner_wide(scale)
    A = scale * [1.0 0.0 1.0; 0.0 1.0 1.0]
    b = scale * [1.0, 2.0]
    return A \ b
end

@testset "Basis solves in learner functions (BASIS-001)" begin
    for epsilon in [1e-2, 1e-4, 1e-6]
        @test isapprox(scaled_sensitivity(epsilon), 1.0; atol = 1e-12)
    end
    for scale in [1e-20, 1.0, 1e20]
        @test isapprox(learner_general(scale), [1.4, 1.2]; atol = 1e-12)
        @test isapprox(learner_tall(scale), [7.0 / 6.0, 0.5]; atol = 1e-12)
        @test isapprox(learner_rank_deficient(scale), [17.0 / 70.0, 17.0 / 35.0]; atol = 1e-12)
        @test isapprox(learner_wide(scale), [0.0, 1.0, 1.0]; atol = 1e-12)
    end
end
true

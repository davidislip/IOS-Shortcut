using LinearAlgebra

# Exercise the learner-facing function boundary, not only top-level solves.
# Uniform scaling must preserve tall least-squares and minimum-norm solutions.
function learner_solve(A, b, scale)
    return (scale * A) \ (scale * b)
end

tall_A = [1.0 0.0; 1.0 1.0; 1.0 2.0]
tall_b = [1.0, 2.0, 2.0]
rank_A = [1.0 2.0; 2.0 4.0; 3.0 6.0]
rank_b = [4.0, 7.0, 8.0]
wide_A = [1.0 0.0 1.0; 0.0 1.0 1.0]
wide_b = [2.0, 3.0]
scales = [1.0e-20, 1.0, 1.0e20]
solutions = zeros(3, 7)
for i in 1:length(scales)
    tall_x = learner_solve(tall_A, tall_b, scales[i])
    rank_x = learner_solve(rank_A, rank_b, scales[i])
    wide_x = learner_solve(wide_A, wide_b, scales[i])
    solutions[i, 1] = tall_x[1]
    solutions[i, 2] = tall_x[2]
    solutions[i, 3] = rank_x[1]
    solutions[i, 4] = rank_x[2]
    solutions[i, 5] = wide_x[1]
    solutions[i, 6] = wide_x[2]
    solutions[i, 7] = wide_x[3]
end
solutions


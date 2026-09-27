using LinearAlgebra
A = [1.0 2.0; 2.0 4.0; 3.0 6.0]
b = [4.0, 7.0, 8.0]
x = A \ b
r = b - A * x
# Orthogonality to the nullspace distinguishes the minimum-norm minimizer.
[x[1], x[2], norm(A' * r) / (norm(A) * norm(b)), dot(x, [-2.0, 1.0])]

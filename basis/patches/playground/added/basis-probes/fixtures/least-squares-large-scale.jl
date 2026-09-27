using LinearAlgebra
A = 1.0e20 * [1.0 0.0; 1.0 1.0; 1.0 2.0]
b = 1.0e20 * [1.0, 2.0, 2.0]
x = A \ b
r = b - A * x
[x[1], x[2], norm(A' * r) / (norm(A) * norm(b))]

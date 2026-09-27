using LinearAlgebra
A = 1.0e-20 * [2.0 1.0; 1.0 3.0]
b = 1.0e-20 * [0.0, -5.0]
x = A \ b
[x[1], x[2], norm(A * x - b) / norm(b)]

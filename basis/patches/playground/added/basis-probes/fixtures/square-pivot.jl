using LinearAlgebra
A = [0.0 2.0 1.0; 1.0 1.0 0.0; 2.0 0.0 1.0]
b = [1.0, 1.0, 7.0]
x = A \ b
[x[1], x[2], x[3], norm(A * x - b) / norm(b)]

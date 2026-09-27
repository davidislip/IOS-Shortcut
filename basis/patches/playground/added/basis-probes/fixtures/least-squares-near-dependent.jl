using LinearAlgebra
A = [1.0 1.0; 1.0 1.00000001; 1.0 0.99999999; 1.0 1.00000002]
b = A * [2.0, -1.0]
x = A \ b
[x[1], x[2], norm(A * x - b) / norm(b)]

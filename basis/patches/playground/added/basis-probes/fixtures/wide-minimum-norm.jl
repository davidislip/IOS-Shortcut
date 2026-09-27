using LinearAlgebra
A = [1.0 0.0 1.0; 0.0 1.0 1.0]
b = [2.0, 3.0]
x = A \ b
[x[1], x[2], x[3], norm(A * x - b) / norm(b), dot(x, [-1.0, -1.0, 1.0])]

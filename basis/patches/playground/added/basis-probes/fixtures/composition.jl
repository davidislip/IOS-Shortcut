using LinearAlgebra
A = [2.0 1.0; 0.0 1.0]
B = [0.0 -1.0; 1.0 0.0]
x = [3.0, 1.0]
y = (A * B) * x
[y[1], y[2], norm(A * (B * x) - y) + norm(A * zeros(2))]

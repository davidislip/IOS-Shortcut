using LinearAlgebra
A = [1.0 2.0; 2.0 4.0]
n = [-2.0, 1.0]
x = [3.0, -1.0]
z = A * n
[z[1], z[2], norm(A * (x + n) - A * x)]

using LinearAlgebra
A = [1.0 0.0; 1.0 1.0; 1.0 2.0]
b = [1.0, 2.0, 2.0]
F = qr(A)
Q = Matrix(F.Q)
R = Matrix(F.R)
R \ (Q[:, 1:2]' * b)

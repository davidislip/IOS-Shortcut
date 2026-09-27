using LinearAlgebra
A = [2.0 1.0; 1.0 3.0]
B = [0.0 10.0; -5.0 15.0]
X = A \ B
[X[1, 1], X[2, 1], X[1, 2], X[2, 2], size(X, 1), size(X, 2), norm(A * X - B) / norm(B)]

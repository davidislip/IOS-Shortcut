using LinearAlgebra
A = [1.0 0.0; 1.0 1.0; 1.0 2.0]
B = [1.0 2.0; 2.0 1.0; 2.0 0.0]
X = A \ B
R = B - A * X
[X[1, 1], X[2, 1], X[1, 2], X[2, 2], size(X, 1), size(X, 2), norm(A' * R) / (norm(A) * norm(B))]

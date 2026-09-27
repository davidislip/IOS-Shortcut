using LinearAlgebra
epsilon = 1.0e-6
A = [1.0 1.0; 0.0 epsilon]
b = [2.0, epsilon]
x_true = [1.0, 1.0]
x_bad = [0.0, 2.0]
r = norm(b - A * x_bad)
e = norm(x_bad - x_true) / norm(x_true)
changed = A \ [2.0, 2.0 * epsilon]
[r, e, changed[1], changed[2]]

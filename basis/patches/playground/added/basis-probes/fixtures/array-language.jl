using LinearAlgebra
A = [1.0 2.0 3.0; 4.0 5.0 6.0]
x = zeros(3)
for j in 1:size(A, 2)
    x[j] = A[1, j]
end
y = x .^ 2 .+ 1.0
z = A[:, 2] + [2.0, 5.0]
[sum(y) - 10.0, z[2], norm(A'[:, 1] - x), A[1, 1], size(A, 1), size(A, 2)]

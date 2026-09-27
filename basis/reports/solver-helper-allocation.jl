function basis_diag_alloc(A, B, n)::Matrix{Float64}
    return zeros(n, size(B, 2))
end
function basis_diag_nested(epsilon)
    A = [1.0 1.0; 0.0 epsilon]
    b = [2.0, epsilon]
    B = reshape(b, length(b), 1)
    return basis_diag_alloc(A, B, size(A, 2))
end
for epsilon in [1e-2, 1e-4, 1e-6]
    X = basis_diag_nested(epsilon)
    println(size(X))
    println(X[1,1] == 0.0 && X[2,1] == 0.0)
end
true
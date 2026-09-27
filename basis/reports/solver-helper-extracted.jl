using LinearAlgebra

# Upstream generic.jl selects LU for square matrices and rank-revealing QR for
# rectangular matrices. The available backend has unpivoted QR: use it for
# full-column-rank systems and SVD for minimum-norm wide/rank-deficient solves.
# Keep the actual solves here in Pure Julia; never form inv(A) or A' * A.

function basis_diag_check_solve_rows(m, B)
    if size(B, 1) != m
        throw(DimensionMismatch("matrix has $m rows, but right hand side has $(size(B, 1)) rows"))
    end
end

function basis_diag_check_solve_finite(A)
    for j in 1:size(A, 2)
        for i in 1:size(A, 1)
            if !isfinite(A[i, j])
                throw(ArgumentError("matrix contains Infs or NaNs"))
            end
        end
    end
end

function basis_diag_solve_zeros(A, B, n)::Matrix{Float64}
    return zeros(n, size(B, 2))
end

function basis_diag_diagonal_solve(A, B)
    n = size(A, 1)
    X = basis_diag_solve_zeros(A, B, n)
    for i in 1:n
        if iszero(A[i, i])
            throw(SingularException(Int64(i)))
        end
        for c in 1:size(B, 2)
            X[i, c] = B[i, c] / A[i, i]
        end
    end
    return X
end

function basis_diag_forward_substitute(L, B)
    n = size(L, 1)
    basis_diag_check_solve_rows(n, B)
    if size(L, 2) != n
        throw(DimensionMismatch("triangular solve requires a square factor"))
    end
    X = basis_diag_solve_zeros(L, B, n)
    for i in 1:n
        if iszero(L[i, i])
            throw(SingularException(Int64(i)))
        end
        for c in 1:size(B, 2)
            value = B[i, c]
            for j in 1:(i - 1)
                value = value - L[i, j] * X[j, c]
            end
            X[i, c] = value / L[i, i]
        end
    end
    return X
end

function basis_diag_back_substitute(R, B)
    n = size(R, 2)
    basis_diag_check_solve_rows(n, B)
    if size(R, 1) != n
        throw(DimensionMismatch("triangular solve requires a square factor"))
    end
    X = basis_diag_solve_zeros(R, B, n)
    for i in n:-1:1
        if iszero(R[i, i])
            throw(SingularException(Int64(i)))
        end
        for c in 1:size(B, 2)
            value = B[i, c]
            for j in (i + 1):n
                value = value - R[i, j] * X[j, c]
            end
            X[i, c] = value / R[i, i]
        end
    end
    return X
end

function basis_diag_lu_solve(F::LU, B)
    n = size(F.L, 1)
    basis_diag_check_solve_rows(n, B)
    PB = basis_diag_solve_zeros(F.L, B, n)
    for c in 1:size(B, 2)
        for i in 1:n
            PB[i, c] = B[F.p[i], c]
        end
    end
    return basis_diag_back_substitute(F.U, basis_diag_forward_substitute(F.L, PB))
end

function basis_diag_svd_solve(F::SVD, B, rtol, include_cutoff)
    basis_diag_check_solve_rows(size(F.U, 1), B)
    k = length(F.S)
    X = basis_diag_solve_zeros(F.V, B, size(F.V, 1))
    if k == 0
        return X
    end
    tol = rtol * F.S[1]
    # Matrix least squares excludes zeros. Explicit SVD solves follow upstream
    # searchsortedlast's inclusive cutoff, including its all-zero NaN result.
    for j in 1:k
        if F.S[j] > tol || (include_cutoff && F.S[j] == tol)
            for c in 1:size(B, 2)
                value = zero(eltype(X))
                for i in 1:size(B, 1)
                    value = value + conj(F.U[i, j]) * B[i, c]
                end
                value = value / F.S[j]
                for i in 1:size(X, 1)
                    X[i, c] = X[i, c] + F.V[i, j] * value
                end
            end
        end
    end
    return X
end

function basis_diag_qr_solve(F::QR, B)
    basis_diag_check_solve_rows(size(F.Q, 1), B)
    if size(F.R, 1) < size(F.R, 2)
        throw(DimensionMismatch("QR solve requires at least as many rows as columns"))
    end
    return basis_diag_back_substitute(F.R, adjoint(F.Q) * B)
end

function basis_diag_cholesky_solve(F::Cholesky, B)
    return basis_diag_back_substitute(F.U, basis_diag_forward_substitute(F.L, B))
end

function basis_diag_matrix_solve(A, B)
    m = size(A, 1)
    n = size(A, 2)
    basis_diag_check_solve_rows(m, B)
    if m == 0 || n == 0
        return basis_diag_solve_zeros(A, B, n)
    end
    if m == n
        if istril(A)
            if istriu(A)
                return basis_diag_diagonal_solve(A, B)
            end
            return basis_diag_forward_substitute(A, B)
        end
        if istriu(A)
            return basis_diag_back_substitute(A, B)
        end
        basis_diag_check_solve_finite(A)
        return basis_diag_lu_solve(lu(A), B)
    end
    basis_diag_check_solve_finite(A)
    rtol = min(m, n) * eps(Float64)
    if m > n
        F = qr(A)
        # Unpivoted R's diagonal alone is not a reliable rank test. Its SVD
        # has the same singular values as A without forming normal equations.
        S = svd(F.R)
        if S.S[n] > rtol * S.S[1]
            return basis_diag_qr_solve(F, B)
        end
        return basis_diag_svd_solve(S, adjoint(F.Q) * B, rtol, false)
    end
    return basis_diag_svd_solve(svd(A), B, rtol, false)
end

function basis_solve(A::AbstractMatrix, b::AbstractVector)
    return vec(basis_diag_matrix_solve(A, reshape(b, length(b), 1)))
end

function basis_solve(A::AbstractMatrix, B::AbstractMatrix)
    return basis_diag_matrix_solve(A, B)
end

function basis_solve(F::LU, b::AbstractVector)
    return vec(basis_diag_lu_solve(F, reshape(b, length(b), 1)))
end

function basis_solve(F::LU, B::AbstractMatrix)
    return basis_diag_lu_solve(F, B)
end

function basis_solve(F::QR, b::AbstractVector)
    return vec(basis_diag_qr_solve(F, reshape(b, length(b), 1)))
end

function basis_solve(F::QR, B::AbstractMatrix)
    return basis_diag_qr_solve(F, B)
end

function basis_solve(F::Cholesky, b::AbstractVector)
    return vec(basis_diag_cholesky_solve(F, reshape(b, length(b), 1)))
end

function basis_solve(F::Cholesky, B::AbstractMatrix)
    return basis_diag_cholesky_solve(F, B)
end

function basis_solve(F::SVD, b::AbstractVector)
    return vec(basis_diag_svd_solve(F, reshape(b, length(b), 1), eps(Float64), true))
end

function basis_solve(F::SVD, B::AbstractMatrix)
    return basis_diag_svd_solve(F, B, eps(Float64), true)
end

function scaled_sensitivity(epsilon)
    A = [1.0 1.0; 0.0 epsilon]
    b = [2.0, epsilon]
    x = basis_solve(A, b)
    y = basis_solve(A, b + [0.0, epsilon])
    return norm(y - x) / norm(x)
end
changes = zeros(3)
epsilons = [1e-2, 1e-4, 1e-6]
for i in 1:3
    changes[i] = scaled_sensitivity(epsilons[i])
end
println(changes)
changes
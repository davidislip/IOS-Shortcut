function column_combination(A, x)
    y = zeros(size(A, 1))
    for j in 1:length(x)
        y = y + x[j] * A[:, j]
    end
    return y
end
A = [2.0 1.0; 1.0 3.0]
x = [1.0, 2.0]
column_combination(A, x) - A * x

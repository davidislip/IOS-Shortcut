using LinearAlgebra
function scaled_sensitivity(epsilon)
    A = [1.0 1.0; 0.0 epsilon]
    b = [2.0, epsilon]
    x = A \ b
    y = A \ (b + [0.0, epsilon])
    return norm(y - x) / norm(x)
end
epsilons = [1.0e-2, 1.0e-4, 1.0e-6]
changes = zeros(3)
for i in 1:length(epsilons)
    changes[i] = scaled_sensitivity(epsilons[i])
end
changes

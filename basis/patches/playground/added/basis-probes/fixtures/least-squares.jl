using LinearAlgebra
t = [0.0, 1.0, 2.0]
y = [1.0, 2.0, 2.0]
A = hcat(ones(length(t)), t)
A \ y

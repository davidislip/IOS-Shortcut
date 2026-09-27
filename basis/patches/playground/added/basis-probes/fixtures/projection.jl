using LinearAlgebra
u = [2.0, 1.0]
b = [1.0, 3.0]
p = (dot(u, b) / dot(u, u)) * u
[p[1], p[2], dot(u, b - p)]

using LinearAlgebra
function project_line(u, b)
    if dot(u, u) == 0.0
        error("zero direction cannot define a line")
    end
    return (dot(u, b) / dot(u, u)) * u
end
u = [2.0, 1.0]
b = [1.0, 3.0]
p = project_line(u, b)
[p[1], p[2], dot(u, b - p), norm(project_line(3.0 * u, b) - p)]

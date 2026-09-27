using LinearAlgebra
function project_line(u, b)
    if dot(u, u) == 0.0
        error("zero direction cannot define a line")
    end
    return (dot(u, b) / dot(u, u)) * u
end
project_line([0.0, 0.0], [1.0, 3.0])

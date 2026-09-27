# Basis: first-version scope

Status: product scope with an implemented runtime lab. The locally rebuilt runtime passes 29/29 numerical cases against standard Julia, plus fresh-state and cancellation checks. Desktop Chrome passes all ten browser checks, including offline reload, cold browser restart, new code execution, draft recovery, cancellation, and export. See the [candidate evidence](reports/RUNTIME-CANDIDATE.md) and [lab instructions](app/README.md). The six guided lessons and physical iPad validation remain to be implemented/performed.

Working name: Basis. Prepared 2026-09-26.

## Product and learner

An offline iPad learning app that connects linear algebra intuition with writing Julia. The learner knows some basics and wants to understand what the mathematics means, then express and explore it in code.

The central unit is one experiment shared by a short explanation, a manipulable diagram, and editable code. A lesson follows **predict -> manipulate -> code -> explain**. The user can leave the guided path to save and explore their own variants.

The course resource is [Nicolas Venkovic's Numerical Linear Algebra for CS and IE](https://venkovic.github.io/NLA-for-CS-and-IE). Basis adds original intuition exercises and just-in-time Julia instruction around that course.

## Confirmed requirements and working choices

| Item | Scope |
|---|---|
| Learner | Knows some linear algebra; wants stronger intuition |
| Device | iPad |
| Connectivity | Fully offline learning, editing, and execution after an initial download |
| Programming | Write and execute new Julia source, including original functions and loops |
| Learning approach | Guided lessons plus a persistent experimental workspace |
| First curriculum | Six lessons in three connected modules |
| Working interface | Installable web app, if the execution prototype supports this route |
| Runtime | Local SubsetJuliaVM 0.11.1 source build with Basis numerical fixes; hash-pinned by `runtime-lock.json` |

An initial download is the working interpretation of offline, consistent with cppad. Once installed, a normal study session must need neither a server nor a running computer. Editing offline and running later does not meet the requirement.

The programming compatibility target is the language and numerical operations required by these lessons, with saved code portable to standard Julia. The app must identify its actual runtime and supported features. Experimental compatibility runtimes must not be described as the full Julia implementation.

## A complete study session

1. Open the installed app in airplane mode. Resume the lesson, draft, inputs, and notes from the previous session.
2. Read a short explanation and record a prediction. The prediction is editable; it is not a gate that prevents exploration.
3. Move vectors or change numeric inputs. Observe the corresponding matrix and geometry.
4. Open the Julia workspace using the same input values. Modify the starter or write a different approach, then press Run.
5. Inspect actual computed values alongside the figure. Press Check for feedback about the mathematical properties being tested.
6. Write a brief explanation and compare it with an authored explanation when ready.
7. Save a named copy of the experiment, or continue to the next lesson.

The user should finish a lesson able to predict an unfamiliar example and make a meaningful code change. Successful execution alone does not establish understanding.

## Six launch lessons

Each lesson targets about 15-25 minutes, with optional exploration. These are design targets, not measured completion times. Julia concepts appear when they help answer the mathematical question.

| Module / lesson | Mathematical question | Interaction | Julia practice | Evidence of learning |
|---|---|---|---|---|
| 1.1 Matrices move vectors | What do the columns of a matrix mean? | Move two basis images; watch vectors and a grid transform | Vector/matrix literals, indexing, scalar multiplication, `A * x` | Predict an image and reproduce it using a weighted sum of columns |
| 1.2 Span and dependence | Which targets can these columns reach? | Move columns into and out of dependence; vary coefficients | Column slices, small functions, loops over examples | Explain reachable targets and why different coefficients can give the same output |
| 2.1 Solving as reconstruction | What does a solution to `A * x = b` represent? | Reach a target by combining columns; display the residual | `A \ b`, dimensions, `using LinearAlgebra`, `norm` | Recover coefficients and distinguish a unique solution, no solution, and infinitely many solutions geometrically |
| 2.2 Sensitive systems | Why can a tiny input change move the answer far? | Perturb the target with the matrix fixed; compare solutions | Functions, parameter sweeps, residuals, relative changes | Separate input sensitivity, residual size, and error in a known solution |
| 3.1 Projection | What is the closest point on a line? | Move a target; inspect projection and perpendicular residual | `dot`, vector arithmetic, implement a projection function | Check orthogonality and explain why the projected point is closest |
| 3.2 Least squares | How do we fit when exact reconstruction is impossible? | Drag data points; inspect a fitted line and its residuals | Build a rectangular design matrix; use `A \ b`; transpose and residual norms | Explain a nonzero optimal residual and test column-space orthogonality |

Optional reminders cover vector length, dot product, dimensions, linear combinations, function definitions, indexing, and matrix multiplication versus broadcasting. Reminders open in context and preserve the experiment.

The launch lessons use real-valued, small dense arrays. Visual geometry is primarily two-dimensional; line fitting may use several observations. Three-dimensional scenes, complex arithmetic lessons, and large numerical benchmarks are later work.

## Main interface

- **Home:** continue the current lesson, choose among the six lessons, or open saved experiments.
- **Lesson workspace:** explanation, current diagram, Julia source, numeric output, prediction, and short notes.
- **My experiments:** named saved copies and an empty scratchpad using the same runtime and results viewer.

In landscape, use a lesson column beside a workspace with the figure above the editor and output. Make the lesson collapsible. In portrait or with the software keyboard open, use Learn / Explore / Code views that preserve the same experiment. Avoid requiring all panes to fit simultaneously.

All vector dragging has equivalent numeric inputs. Controls must work with touch and hardware keyboard. Julia editing includes a compact symbol row, indentation, Run, Stop, Check, and Reset starter; resetting preserves a recoverable copy of the draft. A visible help panel lists supported Julia features.

The results viewer initially supports text, useful errors, real scalars, vectors, matrices, and a few lesson-specific overlays. General plotting packages and a multi-cell notebook engine are outside the first version.

## Keep the figure and code honest

The experiment stores one set of named inputs. Controls edit those inputs, and each run takes a snapshot of the inputs and source. Changing an input must not rewrite learner-authored code.

Immediate manipulation uses browser calculations for the diagram. Julia outputs appear only after an actual run and are labeled separately from the interactive preview. Editing code or inputs marks earlier run results as out of date. A delayed result cannot replace one from a newer run.

Each exercise has a small documented output contract, such as a solution vector `x` or projection `p`. The runner validates output dimensions and numeric values before adding them to the diagram. Free-form code still produces text and numeric output even when it does not supply a visual overlay.

V1 uses one editable script per experiment with explicit Run. Each run starts from the current source and input snapshot, without depending on variables left behind by earlier runs. User-defined helper functions and loops must work. The runtime investigation decides the mechanism for reset and result extraction.

## Feedback and mathematical correctness

Checks assess mathematical properties with scale-aware tolerances. They do not compare printed arrays as exact strings. Each lesson ships multiple reference cases, including a relevant degenerate or invalid input.

| Topic | Required check or distinction |
|---|---|
| Transformations | `A * x` matches the sum of columns weighted by `x`; the origin stays fixed |
| Dependence | A known nonzero null vector maps to zero; adding it to coefficients preserves the output |
| Solving | For a planted nonsingular case, recover the solution and check reconstruction |
| Residuals | Use `r = b - A * x` consistently in code, labels, and arrow direction |
| Sensitivity | Keep the problem fixed when measuring error; distinguish it from the perturbed problem |
| Projection | For nonzero `u`, check both that `p` lies in its span and that `dot(u, b - p)` is approximately zero; explain a zero direction as invalid |
| Least squares | For full column rank, check `A' * (b - A * x)` is approximately zero; a nonzero residual can be correct |

Show solution error only when a known reference solution exists. A small residual alone must not be described as an accurate solution. Near dependence and exact dependence are different cases; a display-rounding threshold must not change the mathematical classification.

Use orthogonality to explain least squares, but do not teach forming normal equations as the preferred general solver. If the runtime lacks a suitable rectangular solve, that is a runtime gap, not a reason to silently substitute a less stable method.

Authored hints progress from conceptual guidance to a partial implementation and then a worked solution. Free-text explanations are saved and supported with comparison prompts; they are not automatically graded for mathematical understanding.

Progress records separate milestones: explored, code checks passed, and reflection recorded. They describe completed activities, not a claim of mastery. Lessons remain freely accessible.

## Offline storage and downloads

Bundle the selected runtime, lesson text, diagrams, equation rendering, editor assets, hints, and checks. No font, code, or runtime dependency may require a CDN during study.

The offline download has a clear completion state based on asset availability and a small execution self-check. An interrupted update must leave the previous working version usable. Preserve drafts and notes across lesson updates.

Save locally as the user works. Export an experiment as a standard `.jl` script with its inputs and as a portable backup containing notes and progress. Import the backup into a fresh local store. External course readings are supplemental links; required lesson explanations must be available offline.

Local persistence is not an absolute guarantee against the browser or user clearing data. Include a simple backup action and test recovery rather than promising permanent storage.

## Course mapping and authoring

The [course overview](https://venkovic.github.io/NLA-for-CS-and-IE/TUM_NLA-for-CS-and-IE_Lecture00.pdf) identifies linear algebra essentials and Julia essentials before the numerical methods material. The content of those two introductory PDFs was not accessible during this scoping audit. Foundational interactions above are proposed original supplements, not verified course exercises.

| Basis module | Verified reading connection |
|---|---|
| Transformations and span | Foundation topics identified in the course overview; exact introductory slide mapping remains to be checked |
| Systems and sensitivity | [Lecture 03: floating-point arithmetic and error analysis](https://venkovic.github.io/NLA-for-CS-and-IE/TUM_NLA-for-CS-and-IE_Lecture03.pdf) and [Lecture 04: direct methods for dense systems](https://venkovic.github.io/NLA-for-CS-and-IE/TUM_NLA-for-CS-and-IE_Lecture04.pdf) |
| Projection and fitting | [Lecture 07: orthogonalization and least squares](https://venkovic.github.io/NLA-for-CS-and-IE/TUM_NLA-for-CS-and-IE_Lecture07.pdf) |

The course PDFs contain exercises, but this audit did not verify downloadable standalone notebooks. Budget for original executable lessons. Use original text, diagrams, examples, and code with clear course attribution and links. A redistribution license for the course material has not been verified; copied slides or notebook bundles are not a launch dependency.

Each authored lesson records its ID, prerequisites, mathematical and Julia objectives, source links and verified page references, starter, worked solution, hint sequence, experiment inputs, required runtime features, output contract, and numerical checks. Execute every solution on both the chosen offline runtime and pinned standard Julia during development. Development-time reference validation may use a computer; the learner's session must remain offline on iPad.

## Relationship to cppad

Keep Basis in its own `basis/` project. Reuse or adapt cppad's lesson-navigation pattern, editor integration, symbol row, source attribution, saved drafts, responsive layout, and installable-app conventions.

Replace the C++ compiler and WASI pipeline with the selected Julia-compatible runtime. Replace the simulated terminal as the primary results surface with inspectable numeric and visual output. Replace exact stdout checks with numerical property checks. Julia syntax support and equation rendering need their own integration.

Do not extract a shared application framework during this first release. The existing cppad app and its lesson work remain independent. Add Basis to the shared Pages build only after an offline prototype succeeds; publishing is not part of this scoping deliverable.

## Delivery sequence

| Stage | Deliverable | Exit condition |
|---|---|---|
| 0. Runtime investigation | Minimal editor and offline runner; compatibility and device results | New source executes correctly in airplane mode on the target iPad; limitations and runtime identity are documented |
| 1. One complete lesson | Solving-as-reconstruction lesson with diagram, editable code, checks, save/resume | A learner completes predict -> manipulate -> code -> explain offline; results remain synchronized |
| 2. Learning release | All six lessons, reminders, hints, scratchpad, saved experiments | Every worked solution and check passes on the offline runtime and standard Julia reference |
| 3. Device readiness | Offline pack, updates, backup/import, keyboard/touch polish | Device acceptance scenarios pass without data loss or hidden network dependence |

Stage 0 determines whether the proposed web app can satisfy the user's requirement. No reliable delivery estimate for the whole app should be fixed before that result. Building or porting a general Julia runtime would be a separate, substantially larger project.

## Release acceptance

- From a closed app, reopen in airplane mode and run freshly written code, including a new function, rather than only replaying bundled examples.
- Complete one lesson from each module offline; matrix solve, projection, and rectangular least squares all execute successfully.
- Stop runaway code without freezing the interface, then run a valid example.
- See errors for malformed code, unsupported constructs, bad dimensions, and invalid numerical inputs; a failure never displays a fabricated success result.
- Change inputs during a run and confirm the eventual output retains its original input association.
- Save, close, reopen, export, and restore an experiment with code, inputs, prediction, and notes intact.
- Use the main flow with touch alone and with a hardware keyboard in both orientations.
- Verify learning outcomes with an unfamiliar example, a code modification, and a short explanation; revise the lesson if the learner only follows instructions mechanically.

## Later curriculum and features

After the launch experience works, add elimination and pivoting, Gram-Schmidt and QR, eigenvectors and power iteration, then selected sparse and iterative methods from the course. These need a fresh runtime capability check.

Leave cloud execution, accounts, synchronization, collaboration, AI tutoring, arbitrary package installation, native App Store distribution, general plotting support, and full-course conversion outside this release. The first useful product is six coherent offline lessons plus a dependable place to experiment with their mathematics in Julia.

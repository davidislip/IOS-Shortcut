# Basis

An offline Julia workspace for the linear algebra learning app described in
[SCOPE.md](SCOPE.md). The workspace is implemented; the six guided lessons and
their interactive diagrams are the next product stage.

The runtime is a locally modified SubsetJuliaVM, an interpreter for a subset of
Julia compiled to WebAssembly. Code executes on the device in a worker. There
is no computation server, and every Run starts with fresh variables.

## Open on iPad

Open [Basis](https://davidislip.github.io/IOS-Shortcut/basis/) in Safari, then
Share -> Add to Home Screen. Open the installed app while connected and wait for
**Ready for offline use**. Turn on airplane mode with Wi-Fi off, close and reopen
the app, and run newly written Julia code. Physical iPad acceptance is still pending.

If an older version persists, use the [direct updater](https://davidislip.github.io/IOS-Shortcut/basis/update.html).

## Open the local app

From the repository root:

```powershell
npm --prefix basis ci
node basis/build.mjs
node basis/serve.mjs
```

Open `http://127.0.0.1:4174`. Wait for **Ready for offline use** before disconnecting.
If the browser still shows an older design, open
`http://127.0.0.1:4174/update.html` while connected. This downloads and activates
the latest offline pack, then opens the lab without clearing the saved draft.
The editor highlights Julia syntax, shows line numbers, matches brackets, and
supports indentation and undo. CodeMirror and the Julia grammar are bundled in
the offline pack. It saves its draft automatically, exports ordinary `.jl` source, and
supports Stop and a run deadline. Results show numbers, vectors, matrices, and
errors. Changes to the code mark earlier results as stale.

The app uses cppad's compact dark workspace styling. The toolbar switches between
dark and light mode, remembering the choice on this device. Wide screens show
code and results side by side; narrower screens use Code / Results tabs. Run
opens Results, and switching back preserves the editor. **About & settings**
contains the run time limit, installation information, and runtime details.

## Numerical scope

The launch target is small dense real arrays with Float64 numerical work:

- Matrix/vector arithmetic, indexing, broadcasting, dot products, and norms.
- Learner-written functions and loops for transformations and projections.
- Square solves with pivoting and triangular substitution.
- Rectangular least squares, rank-deficient systems, and wide minimum-norm solves.
- Vector or matrix right-hand sides, dimension errors, and singular-system errors.

This does not provide arbitrary Julia package installation, sparse or complex
factorizations, or complete Julia language compatibility. Numerical rank decisions
very close to the floating-point cutoff may differ from standard Julia.

## Evidence and development

Current gates: **29/29** numerical WASM cases against Julia 1.12.1, **76** native
assertions, **10/10** app tests, and **16/16** Chrome browser checks including the
[dark workspace and theme controls](reports/WORKBENCH.md). WebKit executes
Julia, but its Windows cache round trip failed independently of this app, so
Safari/iPad offline acceptance remains open.

[Candidate acceptance](reports/RUNTIME-CANDIDATE.md) records the rebuilt runtime
and remaining device checks; the [baseline](reports/RUNTIME-ACCEPTANCE.md)
preserves the original binary's failures. Desktop browser
success does not certify Safari or a physical iPad. An iPad installation needs a
trusted HTTPS origin and a completed initial download. The Pages workflow
publishes Basis alongside cppad; it builds from the exact vendored runtime
selected by `runtime-lock.json` and runs app tests before deploying.

[BUILDING.md](BUILDING.md) explains the pinned source, local toolchain, build
caches, and verification commands. [app/README.md](app/README.md) describes the
worker, storage, and offline update behavior. Local fork edits are preserved in
[patches/](patches/) because the independent upstream checkouts are ignored by
the parent repository.

The curriculum uses [Nicolas Venkovic's course](https://venkovic.github.io/NLA-for-CS-and-IE)
as a reading reference. Required lesson explanations and exercises will be
original, bundled content. Course PDFs are not currently redistributed.

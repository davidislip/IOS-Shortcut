# Building and checking the local Julia runtime

Run these commands from the monorepo root in PowerShell. This is a runtime prototype;
physical iPad acceptance is a separate gate. The generated browser app executes
Julia in WebAssembly and does not contact a computation server.

The current default app build uses the modified, source-built SubsetJuliaVM
**0.11.1** package in `basis/vendor/subset-julia/pkg`, selected by
`basis/runtime-lock.json`. This candidate passed all 29 compatibility probes,
plus fresh-state and cancellation checks. Its WASM SHA-256 is
`b9c7256c6d94e6a0529205d9d8e9774ea898b8d4d95ede37eff102c828f35548`.
The 36.5 MiB WASM is packaged with its source patch and dependency notices.
The generated `dist/provenance.json` records each app build and all asset hashes.
Browser and physical-device checks remain distinct acceptance
gates; the lock identifies the selected artifacts, not completion of those gates.

## Toolchain

Building the browser app from a fresh checkout needs Node and `npm ci` only.
GitHub Pages uses Node 22, the committed runtime lock, and vendored runtime
bytes. The Rust tools below are needed only when rebuilding the interpreter.

The current workspace has project-local tools under `basis/.tools/`, excluded from Git:

- Rust 1.95.0, MSVC host and `wasm32-unknown-unknown` target.
- wasm-pack 0.15.0 and wasm-bindgen 0.2.122 (the Cargo.lock version).
- Node 24.19.0. The app builder uses esbuild to bundle CodeMirror and Pluto's
  Julia grammar; versions are pinned in `basis/package-lock.json`. The local
  server uses only Node built-ins.
- Playwright 1.58.2 for the browser gate, using the installed Chrome executable.

MSVC Build Tools are required for the Windows native build. Standard Julia 1.12.1
is used as a numerical oracle; it is not part of the app or required on the iPad.
`basis/scripts/rust-env.ps1` selects the isolated Rust installations,
`WASM_PACK_CACHE=basis/.tools/wasm-pack-cache`, and two build jobs
to keep memory use manageable. Cargo dependencies must already have been fetched
with the locked manifest; subsequent compilation uses `--locked --offline`.
The host compiler and wrapper crates use optimization level 1 to reduce rebuild
time; the native VM core retains level 3. The host executable is a validation and
cache-generation tool, not a benchmark build.
Those two frequently changed host crates, and the development WASM profile,
retain incremental compilation data for later source edits. `-Jobs 1` through
`-Jobs 4` overrides the build script's default of two Cargo jobs.

## Build

```powershell
powershell -File basis/scripts/build-runtime.ps1 -Stage All
```

Stages can be repeated separately: `Native`, `Cache`, and `Wasm`. After changing
runtime source, rebuild Native and regenerate both caches before building WASM.
Outputs live under `basis/runtime-build/`; no upstream binary is overwritten.

The default WASM build uses the `release-fast` profile with optimization level 1,
no debug information, and no LTO for iteration on this machine. For an optimized
size build, pass `-WasmProfile web-release`; that enables the upstream size/LTO
profile. Both skip the optional wasm-opt pass. Changing profiles or binaries
requires repeating acceptance; a successful earlier binary does not certify a
later one. `runtime-provenance.json` records the build inputs and exact WASM hash.

```powershell
npm --prefix basis ci
node basis/build.mjs
node basis/serve.mjs
```

Plain `node basis/build.mjs` verifies the lock's package version and WASM,
JavaScript-glue, and source-provenance hashes before replacing `dist/`. Changed or
missing locked artifacts fail the build without falling back. Only when the lock
is absent does the builder select the pinned 0.12.2 playground baseline, which
has the known rectangular-solve gap. Reproducing the modified 0.11.1 build does
not reproduce that newer binary.

The editor is compiled into a local `editor.js` and included in the hashed
offline pack. It needs no CDN connection. Build provenance lists the editor's
bundled dependencies; `EDITOR-LICENSES.txt` retains their MIT notices. The local
server permits inline styles because CodeMirror injects its layout CSS; scripts
remain restricted to local files and WebAssembly compilation. A hosted server
with its own CSP must also permit those editor styles.

To package a rebuilt candidate for validation before intentionally updating its
lock, use the explicit override:

```powershell
node basis/build.mjs --runtime-dir basis/runtime-build/pkg --notices-dir basis/upstream/julia-vm-oss
```

The override still checks the candidate's recorded WASM and tracked-patch hashes.
Repeat the relevant numerical and browser checks for changed binaries; a new
build can also change the exact provenance record pinned by the lock.

The local server serves static assets at `http://127.0.0.1:4174`. For an iPad,
serve `dist/` from a trusted HTTPS origin, install the app, wait for its complete
offline-pack and execution checks, then test newly written code in airplane mode.
Plain LAN HTTP does not enable service workers. `.github/workflows/pages.yml`
builds and tests Basis and publishes `dist/` at
`https://davidislip.github.io/IOS-Shortcut/basis/` alongside cppad.

After a runtime source change, validate the rebuilt package before vendoring it.
`node basis/scripts/package-runtime.mjs` copies the accepted package and local
dependency notices into `vendor/subset-julia/`; update the lock only for the
validated candidate. See the vendor README for the exact input hashes and source.

If an old cached design persists, open `http://127.0.0.1:4174/update.html` while
connected. This dedicated route reaches the service-worker update path without
depending on the older app's update controls. It waits for a full pack and
activation, preserves local storage, and opens the app after its new worker
controls the page. A failed download leaves the existing offline pack intact.

## Verification

The acceptance runner lives at
`basis/upstream/subset_julia/basis-probes/run.mjs`. Its README describes filtering and
deadlines. Always supply `--wasm-dir basis/runtime-build/pkg` when checking a
candidate from the repository root, and pass the installed standard Julia path.
Keep the resulting JSON under `basis/reports/`.

```powershell
. ./basis/scripts/rust-env.ps1
node basis/scripts/native-check.mjs basis/runtime-build/target/release-fast/sjulia.exe
node --test basis/app/tests/*.test.mjs
node basis/scripts/browser-check.mjs --rectangular
node basis/scripts/browser-check.mjs --rectangular --editor
node basis/scripts/browser-check.mjs --rectangular --editor --workbench
```

The browser command expects the local server to be running. It checks offline
reload and execution, matrix row/column display, cancellation/recovery, draft
restoration after closing a tab, source export, and tablet-width layout. It saves JSON and a
screenshot under `basis/reports/`, and also restarts Chrome to check a cold offline
start. Desktop Chrome is not physical iPad/Safari evidence.

The `--editor` variant additionally checks offline syntax colors, nested block
comments, adjoints versus character literals, Unicode, indentation, undo/redo,
keyboard Run, and keyboard escape from the editor. It saves separate
`browser-check-editor.json` and `browser-lab-editor.png` files. Source export
checks include Unicode and a trailing newline; responsive checks include 390px.

Add `--workbench` to check dark/light contrast, theme and draft persistence
offline, undo across theme changes, responsive tabs, contained editor scrolling,
and settings access. This writes `browser-check-workbench.json` separately and
captures dark/light landscape, portrait, and mobile screenshots. See
[workbench validation](reports/WORKBENCH.md) for the current results.

An optional second engine uses Playwright WebKit installed under
`basis/.tools/playwright-browsers`:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Resolve-Path basis) '.tools/playwright-browsers'
node basis/scripts/browser-check.mjs --rectangular --webkit
```

Its results use the `-webkit` report/screenshot suffix. This is Windows WebKit,
not Apple's Safari build or iPadOS, and cannot establish device performance.
The test uses a short temporary profile and runs WebKit with that profile as its
working directory to contain its additional relative storage folders. On this
Windows host, the offline gate remains unresolved: even a tiny standalone
CacheStorage round trip fails. The runtime itself executes the learner-function
diagnostic. Details and preserved retries are in
[candidate acceptance](reports/RUNTIME-CANDIDATE.md).

## Preserve and restore local fork changes

```powershell
node basis/scripts/snapshot-forks.mjs
```

The two independent upstream checkouts are ignored by the parent repository.
This command saves their tracked diffs and allowed new source/test files under
`patches/`. Each snapshot contains the upstream URL, base revision, hashes, and
restoration instructions. This does not commit, push, publish, or create an
upstream issue or pull request.

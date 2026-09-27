# Basis offline runtime proof

This is the editable Julia workspace that will support the learning app. It is not the six-lesson curriculum. It runs the selected local WASM in one disposable worker, uses no external editor/font/CDN requests, and never executes returned graph artifacts.

From `basis/`:

```powershell
npm ci
npm run build
npm test
npm run serve
```

Open `http://127.0.0.1:4174`. The builder bundles CodeMirror and Pluto's Julia grammar with esbuild; dependencies are pinned in the package lock. The local server uses only Node built-ins. Plain `npm run build` currently selects the source-built SubsetJuliaVM **0.11.1** candidate in `basis/vendor/subset-julia/pkg`, pinned by [runtime-lock.json](../runtime-lock.json). Its 36.5 MiB WASM has passed 29/29 compatibility probes plus fresh-state and cancellation checks; browser and physical-iPad acceptance remain separate gates. See [BUILDING.md](../BUILDING.md) for its exact hash and rebuild instructions. Generated `dist/` is not source and should not be committed.

Only when no lock exists does the builder use the previously inspected 0.12.2 playground package, verifying its version and WASM hash. That comparison baseline has the known rectangular-solve gap. A missing or changed locked candidate causes a build failure rather than a fallback.

`npm test` checks Stop/restart isolation, deadlines, typed values and column-major display, cache recovery after an interrupted update, and the actual built browser worker running new source with all non-file fetches prohibited. Its service-worker test models CacheStorage in Node; it is not a replacement for browser or iPad offline tests. Build first so the worker test checks the selected runtime.

Select a source-built package explicitly:

```powershell
node build.mjs --runtime-dir path\to\pkg --notices-dir path\to\julia-vm-oss
```

The package must contain wasm-bindgen web glue named `subset_julia_vm_web.js`, its matching `subset_julia_vm_web_bg.wasm`, and `package.json`. The source root must contain `LICENSE` and `THIRD_PARTY_NOTICES`. Build provenance records package version, exact WASM SHA-256, and per-asset hashes. If the package includes `runtime-provenance.json`, the build imports its explicit source metadata and requires its `wasmSHA256` to match the selected binary. A recorded `trackedPatchSHA256` must also match the bundled `runtime-source.patch`. These checks happen before replacing `dist/`. Without that record, a custom package's source build remains unknown; its parent repository is never mistaken for the runtime source. The playground distribution checkout and license-notice source are labeled separately when the old baseline is selected. Building the modified 0.11.1 source does not reproduce the newer 0.12.2 binary.

The lock uses `schemaVersion: 1`, project-relative `runtimeDir` and `noticesDir`, the exact package `version`, and SHA-256 strings `wasmSHA256` and `provenanceSHA256`. The latter pins the exact `runtime-provenance.json` bytes, including its source revision and build settings. Optional `glueSHA256` also pins the JavaScript glue; the current lock includes it. Missing files, changed hashes, a changed version, or a malformed lock cause the build to fail; it never silently falls back to the old runtime. An explicit `--runtime-dir` intentionally overrides the lock for comparisons and candidate validation. Repeat the relevant checks before changing the lock. The lock identifies selected artifacts and does not establish browser or device acceptance by itself.

`node --test --test-concurrency=1 app/tests/runtime-lock.test.mjs` runs small fixture-based lock/provenance checks without loading a runtime, compiling code, or opening a browser.

The worker runs a `1 + 1` self-check before accepting source. Every run uses the runtime's fresh execution entry point. Stop or the selected deadline terminates the worker and initializes a replacement. Generation and run IDs reject late results. Output and structured values are limited for display, with a visible truncation marker. No runtime result is inferred from printed text. Arrays display in Julia's column-major order.

The CodeMirror editor provides Julia syntax highlighting, line numbers, bracket matching, four-space indentation, and undo/redo. Its grammar recognizes Julia adjoints, character literals, Unicode, and nested block comments. All editor code and license notices ship in the offline pack. Syntax highlighting does not expand the runtime's supported Julia subset.

The app defaults to cppad's dark palette and compact full-height workspace. A toolbar toggle switches to light mode; `basis.theme.v1` stores that preference independently of the draft. The local `theme.js` runs before styles are loaded to apply the saved theme at first paint. Theme changes update CSS variables without recreating the editor or discarding undo. Above 899px, Code and Results share the screen; below that, bottom buttons select one pane. Run reveals Results. Both panes remain mounted, preserving code and result content. The app follows `visualViewport.height` to leave room for software keyboards; physical iPad behavior still needs validation. Runtime identity, installation help, and the run time limit live in **About & settings**.

The editor saves to versioned local storage on every edit, retains its draft across app updates, and exports a normal `.jl` file. A storage failure appears beside the editor. Results retain the source snapshot for stale-result warnings. Use Ctrl/Command + Enter to run, Tab/Shift + Tab to indent/unindent, and Escape then Tab to move focus out of the editor. Large allocation or runaway code can still exhaust an individual device's resources before Stop is pressed; test real target hardware.

The service worker installs the entire local asset list in a content-addressed cache. A failed new download removes only its incomplete cache. A new complete version waits until the user loads it or closes old clients; it never silently reloads an editing session. Old complete caches are retained because another open tab may still use them. Offline readiness requires both all cached assets and successful runtime execution. Browser-cleared storage will require downloading again.

For physical iPad testing, serve `dist/` from a trusted HTTPS origin (plain LAN HTTP cannot install a service worker). The Pages workflow publishes the lab at https://davidislip.github.io/IOS-Shortcut/basis/. Verify Safari and Home Screen startup in airplane mode, newly written functions, Stop/restart, preserved drafts, keyboard/touch editing, and updates. Desktop/Node checks do not establish those device results.

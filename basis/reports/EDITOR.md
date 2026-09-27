# Julia syntax editor validation

Build `848aa0d4108161b9` adds locally bundled CodeMirror 6 with Pluto's Julia
grammar. The offline pack contains 139 assets, including `editor.js` (610,405
bytes) and MIT dependency notices. The locked SubsetJuliaVM 0.11.1 runtime and
its WASM hash are unchanged.

Validation on September 26, 2026:

- `node --test basis/app/tests/*.test.mjs`: 10/10 passed, including execution
  through the built worker, cancellation, and offline-cache update recovery.
- `node basis/scripts/browser-check.mjs --rectangular --editor`: 12/12 passed
  in installed Chrome 153.0.8010.50. See [machine-readable results](browser-check-editor.json).
- Checked syntax colors offline, `A'` versus `'x'`, nested block comments,
  Unicode, Tab/Shift+Tab, undo/redo, Ctrl+Enter, and Escape then Tab to leave
  the editor. Draft restoration survived a cold offline browser restart.
- Export retained exact Unicode source and a trailing newline. Layout checks
  passed at widths of 1024, 768, and 390 pixels. The final
  [screenshot](browser-lab-editor.png) was visually inspected.

To see the update, refresh the local app and choose **Load downloaded update**
if offered. Existing drafts use the same local-storage key.

These are desktop Chrome results. Physical iPad editing and Safari offline
acceptance remain untested; the Windows WebKit cache limitation recorded in
[runtime acceptance](RUNTIME-CANDIDATE.md) remains open. Highlighting recognizes
Julia syntax independently of the runtime's supported language subset.

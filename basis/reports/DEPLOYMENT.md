# Basis deployment handoff

Published on 2026-09-27 at [Basis](https://davidislip.github.io/IOS-Shortcut/basis/).

- Commit: [1fb714fde52076a9792e794a6781adf455b73033](https://github.com/davidislip/IOS-Shortcut/commit/1fb714fde52076a9792e794a6781adf455b73033).
- GitHub Pages workflow: [36336445874](https://github.com/davidislip/IOS-Shortcut/actions/runs/36336445874), successful.
- Publication checkout: `basis/.tools/publish-checkout` (isolated from the original working branch).
- Validation: all 10 app tests passed; Pages deployment passed; the final build contains 27 offline assets.
- Live build: `6cb7c7f41dbd38b7`, matching published commit `1fb714fde52076a9792e794a6781adf455b73033`.
- Live Chromium browser checks: **16/16 passed**, covering offline cold restart, newly written Julia and least-squares execution, draft persistence, syntax highlighting, editor behavior, theme, and responsive layouts. Report: [browser-check-live.json](browser-check-live.json).
- Public regression checks passed: `/cppad/` returned HTTP 200 with title `cppad`; `/basis/update.html` returned HTTP 200 with title `Update Basis`; the WASM HEAD request returned HTTP 200 with `application/wasm`.
- Physical iPad acceptance remains pending; desktop browser results do not establish device acceptance.

The six owned Basis deployment files were compared with the isolated publishing checkout. Expected deployment changes were synchronized back to the original workspace; the packaging helper was already identical. No Git operations or rebuilds were performed for this handoff, and no cppad files were changed.

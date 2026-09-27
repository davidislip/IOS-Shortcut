# Basis workspace appearance

Build `9a323653ffb7a0cb` adopts cppad's dark palette, compact toolbar, pane headers,
green Run button, and darker result surface. The editor occupies the available
height. Light mode is optional and saved on the device. Narrow screens have
Code / Results buttons; Run opens Results. Settings and runtime information live
in the bottom bar. The Julia runtime binary is unchanged.

The offline pack now has 141 assets, including local theme and layout code.
There are no new dependencies or external requests for the appearance changes.

Validation on September 27, 2026:

- Build completed with locked SubsetJuliaVM 0.11.1.
- All 10 app tests passed, including the built worker executing Julia.
- All 16 checks passed with `node basis/scripts/browser-check.mjs --rectangular --editor --workbench`.
  See [browser results](browser-check-workbench.json).
- Both themes met a 4.5:1 contrast threshold for tested editor text, keywords,
  comments, strings, and literals against the editor background. Changing the
  theme preserved the editor element, source, and undo history.
- The light preference and saved draft survived an offline reload. The broader
  browser checks cover cold offline startup, execution, Stop/recovery, syntax
  highlighting, source export, and draft restoration.
- At 768px and 390px, pane switching and automatic Results display worked.
  A 100-line draft scrolled inside the editor at a 390 × 400 viewport while Run
  and the bottom tabs stayed accessible. Settings opened and closed with Escape.
- Inspected [dark landscape](workbench-dark-landscape.png),
  [light landscape](workbench-light-landscape.png), and [mobile](workbench-mobile.png)
  screenshots. A [portrait capture](workbench-portrait.png) is also available.

The checks use desktop Chrome with resized viewports. They do not establish
physical iPad, touch keyboard, or Safari offline acceptance.

Next product steps:

1. Make an HTTPS preview available for actual iPad testing, then verify new Julia
   code, draft recovery, Stop, and theme switching in airplane mode.
2. Build the scoped solving-as-reconstruction lesson: a manipulable diagram of
   the columns of A and target b, prediction, editable Julia using `A \ b`,
   residual checks, and a saved reflection.
3. Use that complete lesson to establish the pattern for the remaining five.

Publishing and lesson implementation are future work. To see this local update,
refresh `http://127.0.0.1:4174` and use **Load downloaded update** when offered.

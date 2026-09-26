# cppad: learn C++ on an iPad, offline

A self-contained C++ learning app for the subway:

- **Lessons**: Markdown tutorials, each ending in a small exercise with an automatic output check. New lessons are written by Claude from your textbook whenever you ask, and verified by compiling and running them before they're published.
- **Editor**: CodeMirror with C++ highlighting and a row of symbol keys (`{ } ; < > :: <<` …) so you don't have to hunt through the iPad keyboard.
- **Terminal**: a simulated shell (`run`, `check`, `g++ -O2 main.cpp`, `./main`, `cat`, `flags`, `help` …) with coloured compiler errors you can tap to jump to the line, interactive `std::cin`, and a Stop button for infinite loops.
- **A real compiler on the device**: Clang/LLVM 22 compiled to WebAssembly ([YoWASP](https://yowasp.org/)) builds your code to WebAssembly and runs it locally. After the one-time download (≈27 MB), nothing needs the network.

It's a web app (PWA). Add it to your Home Screen and it opens full-screen like a native app, and it works in airplane mode.

## Setup (one time)

1. **Enable GitHub Pages**: repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
   (Pages on a private repository needs a paid GitHub plan; otherwise make the repo public.)
2. **Merge to `main`**. The *Pages* workflow builds the site and publishes it to
   `https://davidislip.github.io/IOS-Shortcut/cppad/`.
3. **On the iPad** (on Wi-Fi): open that URL in Safari, then tap **Share → Add to Home Screen**. Open the app from the Home Screen, open the ☰ menu and tap **Download compiler**. Once it says *Compiler ready · offline*, you're set for the subway.

## New lessons

Lessons are added on demand, no API key needed. Open a Claude Code session on this repo (claude.ai/code, or the
Claude app) and say, for example:

> add 2 lessons from the textbook

Claude follows the [`cppad-add-lessons`](../.claude/skills/cppad-add-lessons/SKILL.md) skill: it reads the next
pages of your textbook (or the next topic in [`lessons/CURRICULUM.md`](lessons/CURRICULUM.md) if there's no book),
writes the lessons for a complete beginner, checks that every program compiles and that each solution prints exactly
the expected output, and commits them. Once they're on `main`, the *Pages* workflow redeploys, and the app picks them
up the next time it's online and marks them **new**.

You can also ask for a specific topic ("add a lesson on std::map"), a different number of lessons, or changes to an
existing lesson.

### Using your textbook

Put one C++ textbook (`.pdf`, `.md` or `.txt`) in [`textbook/`](textbook/). Lessons work through it from page 1:
each lesson teaches the next section, skips things that don't apply here (preface, installing a compiler, IDE setup),
and records the pages it covered in `source_pages`, so the next lesson picks up where it left off. Each lesson shows
"📖 Textbook pages 45–52" so you can read along. Claude writes its own explanations and exercises rather than copying the book.

`npm run next-pages` shows where you are in the book and extracts the next pages to `textbook/.next-pages.txt`.

**If the repo is public, a book committed here is public too.** See [`textbook/README.md`](textbook/README.md) for
keeping it elsewhere.

### Lesson format

````markdown
---
id: 9
title: std::map and counting words
concept: std::map, operator[], structured bindings
minutes: 12
---
# Title

Teaching text and examples…

```cpp starter      ← loaded into the editor
```cpp solution     ← hidden behind "Show solution"
```expected         ← exact output the Check compares against
```stdin            ← optional sample input for the Check
````

## Toolchain limits

- **No exceptions.** The bundled libc++ is built without exception support, so `throw`/`try`/`catch` won't compile. Lessons use `std::optional` or `std::expected` instead.
- No threads, files or networking: just stdin, stdout and stderr.
- The first build after launching the app takes a few seconds while the compiler starts up. Later builds take about 1–3 s.

## Developing

All commands run from this `cppad/` folder.

```sh
npm install
npm run build          # -> dist/
npm run serve          # http://localhost:8080
npm run check-lessons  # compile + run every lesson with the same toolchain
npm run next-pages     # where the lessons are in the textbook; extracts the next pages
```

Layout:

| Path | What |
|---|---|
| `src/main.js` | app wiring: lessons, build/run pipeline, terminal commands |
| `src/compiler-worker.js` | runs Clang in a Web Worker |
| `src/runner-worker.js` | runs your program (WASI) in a Web Worker; blocking stdin via `SharedArrayBuffer` |
| `src/terminal.js`, `src/editor.js` | terminal emulator, CodeMirror setup + key row |
| `src/sw.js` | service worker: offline caching and the COOP/COEP headers that `SharedArrayBuffer` needs (GitHub Pages can't set headers) |
| `scripts/` | lesson checker, textbook page extraction, local dev server |
| `lessons/` | the lessons and the curriculum roadmap |

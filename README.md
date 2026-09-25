# cppad: learn C++ on an iPad, offline

A self-contained C++ learning app for the subway:

- **Lessons**: Markdown tutorials, each ending in a small exercise with an automatic output check. New lessons are written by Claude on a schedule and verified by compiling and running them before they're published.
- **Editor**: CodeMirror with C++ highlighting and a row of symbol keys (`{ } ; < > :: <<` …) so you don't have to hunt through the iPad keyboard.
- **Terminal**: a simulated shell (`run`, `check`, `g++ -O2 main.cpp`, `./main`, `cat`, `flags`, `help` …) with coloured compiler errors you can tap to jump to the line, interactive `std::cin`, and a Stop button for infinite loops.
- **A real compiler on the device**: Clang/LLVM 22 compiled to WebAssembly ([YoWASP](https://yowasp.org/)) builds your code to WebAssembly and runs it locally. After the one-time download (≈27 MB), nothing needs the network.

It's a web app (PWA). Add it to your Home Screen and it opens full-screen like a native app, and it works in airplane mode.

## Setup (one time)

1. **Enable GitHub Pages**: repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
   (Pages on a private repository needs a paid GitHub plan; otherwise make the repo public.)
2. **Merge to `main`**. The *Deploy app* workflow builds the site and publishes it to
   `https://<user>.github.io/<repo>/`.
3. **On the iPad** (on Wi-Fi): open that URL in Safari, then tap **Share → Add to Home Screen**. Open the app from the Home Screen, open the ☰ menu and tap **Download compiler**. Once it says *Compiler ready · offline*, you're set for the subway.
4. **For AI-generated lessons**: add a repository secret `ANTHROPIC_API_KEY`
   (**Settings → Secrets and variables → Actions → New repository secret**).

## New lessons

`.github/workflows/generate-lesson.yml` runs twice a week (Mondays and Thursdays). It:

1. picks the next topic: the **next section of your textbook** if there is one (see below), otherwise the next topic in [`lessons/CURRICULUM.md`](lessons/CURRICULUM.md),
2. has Claude write the lesson for a complete beginner, one idea at a time,
3. compiles every full program in the lesson and checks that the solution prints exactly the expected output, sending any failures back to Claude to fix,
4. commits the lesson to `main` and redeploys.

The app picks up new lessons the next time it's online and marks them **new**.

To request a specific topic now, go to **Actions → Generate lesson → Run workflow** (this works from the GitHub iPhone/iPad app too) and type a topic.

### Using your textbook

Put one C++ textbook (`.pdf`, `.md` or `.txt`) in [`textbook/`](textbook/). The generator works through it from page 1:
each lesson teaches the next section, skips things that don't apply here (preface, installing a compiler, IDE setup),
and records the pages it covered in `source_pages`, so the next lesson picks up where it left off. Each lesson shows
"📖 Textbook pages 45–52" so you can read along. Claude writes its own explanations and exercises rather than copying the book.

**If the repo is public, a book committed here is public too.** Keep it private by hosting the file elsewhere and adding its
download URL as an Actions secret named `TEXTBOOK_URL`. Details in [`textbook/README.md`](textbook/README.md).

To preview what Claude would be given for the next lesson without calling the API: `DRY_RUN=1 npm run generate-lesson`.

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

```sh
npm install
npm run build          # -> dist/
npm run serve          # http://localhost:8080
npm run check-lessons  # compile + run every lesson with the same toolchain
DRY_RUN=1 npm run generate-lesson                        # show the prompt for the next lesson
ANTHROPIC_API_KEY=... npm run generate-lesson             # write the next lesson
TOPIC="std::variant" ANTHROPIC_API_KEY=... npm run generate-lesson
```

Layout:

| Path | What |
|---|---|
| `src/main.js` | app wiring: lessons, build/run pipeline, terminal commands |
| `src/compiler-worker.js` | runs Clang in a Web Worker |
| `src/runner-worker.js` | runs your program (WASI) in a Web Worker; blocking stdin via `SharedArrayBuffer` |
| `src/terminal.js`, `src/editor.js` | terminal emulator, CodeMirror setup + key row |
| `src/sw.js` | service worker: offline caching and the COOP/COEP headers that `SharedArrayBuffer` needs (GitHub Pages can't set headers) |
| `scripts/` | lesson checker and generator, local dev server |
| `lessons/` | the lessons and the curriculum roadmap |

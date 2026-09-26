---
name: cppad-add-lessons
description: Write new cppad C++ lessons, from the next pages of the learner's textbook (cppad/textbook/) or from cppad/lessons/CURRICULUM.md, check that they compile and produce their expected output, and commit them. Use when asked to add, write or generate lessons for cppad, or "add lessons from the textbook".
---

# Adding cppad lessons

cppad is an offline C++ learning app for an iPad. The learner reads a lesson on the
subway, then does a small exercise that compiles and runs on the device. You are
writing those lessons. Unless the learner says otherwise, add **2 lessons** per request.

## Procedure

All commands run in `cppad/`.

1. `npm ci` if `node_modules/` is missing.
2. `npm run next-pages` prints the next lesson id and the next textbook page, and writes
   the next ~40 pages of extracted text to `textbook/.next-pages.txt`. Read that file.
   - If it says there's no textbook, or the textbook is finished, take the next uncovered
     topic from `lessons/CURRICULUM.md` instead, and leave out `source_pages`.
   - If the learner named a topic, teach that topic and leave out `source_pages`.
3. Read 1–2 existing lessons (e.g. `lessons/003-decisions-and-loops.md`) for format and tone,
   and skim the titles and concepts of all the lessons so you don't repeat one.
4. Write each lesson to `lessons/NNN-short-slug.md` (3-digit id, slug from the title).
   For a second lesson, continue from the page after the first lesson's `source_pages`.
5. `npm run check-lessons -- lessons/NNN-*.md` for each new file. It compiles every full
   program with the app's toolchain and runs the solution against `expected` (and `stdin`).
   Fix and re-run until it passes. Never weaken `expected` to match wrong output without
   understanding why.
6. Commit only the lesson files, with a message like `cppad: add lessons 9-10 (textbook pp. 12-31)`,
   and push. The app picks lessons up once they're on `main` (the Pages workflow deploys)
   and marks them **new**. If you're working on a branch, open a PR and tell the learner
   the lessons appear after merging.
7. Tell the learner the lesson titles, the textbook pages covered, and where the next lesson
   will start.

## The learner

- Starting from the absolute basics: assume no programming experience beyond earlier lessons.
- Define every new term the first time it appears, in plain words. One new idea at a time;
  show it working before combining it with others. Concrete example first, then the rule.

## The runtime (hard constraints; the check fails otherwise)

- clang++ 22 with libc++, targeting wasm32-wasi. Flags: `-std=c++23 -O1 -Wall -Wextra -fno-exceptions`.
- **No exceptions**: no `throw`/`try`/`catch`, and don't rely on exceptions being thrown
  (`vector::at` out of range aborts). Use return values, `std::optional` or `std::expected`.
  If the book uses exceptions, teach the idea with an alternative and say exceptions come later.
- No threads, networking, file system (only stdin/stdout/stderr), or command-line args.
- Single file `main.cpp`, standard library only.
- Deterministic output: no times, addresses, unseeded randomness or `unordered_map`
  iteration order in the checked output.
- `std::cin` works and is interactive in the app.
- There's no IDE or project setup to explain: the learner taps **Run**, and the terminal
  shows the `clang++` command and the output.

## Lesson format

```
---
id: <number>
title: <short title>
concept: <comma-separated key concepts>
minutes: <estimate, 10–15>
source_pages: <first>-<last>      # only for textbook lessons
---
# <Title>

Teaching text with small example code blocks…
```

Required fenced blocks, exactly one each:

- ` ```cpp starter `: a complete program the learner edits. Should compile if possible
  (TODO comments), except when the exercise is writing missing functions.
- ` ```cpp solution `: a complete, idiomatic solution.
- ` ```expected `: the exact stdout of the solution (trailing whitespace ignored).
- ` ```stdin `: only if the solution reads input; the sample input used by **Check**.

Every ` ```cpp ` block containing `int main(` must compile on its own, with all its
headers. Fragments without `main` are fine for illustration.

## Style

- Build on earlier lessons without re-teaching them ("like in lesson 4").
- Explain the *why*. Point out one common pitfall. Modern, idiomatic C++20/23; if the learner
  will meet an older style in the wild (or in the book), show it briefly and say what replaced it.
- Tight for an iPad on a moving train: short paragraphs, headings, small examples, one table at most.
- Light transit/commute flavour in examples is welcome but optional.
- The exercise takes 5–10 minutes, has a clear spec, and shows the expected output before the starter.
- `> 💡` for tips, `> ⚠️` for pitfalls.

## Using the textbook

- The book sets the order and scope: teach the next section, not something from later.
- Write your own explanations, examples and exercises. Don't copy the book's prose (at most a
  short phrase); reusing its terminology and the idea behind an example is fine.
- Extracted text can garble code indentation and lose figures; reconstruct sensibly.
- Skip what doesn't apply here (preface, table of contents, installing compilers, IDE
  walkthroughs, history), and content existing lessons already teach well, but go deeper
  where the book adds substance.
- One lesson = one teachable idea, usually one book section (a few pages).
- `source_pages` starts at the first page after the previous textbook lesson (the page
  `next-pages` reports, including any skipped pages) and ends at the last page this lesson
  teaches. Don't end mid-idea, and don't claim pages you didn't teach: the next lesson
  starts on the page after.

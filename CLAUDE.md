# iOS projects monorepo

- `cppad/`: offline C++ learning app (PWA). Lessons are Markdown in `cppad/lessons/`.
  To add lessons (e.g. "add 2 lessons from the textbook"), use the `cppad-add-lessons` skill.
  After changing app code: `cd cppad && npm run build && npm run check-lessons`.
- `shortcuts/`: iOS Shortcuts.
- One GitHub Pages site for the repo, built by `.github/workflows/pages.yml` (cppad at `/cppad/`).

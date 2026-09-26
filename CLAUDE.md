# iOS projects monorepo

- `cppad/`: offline C++ learning app (PWA). Lessons are Markdown in `cppad/lessons/`.
  To add lessons (e.g. "add 2 lessons from the textbook"), use the `cppad-add-lessons` skill.
  After changing app code: `cd cppad && npm run build && npm run check-lessons`.
- `shortcuts/`: mobile LaTeX review toolkit (iOS Shortcuts + Working Copy capture PDF comments as
  `feedback/rev-*.md` items; `scripts/feedback.py` resolves them; Python stdlib only).
  Before changing it, read `shortcuts/AGENTS.md`; its paths and commands are relative to `shortcuts/`.
  Tests: `cd shortcuts && python -m unittest discover -s tests`.
- One GitHub Pages site for the repo, built by `.github/workflows/pages.yml` (cppad at `/cppad/`).

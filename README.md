# iOS projects

A monorepo of small projects for iPhone and iPad.

| Project | What | Live |
|---|---|---|
| [`basis/`](basis/) | Offline Julia lab for learning linear algebra, with syntax highlighting, dark mode, and local WebAssembly execution. | `https://davidislip.github.io/IOS-Shortcut/basis/` |
| [`cppad/`](cppad/) | Learn C++ offline on an iPad: lessons written by Claude from your textbook on request, an editor, and a terminal with a real compiler running on the device. | `https://davidislip.github.io/IOS-Shortcut/cppad/` |
| [`shortcuts/`](shortcuts/) | Review a LaTeX paper's PDF on an iPhone or iPad: iOS Shortcuts and Working Copy save each comment as a Markdown file in the paper's repo, and an AI agent (Claude Code / Codex) applies them on the desktop. | – |

## How it's wired

- Each project lives in its own folder with its own README; web projects also have a `package.json`.
- GitHub Actions workflows live in `.github/workflows/`, one set per project, filtered by path so
  a change to one project doesn't rebuild the others.
- GitHub Pages hosts one site per repo. `pages.yml` builds every web project into a subfolder of it
  (`/cppad/`, …) and adds a small index page at the root. To add a web project, add a build step there.

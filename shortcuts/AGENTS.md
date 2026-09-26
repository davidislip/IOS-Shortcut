# Instructions for coding agents (Claude Code, Codex, others)

This folder is a toolkit for reviewing a LaTeX paper's PDF on iPhone/iPad
(iOS Shortcuts + Working Copy), collecting the comments as one small Markdown
file per item under `feedback/`, and having an AI agent resolve them on the
desktop. The specification is `plan_mobile_ios_working_copy.md`; user-facing
documentation is in `docs/` (start with `docs/README.md`). It is the
`shortcuts/` folder of the iOS projects monorepo: paths and commands below
are relative to this folder, so run them from here.

## Layout

- `feedback/rev-*.md` — review items, one per file. Format:
  `docs/FEEDBACK_SCHEMA.md` (normative). A legacy single `feedback.md` is also
  read if present.
- `scripts/feedback.py` — stdlib-only CLI (`docs/CLI.md`): `validate`, `list`,
  `show`, `add`, `done`, `wontfix`, `reopen`, `locate`, `report`, `init`.
- `scripts/install_toolkit.py` — copies the toolkit into a paper repository.
- `prompts/address-feedback.md` — the workflow an agent follows to resolve OPEN
  items. `/address-feedback` runs it in Claude Code.
- `docs/shortcuts/*.md` — tap-by-tap build recipes for the iOS Shortcuts.
- `templates/` — the exact text blocks the shortcuts and the CLI emit.
- `examples/sample-paper/` — small compilable paper
  (`latexmk -pdf -jobname=paper main.tex` → `paper.pdf`) used by the tests,
  and as a demo: copy it into a repository of its own (`docs/INSTALL.md`) and
  clone that into Working Copy.
- `tests/` — `unittest` suite (`python -m unittest discover -s tests`).

## Resolving review feedback

When asked to "address the feedback", "process the review items" or similar,
follow `prompts/address-feedback.md` step by step. In short:

1. `python scripts/feedback.py validate`, then `list --status OPEN --full`,
   then `locate --all`.
2. For each OPEN item: find the passage (`**Source:**` is a hint — confirm it;
   else use `locate`), make the requested change, keep mathematical meaning
   unless told otherwise, compile.
3. `python scripts/feedback.py done <id> --resolution "<what changed, file:lines>"`.
4. Leave unlocatable items OPEN and report them.
5. Rebuild `paper.pdf`, then `python scripts/feedback.py report`.

Never hand-edit a reviewer's `**PDF text**` or `**Feedback**`; never delete,
rename or renumber item files; capture tools only ever create new files.

## Development rules

- Python 3.9+, standard library only, `encoding="utf-8"` on every `open()`,
  LF line endings, forward slashes in printed paths.
- On Windows without `python` on PATH use the interpreter's full path
  (e.g. `C:\Users\<you>\anaconda3\python.exe`).
- Any change to the item format must update, in this order:
  `docs/FEEDBACK_SCHEMA.md` → `templates/*.md` → `scripts/feedback.py` + tests
  → `docs/shortcuts/01-add-paper-feedback.md` (the Text action block).
- Shortcut recipes list actions in execution order with the exact parameter
  labels; keep them that way — the reader reproduces them tap by tap on a phone.

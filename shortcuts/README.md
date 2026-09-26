# Mobile LaTeX review — iOS Shortcuts + Working Copy

Review a LaTeX paper's PDF on an iPhone or iPad, capture comments without
leaving the reader, store them in the paper's git repository, and let an AI
agent (Claude Code / Codex) apply them on the desktop in one pass.

The reviewer's loop:

> **read → select → Share… → type feedback → Done → keep reading**

and, once per session, **Finish Paper Review** (commit · pull · push). On the
desktop: `git pull`, `/address-feedback`, review the diff, rebuild the PDF,
push. Git and the agent never interrupt the reading.

Each captured comment becomes one small Markdown file:

```md
## Review rev-20260825-101902

**PDF text**
> We therefore conclude that the estimator is consistent uniformly over the
> unit interval, which is the sufficient condition required for the affine

**Feedback**
Need to justify why this convergence is uniform.

**Status:** OPEN
```

## Quick start

**Desktop (once per paper)**

1. From a clone of this toolkit,
   `python scripts/install_toolkit.py /path/to/paper-repo` (your local clone
   of the paper) — copies the CLI, the agent prompt, `feedback/README.md`,
   and merges `.gitattributes` / `AGENTS.md` ([docs/INSTALL.md](docs/INSTALL.md)).
2. Build the PDF with `[T1]{fontenc}` + `lmodern` and **commit `paper.pdf`**
   ([docs/PDF_COPY_FIDELITY.md](docs/PDF_COPY_FIDELITY.md)).
3. `git commit && git push`.

**iPhone / iPad (once)**

4. Install Working Copy, add your Git host, clone the repository, enable the
   Files location ([docs/WORKING_COPY_SETUP.md](docs/WORKING_COPY_SETUP.md)).
5. Build **Add Paper Feedback** and **Finish Paper Review** tap by tap from
   [docs/shortcuts/](docs/shortcuts/README.md) (≈20 minutes; iOS cannot
   import unsigned shortcut files, so the recipes are the installer).
6. Run the five-minute [first-run checklist](docs/FIRST_RUN.md).

**Every review**

7. Open `paper.pdf` (Files › Working Copy › repo, or inside Working Copy).
   Select a sentence → **Share…** → **Add Paper Feedback** → type → **Done**.
   No Share on your reader? **Copy**, then run the shortcut via Back Tap /
   Action Button.
8. **Finish Paper Review**.
9. Desktop: `git pull`, `python scripts/feedback.py locate --all`,
   `/address-feedback` ([docs/AGENT_HANDOFF.md](docs/AGENT_HANDOFF.md)).
10. Rebuild `paper.pdf`, commit, push. The phone pulls it next time
    (**Start Paper Review**, or Working Copy › **Pull**).

## Requirements (short)

* iOS/iPadOS 17+, Working Copy 6.6.1+, **Working Copy Pro** (or trial) for
  push, Git-host credentials in Working Copy.
* Any PDF reader with text selection and Copy (Share of the selection is a
  bonus) — [docs/READERS.md](docs/READERS.md).
* Desktop: Python 3.9+ (stdlib only), git, LaTeX with `latexmk`, Claude Code
  or Codex. Full list: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md).

## Repository layout

```text
docs/                      user documentation (start at docs/README.md)
docs/shortcuts/            tap-by-tap recipes for the five shortcuts
scripts/feedback.py        desktop CLI: validate · list · add · done · locate · report
scripts/install_toolkit.py copies the toolkit into a paper repository
prompts/address-feedback.md the hand-off prompt the agent follows
.claude/commands/          /address-feedback for Claude Code
templates/                 the exact text blocks the shortcuts and CLI emit
feedback/                  review items live here (one file each)
examples/sample-paper/     a small compilable paper to rehearse the loop with
tests/                     unittest suites for the CLI and installer
plan_mobile_ios_working_copy.md   the specification and its change log
```

## Documentation

| Document | What it covers |
|---|---|
| [docs/README.md](docs/README.md) | Which document to read for which job |
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | Versions, Pro unlock, credentials, desktop tools |
| [docs/INSTALL.md](docs/INSTALL.md) | Installing into the paper repo, trying the sample first |
| [docs/WORKING_COPY_SETUP.md](docs/WORKING_COPY_SETUP.md) | Clone, Files location, Repository picker, Pro |
| [docs/shortcuts/README.md](docs/shortcuts/README.md) | How to read and build the recipes |
| [docs/shortcuts/01-add-paper-feedback.md](docs/shortcuts/01-add-paper-feedback.md) | The capture shortcut (required) |
| [docs/shortcuts/02-add-paper-todo.md](docs/shortcuts/02-add-paper-todo.md) | One-tap TODO variant |
| [docs/shortcuts/03-finish-paper-review.md](docs/shortcuts/03-finish-paper-review.md) | Commit · pull · push (required) |
| [docs/shortcuts/04-start-paper-review.md](docs/shortcuts/04-start-paper-review.md) | Pull and open the PDF |
| [docs/shortcuts/05-copy-agent-prompt.md](docs/shortcuts/05-copy-agent-prompt.md) | Copy the agent prompt on the phone |
| [docs/FIRST_RUN.md](docs/FIRST_RUN.md) | Permissions, launchers, first-capture test |
| [docs/READERS.md](docs/READERS.md) | PDF app compatibility table |
| [docs/AGENT_HANDOFF.md](docs/AGENT_HANDOFF.md) | Desktop side end to end |
| [docs/CLI.md](docs/CLI.md) | `scripts/feedback.py` reference and matching algorithm |
| [docs/FEEDBACK_SCHEMA.md](docs/FEEDBACK_SCHEMA.md) | Normative item format (v2) |
| [docs/PDF_COPY_FIDELITY.md](docs/PDF_COPY_FIDELITY.md) | LaTeX settings for clean copy/paste |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Symptom → cause → fix |
| [docs/APPENDIX_SINGLE_FILE.md](docs/APPENDIX_SINGLE_FILE.md) | Single `feedback.md` variant and its risks |
| [docs/APPENDIX_XCALLBACK.md](docs/APPENDIX_XCALLBACK.md) | URL-scheme route for older iOS |

## Design decisions

* **One file per item** (`feedback/rev-YYYYMMDD-HHmmss.md`). New files never
  conflict in git on any client, and the shortcut needs only Working Copy's
  default "create" write. The spec's single append-only `feedback.md` was
  dropped after `merge=union` was shown to corrupt it silently
  ([schema](docs/FEEDBACK_SCHEMA.md)); it is still read as a legacy container.
* **Stable timestamp IDs**, never renumbered; the ID is the heading, the file
  name, and the git history's key.
* **Reviewer text is immutable.** The agent changes `**Status:**` and adds a
  `**Resolution:**` line through the CLI — nothing else.
* **`**Source:**` is a hint.** Line numbers drift as edits land; the agent
  confirms the quote or falls back to `locate`, which normalises ligatures,
  line-break hyphenation and unreadable math glyphs.
* **No metadata prompts.** Only the comment is typed; timestamp comes from
  the clock, a device stamp is optional and off by default.

## Platform limitations

* Shortcuts cannot be shipped as files (iOS 15+ signing); build from the
  recipes, then share with **Copy iCloud Link**.
* **Push requires Working Copy Pro** (one-time purchase; 10-day trial).
* Working Copy's file actions need **iOS 17+**; older devices can use the
  URL-scheme appendix.
* Whether **Share…** appears on a text selection depends on the PDF app;
  Copy + a launcher (Back Tap, Action Button) always works.
* Repositories are unavailable while the device is locked; nothing runs on a
  timer.
* Math copied from a PDF is garbage in every reader; select prose.

## Tests

```text
python -m unittest discover -s tests -v      # 135 tests, standard library only
```

(`python -m pytest -q tests` works too.) The suites use temporary copies of
`examples/sample-paper/`; they never modify the repository.

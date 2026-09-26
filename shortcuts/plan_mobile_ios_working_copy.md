# Implementation Spec (v2): Mobile LaTeX Review — iOS Shortcuts + Working Copy

> **Status:** implemented. This file is the product and engineering
> specification; the deliverables it describes are in this folder
> (`README.md` is the front door, `docs/README.md` the reading guide).
> Section 15 lists what changed from the v1 draft and why.
>
> **Instructions for Claude Code / Codex (kept from v1)**
>
> - Treat this file as the specification. Inspect the repository before
>   deciding where supporting files belong.
> - Prefer a minimal, reliable workflow. Do not stop at high-level advice.
> - For iOS Shortcuts actions that cannot be installed programmatically,
>   document the exact actions in order, including variables, conditions and
>   Working Copy actions (`docs/shortcuts/`).
> - Desktop and mobile capture share one item schema (`docs/FEEDBACK_SCHEMA.md`).
> - Make reasonable assumptions where necessary and record them (section 14).

---

## 1. Goal

A mobile-first workflow for reviewing a LaTeX-generated PDF on iPhone or
iPad: read, select a passage, type a short comment in a native prompt, keep
reading. Comments are stored in the paper's git repository and later handed
to Claude/Codex, which addresses every open item in a single pass, compiles,
and reports.

The reviewer can:

1. Read `paper.pdf` in any iOS/iPadOS PDF reader (or inside Working Copy).
2. Select text and **Share…** it, or **Copy** it.
3. Run **Add Paper Feedback** (Share Sheet, Back Tap, Action Button, Control Center).
4. Type a comment in one small prompt (empty comment = `TODO: revise.`).
5. Have the selection and comment stored as a review item in the repository.
6. Continue reading immediately.
7. At the end, **Finish Paper Review**: commit, pull, push.
8. On the desktop, run `/address-feedback` (or paste the prompt into Codex).

## 2. Desired user experience

### Primary flow (Share Sheet, "Mode A")

1. Select a passage in the PDF.
2. Tap the ▸ arrow in the selection callout → **Share…** → **Add Paper Feedback**.
3. A prompt appears: **Feedback on: "We therefore conclude that the estim…"**
4. Type `Need to justify why this convergence is uniform.` → **Done**
   (Return submits; multiple lines are off).
5. A banner *Saved rev-20260825-101902* appears; you are back in the PDF.

### Clipboard flow ("Mode B")

Some readers (Acrobat, GoodReader, Books) expose no Share on a selection.
Then: select → **Copy** → launch the shortcut from Back Tap / Action Button /
Control Center / widget. The same shortcut serves both modes: its input action
is configured as *Receive Text from Share Sheet — if there's no input: Get
Clipboard*. The prompt previews the first 60 characters of the clipboard so a
stale clipboard is caught before anything is written.

### What the reviewer never does

Type metadata, pick files, confirm dialogs, run git.

## 3. Storage: one file per item

Every capture creates **one new file** `feedback/rev-YYYYMMDD-HHmmss.md`
(local device time; optional `-xx` suffix for same-second collisions):

```md
## Review rev-20260825-101902

**PDF text**
> We therefore conclude that the estimator is consistent uniformly over the
> unit interval, which is the sufficient condition required for the affine

**Feedback**
Need to justify why this convergence is uniform.

**Status:** OPEN
```

Optional lines directly under the heading (never prompted for):
`**Source:** \`sections/methodology.tex:183\`` (desktop tools only) and
`**Device:** iPad` (automatic; off by default because device names contain
the owner's name).

Why not one append-only `feedback.md` (the v1 design)?

* Two devices appending different items to the same file **conflict** in git.
* The obvious fix, `.gitattributes … merge=union`, was **tested and shown to
  corrupt this layout**: git (and libgit2, which Working Copy uses) folds the
  identical `**Status:** OPEN` tail every item ends with, so the first item
  loses its status line and runs into the next heading — with exit 0 and no
  conflict markers.
* Appending from Shortcuts needs Working Copy's append mode (6.6.1+, label
  undocumented) or a read-modify-write chain; creating a new file needs only
  the default safe write.
* Smart Punctuation has less to damage: no `---` separators.

Separate files never conflict on any client (Working Copy, git CLI, GitHub
web). The CLI still reads a legacy `feedback.md` (v1 layout with `**ID:**`
lines and `---`) so an existing desktop SyncTeX tool keeps working;
`docs/APPENDIX_SINGLE_FILE.md` documents the single-file variant and its risks.

The complete grammar, validation rules and parser tolerance are in
`docs/FEEDBACK_SCHEMA.md` (normative). `templates/review-item.md` is the
exact block the shortcut emits.

## 4. Repository layout (paper repository after install)

```text
paper-repo/
├── main.tex, sections/, figures/, references.bib
├── paper.pdf                       ← committed; the phone reads this
├── feedback/
│   ├── README.md                   ← keeps the folder in every clone
│   └── rev-20260825-101902.md      ← one item per file
├── scripts/feedback.py             ← desktop CLI (stdlib only)
├── prompts/address-feedback.md     ← agent hand-off prompt
├── .claude/commands/address-feedback.md
├── docs/FEEDBACK_SCHEMA.md, docs/CLI.md
├── AGENTS.md  (+ CLAUDE.md → @AGENTS.md)
└── .gitattributes                  ← feedback/*.md text eol=lf, *.pdf binary …
```

`scripts/install_toolkit.py <paper-repo>` creates exactly this (idempotent,
never clobbers, merges `.gitattributes`/`AGENTS.md`/`CLAUDE.md`).

## 5. Shortcut 1 — Add Paper Feedback (required)

Exact recipe: `docs/shortcuts/01-add-paper-feedback.md`. Action sequence:

| # | Action | Key settings |
|---|--------|--------------|
| 1 | Receive input from Share Sheet | types **Text, Rich text** only; *If there's no input:* **Get Clipboard** |
| 2 | Get Text from Input | → `Selection` |
| 3 | If `Selection` has no value / is blank | Show Notification "Nothing selected…" → Stop |
| 4 | Count Characters → If > 2000 | Show Notification "Selection too long…" → Stop |
| 5 | Replace Text `^\s+\|\s+$` → "" (regex) | → `Trimmed` |
| 6 | Replace Text `(?m)^` → `> ` (regex) | → `Quoted` (Markdown blockquote per line) |
| 7 | Replace Text `(?s)^(.{60}).+$` → `$1…` | → `Preview` (optional) |
| 8 | Ask for Input (Text) | prompt `Feedback on: [Preview]`; multiple lines **off**; Cancel = nothing written |
| 9 | If answer empty → Text `TODO: revise.` else Text `[Comment]` | → `Feedback` (If Result) |
| 10 | Date → Format Date, Custom `yyyyMMdd-HHmmss` | → `Stamp` |
| 11 | Text `rev-[Stamp]` | → `ID` |
| 12 | Text = **pasted** `templates/review-item.md` with `[ID]`, `[Quoted]`, `[Feedback]` | → `Item` |
| 13 | **Write Repository File** (Working Copy) | Repository = paper repo; Path `feedback/[ID].md`; content `[Item]`; overwrite **off** (safe mode creates, never clobbers; file is staged) |
| 14 | Show Notification | `Saved [ID]` (banner; returns to the PDF app) |

Design points: the prompt precedes every write so Cancel is side-effect free;
the block is pasted, never typed (Smart Punctuation); no sequential numbering
on mobile (stable IDs only); the shortcut runs entirely in the background —
Working Copy is not opened.

## 6. Shortcut 2 — Add Paper TODO (optional)

Duplicate of Shortcut 1 without the prompt: comment is always `TODO: revise.`
and the ID gets a `-NN` random suffix (`Random Number 10–99`) because two taps
within one second would otherwise collide (safe mode refuses the second file).
The empty-comment path of Shortcut 1 already produces TODO items with one
extra tap, so this is optional. `docs/shortcuts/02-add-paper-todo.md`.

## 7. Shortcut 3 — Finish Paper Review (required)

1. **Commit Repository** — message `Add paper review feedback`; *What to
   Commit* = modified; *Fail when nothing to Commit* = **off**.
2. **Pull Repository** — merges what the desktop pushed (resolved items,
   rebuilt `paper.pdf`); never conflicts on `feedback/`.
3. **Push Repository** — requires Working Copy **Pro** (or trial) and saved
   Git-host credentials.
4. **Show Notification** `Review feedback pushed`.

Failure modes and recovery are tabulated in `docs/shortcuts/03-finish-paper-review.md`.
No AI prompt is sent automatically.

## 8. Shortcut 4 — Start Paper Review (optional)

**Pull Repository** → notification → open `paper.pdf` (**Open in Working
Copy**, or from Files › Working Copy › repo in Preview / PDF Expert). Pulling
first matters because the desktop rebuilds `paper.pdf` after each agent pass.
`docs/shortcuts/04-start-paper-review.md`.

## 9. Shortcut 5 — Copy Agent Prompt (optional, Phase 4)

**Get Repository Files** `prompts/address-feedback.md` → Get Text → Copy to
Clipboard → notification. The prompt lives in the repository, so it is
versioned; on the desktop `/address-feedback` does the same thing.
`docs/shortcuts/05-copy-agent-prompt.md`.

## 10. Desktop CLI — `scripts/feedback.py`

Standard library only, Python 3.9+, UTF-8 everywhere, byte-preserving
rewrites. Reference: `docs/CLI.md`.

| Command | Purpose |
|---|---|
| `validate [--strict]` | schema check across `feedback/` and legacy `feedback.md`; exit 1 on errors |
| `list [--status OPEN\|DONE\|WONTFIX\|ALL] [--full]` | overview, or the raw blocks the agent reads |
| `show ID` | one item verbatim |
| `add --comment … [--text …\|--text-file\|--stdin] [--source path:line] [--device\|--no-device]` | desktop capture (same schema, `**Source:**` allowed) |
| `done ID --resolution …` / `wontfix ID --resolution …` / `reopen ID` | change only the `**Status:**` line and add a `**Resolution:**` line |
| `locate (ID… \| --text … \| --all)` | fuzzy-match quoted PDF text to `file:start-end`; verdict UNIQUE / AMBIGUOUS / NOT FOUND; confirms or flags drift of `**Source:**` |
| `report` | Markdown totals + table + "Still OPEN" list for the agent's final message |
| `init [--into DIR]` | create `feedback/README.md` |

`locate` normalises both sides (NFKC ligatures, quotes/dashes, line-break
hyphenation, whitespace, dropped punctuation and unreadable math glyphs,
single-character/number tokens removed), de-TeXes the sources (comments,
inline and display math, `\cite`/`\ref`/`\label`…, command names), then finds
exact token runs or scores sliding windows with `difflib` and suppresses
overlapping candidates. Tested against pdftotext garbage (`mesh ℎ2`),
hyphenated line breaks (`suffi-`/`cient`), ligature glyphs (`suﬃcient`) and
prose around inline math — all resolve UNIQUE on the sample paper.

## 11. Agent workflow after review

`prompts/address-feedback.md` (run by `/address-feedback` in Claude Code;
pasted into Codex otherwise; `AGENTS.md` carries the short form):

1. `git pull`; `feedback.py validate` (stop on failure); `list --status OPEN --full`; `locate --all`.
2. Per OPEN item, in ID order: find the passage (`**Source:**` is a hint —
   confirm it; else use `locate`); read the whole paragraph/theorem/proof;
   make the change; preserve mathematical meaning unless asked; `TODO:
   revise.` = clarity/precision/grammar of the quoted passage only; compile
   (`latexmk`) and fix errors you introduced; `feedback.py done <id>
   --resolution "what changed, file:lines"`.
3. Not uniquely locatable → leave OPEN, change nothing, report it.
4. Never edit reviewer text; never delete/rename/renumber items; WONTFIX only
   when the reviewer's comment says so.
5. Rebuild `paper.pdf`; `feedback.py report`; reply with completed count,
   still-open items with reasons, compilation status, changed files. Commit
   only if asked (`Address review feedback (N items)`).

## 12. Cross-device rules

* Desktop: pull before the agent runs, push when done (including `paper.pdf`).
* Phone: Start Paper Review pulls; Finish Paper Review commits → pulls → pushes.
* Items are separate files, so the phone can capture while the desktop
  resolves. The only file both sides could touch at once is an individual
  item (desktop marks DONE while… nothing on the phone edits items), so
  conflicts do not arise in practice.
* No `merge=union`, no custom merge drivers (libgit2 cannot run external
  drivers; unknown driver names silently fall back to the text driver).

## 13. Implementation phases → deliverables

| Phase | v1 intent | Delivered |
|---|---|---|
| 1 Minimal capture | Share Sheet, clipboard fallback, prompt, timestamp ID, append | Shortcut 01 recipe; per-item file; `templates/review-item.md`; schema v2 |
| 2 Git session | Start/Finish shortcuts, pull before, commit+push after | Shortcuts 03, 04; failure tables; `.gitattributes` |
| 3 Metadata | only what is automatic | `**Source:**` (desktop), optional `**Device:**` (model); `Reviewed on` dropped — the ID carries the time; page/category/priority dropped (not capturable from a text share) |
| 4 Agent hand-off | optional prompt to clipboard | Shortcut 05; `prompts/address-feedback.md`; `/address-feedback`; `AGENTS.md`/`CLAUDE.md` |
| — Desktop tooling | (implied) | `scripts/feedback.py` + 65 tests; `scripts/install_toolkit.py`; `examples/sample-paper` |
| — Documentation | recipes, setup, limitations | `docs/` (requirements, install, Working Copy, first run, readers, troubleshooting, PDF fidelity, hand-off, appendices) |

## 14. Assumptions and items to verify on device

Verified from vendor documentation and local tests: Working Copy action
names and parameters, Pro scope, Files-location behaviour; Shortcuts input
options, `Ask for Input` options, custom date format, ICU regex flags, no-tap
notifications, Share-Sheet return behaviour, signing requirement; PDFKit
selection text keeps line breaks; ligature handling of modern LaTeX;
`merge=union` corruption.

Not verifiable without a device (documented as "test once"):

* whether **Preview** (iOS 26) and Working Copy's own PDF viewer offer
  **Share…** on a selection (Copy is documented for Preview);
* the exact label of Working Copy's overwrite/append control under *Show
  More* (irrelevant to the per-item design, which uses the default);
* that Cancel in *Ask for Input* ends the shortcut silently (Apple documents
  it for Show Alert; expected identical);
* `Get Clipboard` with an empty or image clipboard (guarded by step 3);
* Pull/Push network failures halting the shortcut (assumed; a table covers it).

Assumptions: the paper repository is on a remote both devices reach;
`paper.pdf` is committed; the desktop has Python 3.9+, git, `latexmk`; the
reviewer selects prose, not formulas.

## 15. Change log — v1 draft → v2

| v1 | v2 | Reason |
|---|---|---|
| Append every item to one `feedback.md` | One file per item in `feedback/`; `feedback.md` read as legacy | Concurrent appends conflict; `merge=union` verified to corrupt the layout; default safe write in Working Copy suffices |
| `## Review 12` + `**ID:**` line + `---` terminator | Heading `## Review rev-…` is the single ID; no ID line, no terminator | Fewer bytes for the phone keyboard to mangle; IDs already stable |
| Working Copy actions "Read File" / "Write File" / append | **Get Repository Files** / **Write Repository File** (exact names); no append needed | Verified action names; append label undocumented |
| "If input empty: Get Clipboard" as separate actions | Input action's own *If there's no input: Get Clipboard* | One-action fallback documented by Apple |
| Optional `Reviewed on`, `Device` | `Reviewed on` dropped; `Device` optional, off by default | ID carries the time; device names leak owner names |
| Statuses OPEN/DONE | OPEN / DONE / WONTFIX + mandatory `**Resolution:**` when leaving OPEN | Audit trail without touching reviewer text |
| Quick TODO as separate shortcut | Optional; empty comment in Shortcut 1 already yields TODO; TODO variant adds a random ID suffix | Same-second collisions |
| Finish = commit → push | Commit → **pull** → push; toggles specified | Push is rejected if the remote moved |
| Agent uses `Source` first | `Source` is a hint; `locate` confirms or flags drift | Line numbers go stale during the agent's own pass |
| Prose prompt for the agent | Prompt file + slash command + `AGENTS.md`; CLI does status changes | Reproducible, byte-preserving edits |
| — | Guards: empty selection, >2000 chars, clipboard preview, iOS 18 blank-vs-no-value conditions | Day-one failure modes found in review |
| — | First-run checklist (permissions, Paste from Other Apps, launchers) | Silent failures after "Don't Allow" |
| — | Installer, sample paper, tests, PDF-fidelity guide, reader table, troubleshooting, appendices | "Immediately usable" completion contract |

## 16. Acceptance criteria (v2)

The system is successful if:

* a reviewer captures a comment without leaving the PDF for more than a few
  seconds, through one native prompt, in Share-Sheet or clipboard mode;
* the selected text appears verbatim (blockquoted) in a new `feedback/rev-….md`;
* each note has a unique, stable ID; prior notes are never modified;
* `python scripts/feedback.py validate` passes on items captured by the shortcut;
* **Finish Paper Review** pushes to the same repository the desktop uses, and
  concurrent desktop work never produces a merge conflict on `feedback/`;
* `locate --all` resolves most items from quoted prose alone (UNIQUE), and
  the agent resolves them, compiles, marks DONE with resolutions, and reports
  the rest;
* everything needed to set this up is in the repository and readable by a
  first-time user (`README.md` → `docs/`).

## 17. Design principle

Mobile optimises for frictionless human review:

`read → select → Share… → type → Done → keep reading`

Git synchronisation and AI editing happen after the review, never during it.

# Review feedback schema (v2)

This document is the **normative** description of how review items are stored.
Every capture tool (the iOS Shortcuts, the desktop CLI, a SyncTeX editor
extension) writes this format; the AI agent that resolves the items reads and
updates it. `scripts/feedback.py validate` enforces it.

Design rules:

1. **One item, one file.** Mobile and desktop capture each write a *new* file
   under `feedback/`. New files never conflict in git, on any client, so a
   phone and a laptop can capture at the same time without merge problems.
2. **Stable IDs.** Every item is identified by `rev-YYYYMMDD-HHmmss` — local
   device time at capture. Nothing is ever renumbered.
3. **Reviewer text is immutable.** The agent may change `**Status:**` and add
   `**Resolution:**`. It must never edit or delete `**PDF text**` or
   `**Feedback**`.
4. **Few bytes to get wrong.** The block a Shortcut has to emit is short and
   contains no characters that iOS Smart Punctuation rewrites (no `---`, no
   straight quotes).
5. **Tolerant parsing.** Parsers accept minor variations (extra blank lines,
   optional fields in any order, a legacy single-file container, `## Review 12`
   headings with an `**ID:**` line) and preserve unknown `**Field:**` lines.

> **Why not one append-only `feedback.md`?** Two devices appending different
> items to the same file conflict in git. `merge=union` looks like a fix but is
> verified to *corrupt* this layout: git's merge folds the identical
> `**Status:** OPEN` tail shared by every item and emits it once, so the first
> item loses its status line and runs into the next heading — with no conflict
> markers. Separate files avoid the problem entirely. A legacy `feedback.md` is
> still read (see *Containers*), but nothing in this toolkit appends to it from
> two devices.

---

## Containers

### Primary: `feedback/` directory

```
feedback/
├── README.md                  ← placeholder so the directory exists in every clone (ignored)
├── TEMPLATE.md                ← the block the mobile shortcut pastes (ignored)
├── rev-20260817-235221.md     ← one review item
├── rev-20260817-235430.md
└── rev-20260818-101502.md
```

* File name = `<id>.md`. Files whose name does not match `rev-*.md` are
  ignored (`README.md`, `TEMPLATE.md`, editor backups…).
* Each file holds exactly **one** item. A parser that finds more than one
  heading in a file reads them all but reports a warning.
* Files sort chronologically by name because the ID starts with the timestamp.
* Encoding: UTF-8 without BOM (a BOM is tolerated on read), LF line endings
  (`.gitattributes`: `feedback/*.md text eol=lf`), file ends with a newline.

### Legacy: single `feedback.md`

A file `feedback.md` at the repository root containing many items separated by
their `## Review` headings (the v1 layout, also what an older desktop SyncTeX
tool writes). Parsers read it in addition to the directory; IDs must be unique
across both containers. Everything before the first `## Review` heading is a
preamble and is ignored. **Do not** rely on `merge=union` for it.

---

## Item grammar

```md
## Review rev-20260817-235221
**Source:** `sections/methodology.tex:183`     (optional — desktop tools only)
**Device:** iPad                                (optional — automatic, off by default)

**PDF text**
> first line of the quoted passage
> further lines, each prefixed with "> "

**Feedback**
one or more lines of reviewer comment

**Status:** OPEN

**Resolution:** added by the agent when the status leaves OPEN
```

Blank lines between fields are recommended but not required. Optional fields
are omitted, never left empty. Unknown `**Field:**` lines between the heading
and `**PDF text**` are preserved verbatim; a field line that follows the
blockquote (before `**Feedback**`) is read the same way.

### Heading (the ID)

`## Review <id>` — two `#`, the word `Review`, one space, the ID.

* New items: `<id>` matches `^rev-\d{8}-\d{6}(-[A-Za-z0-9]{1,8})?$`. The
  timestamp is **local device time** at capture (`yyyyMMdd-HHmmss`); it is an
  identifier, not a reliable clock.
* The optional suffix (`-07`, `-ipad`) avoids collisions when two items are
  captured within one second (the one-tap TODO variant, or two devices with
  identical clocks). The desktop CLI adds a 2-character suffix when the bare ID
  already exists; a Shortcut may append `-` + a random two-digit number.
* Legacy headings such as `## Review 12` are accepted **only** when an
  `**ID:**` line follows (see below).
* IDs are unique across the whole repository (directory + legacy file). A
  duplicate is a validation error.
* In the directory container the file name must be `<id>.md`; a mismatch is a
  warning and the heading wins.

### `**ID:**` (legacy, optional)

`` **ID:** `rev-…` ``. Older tools wrote the ID twice. Rules: if the heading
carries a valid `rev-…` ID, the `**ID:**` line must agree (warning otherwise)
and is ignored; if the heading has no valid ID, the `**ID:**` line supplies
it. New capture tools do not write this line.

### `**Source:**` (optional)

`` **Source:** `sections/methodology.tex:183` `` — repository-relative path
with forward slashes and a 1-based line number, written by desktop tools that
know the location (SyncTeX). Readers tolerate backslashes and a leading `./`.
Mobile capture never writes it.

**Source is a hint, not a location.** Line numbers drift as soon as an earlier
item's fix inserts or removes lines. The agent must confirm that the quoted
`**PDF text**` sits at or near that line and otherwise fall back to
`scripts/feedback.py locate`; `locate` reports drift for items with a Source.

### `**Device:**` (optional)

Automatic metadata only, off by default in the mobile recipe because device
*names* ("David's iPad") contain the owner's name and get pushed to a remote.
If enabled, use the device *model* (`iPad`, `iPhone`). Desktop tools write
`desktop`. Never prompt the reviewer for it.

### `**PDF text**`

A Markdown blockquote holding the passage the reviewer selected, verbatim.

* Every line of the passage is prefixed with `> ` (greater-than, space). A
  line that is just `>` is an empty quoted line. Capture tools normalise
  `\r\n`, `\r`, U+2028 and U+2029 to `\n` before prefixing and trim leading and
  trailing whitespace from the selection; they do **not** join lines, remove
  hyphens or touch ligatures — the desktop matcher normalises those.
* The blockquote ends at the first line that does not start with `>`.
* If there was nothing to quote, write one line `> (no text selected)` so the
  section is never empty.
* Expect anything a PDF viewer produces: ligature glyphs (`ﬁ`), curly quotes,
  line-break hyphenation (`con-` / `vergence`), unreadable math glyphs.
  Parsers must not choke on any Unicode.
* Guidance for reviewers (not enforced): select one to three sentences of
  prose, not a bare formula — prose is what the matcher anchors on. Capture
  tools warn and stop above ~2 000 characters (that is a whole page, or the
  PDF itself was shared instead of a selection).

### `**Feedback**`

The reviewer's comment: every line after `**Feedback**` up to the
`**Status:**` line, trimmed of surrounding blank lines. Free text, Markdown
allowed. Capture tools substitute the literal text `TODO: revise.` when the
reviewer submits an empty comment, so the section is never empty. Reviewers
should not start a comment line with `**Status:**` or `## Review`.

### `**Status:**`

| Status    | Meaning                                                          | Who sets it |
|-----------|------------------------------------------------------------------|-------------|
| `OPEN`    | Not yet addressed.                                               | capture tools |
| `DONE`    | The requested change is made and the paper compiles.             | agent / human |
| `WONTFIX` | Deliberately not addressed; the reason is in `**Resolution:**`.  | human (agent only when the reviewer's comment itself says to leave it) |

Upper-case; parsers accept any case and normalise. Anything else is a
validation error. An item the agent **cannot locate** stays `OPEN` and is
reported — the agent never invents a status.

### `**Resolution:**` (agent-written)

Required when the status is not `OPEN` (validation error if missing). One or
more lines describing what changed and where
(`sections/methodology.tex:27-29`). Continuation lines follow without a
prefix; the field ends at the next `**Field:**` line, a `---` line, or the end
of the item. If an item is reopened and resolved again, a second
`**Resolution:**` line is *appended*; earlier ones are never replaced.

### Terminator (legacy, optional)

A `---` line after an item is accepted and ignored. New capture tools do not
write it (iOS Smart Punctuation turns a typed `---` into an em dash).

---

## Canonical examples

### Mobile item — `feedback/rev-20260817-235221.md`

```md
## Review rev-20260817-235221

**PDF text**
> We therefore conclude that the estimator is consistent uniformly over the
> unit interval, which is the sufficient condition required for the affine

**Feedback**
Need to justify why this convergence is uniform.

**Status:** OPEN
```

### One-tap TODO item — `feedback/rev-20260817-235430-41.md`

```md
## Review rev-20260817-235430-41

**PDF text**
> a standard chaining argument over a grid of mesh h2 combined with Bernstein’s inequality

**Feedback**
TODO: revise.

**Status:** OPEN
```

### Desktop item with source — `feedback/rev-20260818-101502.md`

```md
## Review rev-20260818-101502
**Source:** `sections/introduction.tex:9`
**Device:** desktop

**PDF text**
> Our goal is a self-contained proof that avoids the usual entropy calculations.

**Feedback**
"Self-contained" overpromises — we still cite Giné & Nickl for the maximal inequality.

**Status:** OPEN
```

### Resolved item

```md
## Review rev-20260817-235221

**PDF text**
> We therefore conclude that the estimator is consistent uniformly over the
> unit interval, which is the sufficient condition required for the affine

**Feedback**
Need to justify why this convergence is uniform.

**Status:** DONE

**Resolution:** Added a sentence after the chaining step explaining that the
grid bound is uniform in x because the mesh is chosen independently of x
(sections/methodology.tex:27-29). Paper compiles.
```

### Legacy single-file item (read-only compatibility)

```md
## Review 12

**ID:** `rev-20260817-235221`

**PDF text**
> …

**Feedback**
…

**Status:** OPEN

---
```

---

## Validation rules (what `feedback.py validate` checks)

Errors (exit 1):

* an item without a resolvable ID, or an ID that does not match the pattern;
* duplicate IDs across all containers;
* missing or empty `**PDF text**` blockquote;
* missing or empty `**Feedback**`;
* missing or invalid `**Status:**`;
* status `DONE`/`WONTFIX` without a `**Resolution:**`.

Warnings (errors with `--strict`):

* file name ≠ `<id>.md` in the directory container;
* more than one item in a directory file;
* `**ID:**` line disagreeing with the heading;
* CRLF line endings, a BOM, or a missing final newline;
* unknown `**Field:**` lines.

Rewrites (done, wontfix, reopen) change only the `**Status:**` line and add a
`**Resolution:**` line; every other byte of the file is preserved so diffs stay
one or two lines.

## How the agent locates an item

1. `**Source:**` present → open that file and line, and confirm the quoted
   text is there or nearby.
2. Otherwise (or if it is not) run `scripts/feedback.py locate <id>`. It
   normalises both sides — NFKC (splits `ﬁ` into `fi`), straight quotes and
   dashes, optional hyphens at line breaks, collapsed whitespace, LaTeX
   commands and inline math stripped from the source side, non-alphanumeric
   "math garbage" dropped — and reports `file:start-end` candidates with a
   verdict of UNIQUE, AMBIGUOUS or NOT FOUND.
3. Not UNIQUE and not resolvable by reading the candidates → leave the item
   OPEN and report it.

## Quick greps

```
ls feedback/rev-*.md | wc -l                     # number of items
grep -l '^\*\*Status:\*\* OPEN' feedback/rev-*.md # open items
```

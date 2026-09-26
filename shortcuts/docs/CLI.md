# `scripts/feedback.py` — desktop CLI reference

A single-file, standard-library-only Python 3.9+ script. It is the only thing
that should ever *modify* a review item; capture tools only create new files.

```
python scripts/feedback.py [--root DIR] [--json] <command> [options]
```

On Windows without `python` on PATH use the interpreter's full path, e.g.
`C:\Users\<you>\anaconda3\python.exe scripts\feedback.py …`.

## Discovery and containers

* `--root DIR` is the paper repository root. Default: the nearest ancestor of
  the current directory (including itself) that contains a `feedback/`
  directory or a `feedback.md` file; if none, the current directory. The
  environment variable `FEEDBACK_ROOT` overrides the default.
* Items are read from **both** containers described in `FEEDBACK_SCHEMA.md`:
  `<root>/feedback/rev-*.md` (primary, one item per file) and
  `<root>/feedback.md` (legacy single file, if present).
* `--json` switches `validate`, `list`, `show`, `locate` and `report` to
  machine-readable JSON on stdout.
* Every file is read as UTF-8 (a BOM is tolerated) and written as UTF-8 with
  LF line endings. Bytes that are not valid UTF-8 are displayed as U+FFFD but
  pass through `done`/`wontfix`/`reopen` unchanged. Stdout is forced to UTF-8
  so ligatures and curly quotes in quoted PDF text never raise
  `UnicodeEncodeError` on Windows consoles.
* Exit codes: `0` success, `1` validation failure / item not found, `2` usage
  error (unknown command or `--status` value, negative `--top`, `--min-score`
  outside 0–1, a `--root` that is not a directory).
* `--version` prints the script version.

## Commands

### `init [--into DIR]`

Create `feedback/README.md` (the text in `templates/feedback-README.md`) under
the root or under `DIR`, so the directory exists in every clone. Never
overwrites. Prints the path.

### `validate [--strict]`

Parse every item and apply the rules in `FEEDBACK_SCHEMA.md`.

* Errors: unresolvable or malformed ID; duplicate ID; empty/missing
  `**PDF text**`; empty/missing `**Feedback**`; missing/invalid
  `**Status:**`; `DONE`/`WONTFIX` without `**Resolution:**`.
* Warnings (errors under `--strict`): file name ≠ `<id>.md`; more than one
  item in a directory file; `**ID:**` line disagreeing with the heading; CRLF,
  BOM, or missing final newline; unknown `**Field:**` lines.

Output: `OK: N items (a open, b done, c wontfix)` or one line per problem in
the form `path:line: error|warning: message`. Exit 1 if any error (or any
warning with `--strict`).

### `list [--status OPEN|DONE|WONTFIX|ALL] [--full]`

Default status filter: `OPEN`. Compact output, one line per item:

```
rev-20260817-235221  OPEN     -                              Need to justify why this convergence…  | We therefore conclude that the estim…
rev-20260818-101502  OPEN     sections/introduction.tex:9    "Self-contained" overpromises…          | Our goal is a self-contained proof…
```

`--full` prints each item's raw block preceded by a `[path]` line — the
"whole feedback.md" view the agent reads. `--json` prints an array of item
objects:

```json
{"id": "rev-…", "status": "OPEN", "source": "sections/introduction.tex:9", "device": null,
 "pdf_text": "…", "feedback": "…", "resolution": ["…"], "path": "feedback/rev-….md",
 "line_start": 1, "line_end": 12, "extra_fields": {"Reviewed on": "2026-08-17 23:52"}}
```

### `show ID`

Print the item's path and raw block verbatim. Exit 1 if unknown.

### `add --comment TEXT [--text TEXT | --text-file PATH | --stdin] [--source PATH:LINE] [--device NAME | --no-device]`

Create a new item file `feedback/<id>.md` (creating the directory and its
README if needed) from the schema's template:

* `id` = `rev-YYYYMMDD-HHmmss` from local time; if that file already exists,
  `-` plus two random lower-case alphanumerics are appended until unique.
* The text is normalised (`\r\n`, `\r`, U+2028, U+2029 → `\n`; trimmed) and
  every line is prefixed with `> `. Empty text → `> (no text selected)`.
* Empty/whitespace comment → `TODO: revise.`
* `--source` writes `**Source:**`; `**Device:**` defaults to `desktop`,
  `--no-device` omits it.
* Prints the new ID and the path.

### `done ID --resolution TEXT` · `wontfix ID --resolution TEXT` · `reopen ID [--resolution TEXT]`

Change the item's `**Status:**` line and add a `**Resolution:**` line
directly after the status block (after any existing resolutions — they are
never replaced). `--resolution` is required for `done` and `wontfix` (the
schema requires it) and must not be blank: a blank one is a usage error (exit
2) unless the item already has that status, in which case nothing changes.
Every other byte of the file is preserved, including
existing CRLF endings, so the git diff is one or two lines. Works for items
in the legacy `feedback.md` too. Unknown ID → exit 1. Re-running `done` on a
`DONE` item says so and exits 0 without changes.

### `locate (ID… | --text TEXT | --all) [--top N] [--min-score F]`

Find where quoted PDF text lives in the LaTeX sources under `--root`
(recursively; skips `.git`, `build`, `_build`, `out`, `_minted*`,
`node_modules`, `.venv`, and files over 2 MB). `--all` = every OPEN item.
Defaults: `--top 3`, `--min-score 0.55`.

For each item it prints the ID, a one-line preview of the query, the verdict
`UNIQUE` / `AMBIGUOUS` / `NOT FOUND`, up to N candidates as
`path:start-end  score=0.87`, and the best candidate's source lines with line
numbers. If the item has a `**Source:**`, it also prints
`source: path:line — confirmed` when the quote matches within ±10 lines of it,
or `source: path:line — DRIFT, best match at path:start-end` otherwise.

Always exits 0 (advisory) except on usage errors. `--json`: per item
`{id, verdict, source, source_status, candidates: [{path, line_start, line_end, score, snippet}]}`.
Unknown IDs are reported on stderr and skipped; when nothing is left to
locate (no OPEN items for `--all`, only unknown IDs) the plain output says so
and `--json` prints `[]`.

**Matching algorithm** (deterministic, stdlib only):

1. *Normalise* (both sides): `unicodedata.normalize("NFKC")` (splits `ﬁ`→`fi`);
   map `‘ ’ ‚ ′` → `'` and `“ ” „ ″` → `"`; `– — − ‐ ‑` → `-`; delete soft
   hyphens U+00AD and zero-width U+200B–U+200D, U+FEFF; join hyphenated line
   breaks (`-` + optional spaces + newline + optional spaces → nothing);
   newlines and NBSP/thin spaces → space; replace with a space every character outside
   `[A-Za-z0-9'\s-]` (this drops punctuation and unreadable math glyphs);
   collapse whitespace; lower-case; split into words; finally delete `-` and
   `'` inside words (`self-contained` → `selfcontained`, `bernstein's` →
   `bernsteins`). Empty tokens are dropped.
2. *Source side* (`.tex` files → `(word, line_number)` tokens): skip lines
   inside display-math environments (`equation`, `align`, `gather`,
   `multline`, `eqnarray`, `displaymath`, starred variants, `\[ … \]` — a
   line break `\\[2pt]` is not an opener); strip comments (`%` not escaped
   by a backslash; `\\%` is a line break followed by a comment); turn line
   breaks `\\`, `\\*`, `\\[len]` into a space; replace inline math (`$…$`,
   `\(…\)`) with a space; delete these commands with their arguments: `cite
   citep citet citealp ref eqref cref Cref autoref pageref label index vspace
   hspace includegraphics input include bibliography bibliographystyle
   usepackage documentclass newcommand renewcommand setlength pagestyle
   thispagestyle`; for any other `\command*[opt]` delete the command name and
   `[opt]` but keep brace contents (`\emph{word}` → `word`); `~`, `\,`, `\;`,
   `\ `, `\quad` → space; `---`/`--` → `-`; the LaTeX quote pairs (two
   backticks; two apostrophes) → `"`; delete remaining `{`, `}`, `\`; then
   apply step 1, keeping the line number on every token.
3. *Match*: `q` = query tokens; empty → NOT FOUND. Per file: every exact
   contiguous occurrence of `q` scores 1.0; otherwise slide a window of
   `len(q)` tokens, skip windows whose word-set overlap with `q` is under
   30 % or whose `quick_ratio()` (an upper bound on `ratio()`) is below
   0.8 × `min-score`, score the rest with `difflib.SequenceMatcher(None, q,
   window, autojunk=False).ratio()` and keep those at or above 0.8 ×
   `min-score` (near-misses are listed as "below threshold"). Queries under
   80 words are scored at every start position. Longer ones are sampled every
   `len(q) // 40` positions (plus the last one), and every position within one
   step of a sample scoring at least 0.8 × `min-score` − 0.10 is scored too:
   shifting a window by *d* tokens loses at most *d* matched tokens, so a
   passage above the threshold is always picked up by its nearest sample and
   then scored at its exact position, while a page-long query costs dozens of
   `ratio()` calls per file instead of thousands. Non-maximum suppression per
   file: drop any candidate whose token range overlaps a better one (ties go
   to the earlier position). Sort by score.
4. *Verdict*: no candidate ≥ `min-score` → NOT FOUND. Fewer than 4 query
   words → UNIQUE only for an exact match occurring exactly once, otherwise
   AMBIGUOUS/NOT FOUND. Else UNIQUE when the runner-up (any file) is more than
   0.10 below the best; AMBIGUOUS when within 0.10. Line range = lines of the
   window's first and last token; snippet = those source lines.

### `report`

Markdown summary for the agent's final message: totals by status, a table
`ID | status | source | feedback (first line) | resolution (first line)`, and
an explicit `Still OPEN:` list. `--json` gives the same data.

## Tests

`tests/test_feedback.py` uses `unittest` (so the stdlib-only promise holds;
pytest runs the same file). Run:

```
python -m unittest discover -s tests -v
```

Fixtures: `examples/sample-paper/` (the `.tex` sources for `locate`) and
inline item texts covering every example in `FEEDBACK_SCHEMA.md`.

# Appendix — a single append-only `feedback.md`

The original specification appended every item to one `feedback.md`. The
toolkit switched to one file per item (see the rationale at the top of
[FEEDBACK_SCHEMA.md](FEEDBACK_SCHEMA.md)). If you nevertheless want the
single-file layout — for instance because a desktop SyncTeX tool already
writes it — this is how, and what it costs.

## What changes in Shortcut 01

Replace step 13 (**Write Repository File** creating `feedback/[ID].md`) with
an append to `feedback.md`. Two ways:

**A. Append mode (Working Copy 6.6.1 or newer).** **Write Repository File**
with **Path** = `feedback.md`, content = `[Item]`, and under **Show More**
choose the append option. Its exact on-screen label is not documented
(release notes confirm append/prepend modes exist since 6.6.1; the sheet may
show a mode picker or toggles). Make the item block start with a blank line
so it never glues onto the previous item, and end it with a newline.

**B. Read–modify–write (any version).**
1. **Get Repository Files** — Repository, **Path** `feedback.md`.
2. **Get Text from** `[Repository Files]` → `Existing`.
3. **Text**: `[Existing]` followed by a blank line and `[Item]`.
4. **Write Repository File** — **Path** `feedback.md`, content = that Text,
   **Show More**: allow overwrite.

The file must exist before the first run (commit the v1 header from the
toolkit's git history, or any `# LaTeX Review Feedback` heading).

## What you lose

* **Concurrent appends conflict.** If the desktop (or a second device)
  appends to `feedback.md` while the phone has unpushed items, the next
  pull is a merge conflict that must be resolved in Working Copy's Resolve
  tool. Order Finish as Commit → Pull → Push and pull before desktop
  captures to keep this rare.
* **Do not "fix" that with `merge=union`.** It was tested with this exact
  layout: git's merge folds the identical `**Status:** OPEN` tail that every
  item ends with, and the first item comes out without its status line,
  glued to the next heading — with no conflict markers to warn you. Silent
  corruption is worse than a visible conflict.
* Smart Punctuation has more to damage (the `---` separators), and every
  append must get the trailing newline right.

## What still works

`scripts/feedback.py` reads `feedback.md` as a legacy container in addition
to `feedback/`, including `## Review 12` headings with an `**ID:**` line and
`---` separators. `done`/`wontfix`/`reopen` change the status inside it
without touching other items, `validate` checks it, and IDs must be unique
across both containers. Mixing both containers is fine.

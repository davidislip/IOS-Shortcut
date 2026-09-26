Address every review item whose status is OPEN. Items live in `feedback/rev-*.md`
(one file each; a legacy `feedback.md` may also exist). Never edit those files by
hand — use `scripts/feedback.py`.

## Before you start

1. Make sure the working tree is current (`git pull` if this repository is shared
   with a mobile device) and that the paper compiles as-is.
2. `python scripts/feedback.py validate` — if it fails, report the problems and stop.
3. `python scripts/feedback.py list --status OPEN --full` — read every open item.
4. `python scripts/feedback.py locate --all` — it fuzzy-matches each item's quoted
   PDF text against the `.tex` sources (normalising ligatures, line-break
   hyphenation and unreadable math glyphs) and prints `file:start-end` candidates
   with a verdict of UNIQUE, AMBIGUOUS or NOT FOUND. For items that carry a
   `**Source:**` it says whether that line still matches or has drifted.

## For each OPEN item, in ID order

1. **Find the passage.** `**Source:**` is a hint, not a location: open it, confirm
   the quoted text is there or nearby, otherwise use the `locate` result. Read the
   whole surrounding paragraph, theorem or proof — enough to understand the issue.
2. **If you cannot pin the passage down** (AMBIGUOUS or NOT FOUND, and reading the
   candidates does not settle it), change nothing, leave the item OPEN, and list it
   in the final report with a one-line reason.
3. **Make the requested revision.**
   - Preserve mathematical meaning unless the feedback explicitly asks for a
     mathematical change.
   - Keep the author's voice and notation; do not rewrite unrelated text.
   - `TODO: revise.` means: improve the clarity, precision and grammar of the quoted
     passage only.
4. **Compile** after each batch of edits (`latexmk -pdf -interaction=nonstopmode
   -halt-on-error main.tex`, or the project's usual build). Fix any LaTeX errors
   you introduced before moving on.
5. **Mark the item DONE** with the CLI:
   `python scripts/feedback.py done <id> --resolution "<what changed and where, e.g. sections/methodology.tex:27-29>"`
6. **Never** edit or delete a reviewer's `**PDF text**` or `**Feedback**`; never
   rename, renumber, reorder or delete item files.
7. Do not set WONTFIX yourself unless the reviewer's own comment says to leave the
   passage as is; then
   `python scripts/feedback.py wontfix <id> --resolution "<reason, quoting the feedback>"`.

## When finished

1. Rebuild the PDF the reviewer reads on mobile (e.g. `latexmk -pdf -jobname=paper
   main.tex` if the repository tracks `paper.pdf`) so the next review session sees
   the revised text.
2. `python scripts/feedback.py report` and reply with:
   - number of items completed (DONE) in this pass,
   - items still OPEN, each with the reason,
   - compilation status (clean / warnings / errors),
   - the list of source files you changed.

Leave the changes uncommitted unless you were asked to commit; if asked, use the
message `Address review feedback (<n> items)` and include the updated
`feedback/` files and `paper.pdf`.

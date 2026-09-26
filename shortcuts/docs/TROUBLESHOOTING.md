# Troubleshooting

Symptom → cause → fix. Shortcut names refer to [docs/shortcuts/](shortcuts/README.md).

## On the phone

### "Add Paper Feedback" is not in the Share Sheet

* **You shared the file, not a selection.** The shortcut accepts only Text /
  Rich text. Select text inside the PDF, tap the ▸ arrow in the callout,
  **Share…**.
* **The app shares no text.** Some readers (Acrobat, Books; GoodReader as far
  as documented) do not offer Share on a selection. **Copy** instead and run
  the shortcut from Back
  Tap / Action Button / Control Center ([FIRST_RUN.md](FIRST_RUN.md) § 3).
* **Not favourited / far down the list.** Scroll the action list, **Edit
  Actions…**, add to Favourites.
* **Show in Share Sheet is off.** Shortcut › **ⓘ** › switch it on.

### Banner "Nothing selected"

* Clipboard empty or contains an image → copy the text again.
* iOS asked "Allow Shortcuts to paste from …?" and you dismissed it → Settings
  › Apps › Shortcuts › **Paste from Other Apps → Allow**.

### Nothing is written and there is no error

* **Don't Allow** was tapped on a permission prompt once. Shortcut › **ⓘ** ›
  **Privacy** › reset, run from the editor, answer **Always Allow**.
* The **Repository** field in **Write Repository File** is blank (bindings can
  clear after Working Copy updates). Re-pick it.
* The device was locked while the shortcut ran; repositories are unavailable
  then.

### Error at Write Repository File: file exists

Two captures within the same second produced the same ID. Wait a second and
capture again, or use **Add Paper TODO**, which adds a random suffix.

### Error at Commit / Pull / Push (Finish Paper Review)

See the table in [03-finish-paper-review.md](shortcuts/03-finish-paper-review.md).
In short: **Fail when nothing to Commit** off; credentials saved in Working
Copy; Pro for push; conflicts (rare, never on `feedback/`) via Working Copy's
**Resolve**.

### Files app shows Working Copy greyed out

Files › **⋯** › **Edit** › switch Working Copy on. If the switch does not
stick, restart the device and try again (documented Working Copy behaviour
after updates).

### The prompt shows the wrong text (stale clipboard)

You launched in clipboard mode after copying something else. **Cancel** — the
shortcut writes nothing on Cancel. Copy the passage again and rerun.

## On the desktop

### `python` is not found (Windows)

The Microsoft Store stub answers `python`. Use the full interpreter path,
e.g. `C:\Users\<you>\anaconda3\python.exe scripts\feedback.py validate`, or
add a real Python to PATH.

### `validate` reports errors for items captured on the phone

| Message | Cause | Fix |
|---|---|---|
| `cannot resolve an ID from heading 'Rev-…'` | Auto-capitalisation changed `rev-` when the block was typed | Fix the file (`## Review rev-…`), then re-paste the Text block in the shortcut from `templates/review-item.md`. |
| `missing **PDF text** section` / `missing **Feedback**` | Smart Punctuation turned `**` or `>` into other characters, or the heading words were retyped | Same: re-paste the template; never type the block. |
| `invalid status` | The `**Status:**` line was altered | Re-paste; fix the file to `**Status:** OPEN`. |
| `file name … does not match ID` (warning) | The **Path** in step 13 does not use the same `[ID]` variable as the heading | Make both use the `ID` variable. |
| `CRLF line endings` (warning) | A Windows editor saved the file | `git add --renormalize feedback/` (the `.gitattributes` `eol=lf` line fixes it on commit). |
| `duplicate ID` | Same item pulled into both containers, or a copied file | Delete the copy; keep the one in `feedback/`. |
| `status DONE requires a **Resolution:** line` | Status was edited by hand | Use `python scripts/feedback.py done <id> --resolution "…"` instead. |

### `locate` says NOT FOUND or AMBIGUOUS

* The selection was a formula or a very short phrase. Only prose matches;
  select a full sentence next time. The agent leaves the item OPEN and
  reports it — resolve it by hand.
* `paper.pdf` was stale when it was reviewed: the sources changed since.
  Rebuild and commit the PDF after every agent pass (`latexmk -pdf
  -jobname=paper main.tex`).
* The sentence really occurs twice (abstract and introduction). Pick the
  right one and tell the agent, or resolve by hand.
* The PDF was built with OT1 fonts: copied accents/ligatures are mangled →
  [PDF_COPY_FIDELITY.md](PDF_COPY_FIDELITY.md).

### The agent edited the wrong passage

The item's `**Source:**` line pointed at a stale line number (an earlier fix
shifted the file). `Source` is a hint; the prompt tells the agent to confirm
it against the quote, but check the diff. Undo the edit, then
`python scripts/feedback.py reopen <id> --resolution "Wrong passage edited; redo"`
and run the agent again.

### `UnicodeEncodeError` / garbled characters in the console

Should not happen — the CLI forces UTF-8 output. If your terminal still shows
`?`, set it to UTF-8 (`chcp 65001` on Windows) or use `--json` and read the
file.

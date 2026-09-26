# Shortcut 01 — Add Paper Feedback

The capture shortcut. From the PDF: select text → **Share…** → **Add Paper
Feedback** → type a comment → **Done** → you are back in the PDF. It writes
one new file, `feedback/rev-YYYYMMDD-HHmmss.md`, into the Working Copy
repository (staged, not committed — [Finish Paper Review](03-finish-paper-review.md)
commits and pushes).

It also works with the clipboard: **Copy** the selection, then run the
shortcut from Back Tap, the Action Button, Control Center or a widget.

Read [README.md](README.md) first for how to add actions and magic variables.

## Setup

1. Shortcuts app › **+** (new shortcut). Tap the title › **Rename** →
   `Add Paper Feedback`. Choose any icon.
2. Tap the **ⓘ** (details) button at the bottom of the editor and turn on
   **Show in Share Sheet**. A **Receive … input from Share Sheet** action
   appears at the top of the shortcut; that is step 1 below.

## Actions

### 1. Receive input from Share Sheet

The action inserted by the setup. Configure it:

* Tap the blue **Any** → tap **Clear** → enable only **Text** and
  **Rich text** → **Done**.
  *Why:* otherwise the shortcut is offered when you share the whole PDF file
  or a URL, and would quote the entire paper into one item.
* Tap **Continue** after *If there's no input:* and choose **Get Clipboard**.
  *Why:* when the shortcut is launched without a selection (Home Screen, Back
  Tap, Action Button), the clipboard becomes the input — the copy-then-run
  fallback needs no second shortcut.

### 2. Get Text from Input

**Get Text from** `[Shortcut Input]`. Rename the output to `Selection`.
*Why:* rich text, or the `.txt` file some readers hand over, becomes plain
text.

### 3. Count Characters

**Count** **Characters** in `[Selection]`. Rename the output to `Length`.
*Why:* one number drives the two guards below. Counting sidesteps the
"has any value" test, whose meaning for empty text changed in iOS 18.

### 4. If — nothing to quote

**If** `[Length]` **is less than** `1`:

* **Show Notification** — body: `Nothing selected. Select text (or copy it) and run Add Paper Feedback again.`
* **Stop Shortcut** (search "stop"; called **Stop This Shortcut** on some versions).

Leave the **Otherwise** branch empty. Everything below goes **after** the
**End If**.

### 4b. If — selection too long

**If** `[Length]` **is greater than** `2000`:

* **Show Notification** — body: `Selection too long. Select a sentence or two, not the page.`
* **Stop Shortcut**

**End If**. *Why:* a 2 000-character selection is a whole page, or the PDF
itself was shared. The matcher only needs one to three sentences of prose.

### 5. Replace Text — trim

**Replace** `^\s+|\s+$` **with** *(leave empty)* **in** `[Selection]`.
Tap **Show More**: **Regular Expression** ON, **Case Sensitive** ON.
Rename the output to `Trimmed`.
*Why:* removes leading/trailing spaces and newlines so the quote does not end
with an empty `>` line.

### 6. Replace Text — quote every line

**Replace** `(?m)^` **with** `> ` **in** `[Trimmed]`. **Regular Expression** ON.
Type the replacement as a greater-than sign followed by one space.
Rename the output to `Quoted`.
*Why:* every line of a multi-line selection must start with `> ` (Markdown
blockquote). `(?m)` makes `^` match at every line start; without it only the
first line would be quoted.

> **Prefer no regular expressions?** Replace step 6 with: **Split Text**
> `[Trimmed]` by **New Lines** → **Repeat with Each** item in the result →
> inside the loop a **Text** action containing `> [Repeat Item]` → **End
> Repeat** → **Combine Text** `[Repeat Results]` with **New Lines**. Rename
> that last output `Quoted`.

### 7. Replace Text — preview (optional but recommended)

**Replace** `(?s)^(.{60}).+$` **with** `$1…` **in** `[Trimmed]`.
**Regular Expression** ON. Rename the output to `Preview`.
*Why:* the prompt in step 8 shows the first 60 characters of what will be
quoted, so a stale clipboard is caught before anything is written. Skip this
step if you never use clipboard mode; then use the plain prompt in step 8.

### 8. Ask for Input

**Ask for** **Text** with **Prompt** `Feedback on: [Preview]` (or just
`Feedback` if you skipped step 7). Tap **Show More**: **Default Answer**
empty, **Allow Multiple Lines** **OFF**.
Rename the output to `Comment`.

* With multiple lines off, **Return** on the keyboard submits — one-handed
  capture. Turn it on if you want paragraphs (then tap **Done**).
* **Cancel** ends the shortcut silently. Nothing is written, because this
  step comes before every write.

### 9. If — empty comment means TODO

**Count** **Characters** in `[Comment]` (a second Count action; its output
is `Count`). Then **If** `[Count]` **is less than** `1`:

* **Text** — content: `TODO: revise.`

**Otherwise**:

* **Text** — content: `[Comment]`

**End If**. The If action's own output, **If Result**, is whichever Text ran.
Rename it to `Feedback`. *(Counting works on every iOS version; an empty
answer counts as 0 whether the OS reports it as "no value" or as blank text.)*

### 10. Date and Format Date

* **Date** → **Current Date**.
* **Format Date** `[Date]` — **Date Format** = **Custom**, **Format String**
  = `yyyyMMdd-HHmmss`. Rename the output to `Stamp`.

### 11. Text — the ID

**Text** — content: `rev-[Stamp]` (type `rev-` then insert the `Stamp`
variable). Rename the output to `ID`.
`rev-` must stay **lower-case**: the keyboard auto-capitalises the first
letter of a Text action, and `Rev-…` is rejected by the desktop `validate`.
If you see `Rev-`, retype the `r` (or turn off *Settings › General ›
Keyboard › Auto-Capitalisation* first).

### 12. Text — the item block

**Do not type this block.** The installer put a copy of it into the paper
repository as `feedback/TEMPLATE.md` (the tools ignore that file). In
Working Copy open your repository › `feedback` › `TEMPLATE.md`, tap into the
text, **Select All** → **Copy**. (If it is missing, pull first; or copy
`templates/review-item.md` from the toolkit on the desktop and send it to
the phone.) Paste it into a new **Text** action, then replace the three
placeholders with magic variables:

```text
## Review [ID]

**PDF text**
[Quoted]

**Feedback**
[Feedback]

**Status:** OPEN
```

* `{{ID}}` → delete it and insert the `ID` variable (from step 11).
* `{{PDF_TEXT_BLOCKQUOTED}}` → the `Quoted` variable (step 6). It already
  contains the `> ` prefixes.
* `{{FEEDBACK}}` → the `Feedback` variable (step 9).

Check that the result has exactly this shape: a heading line, a blank line,
`**PDF text**`, the quote, a blank line, `**Feedback**`, the comment, a
blank line, `**Status:** OPEN`. Rename the output to `Item`.

The block deliberately contains no `---` and no straight quotes — nothing for
Smart Punctuation to damage — and the words `Review`, `PDF text`, `Feedback`
and `Status` must keep exactly this capitalisation.

### 13. Write Repository File (Working Copy)

Search "Write Repository File" (under **Apps › Working Copy**).

* **Repository** = your paper repository (pick it; e.g. `sample-paper`).
* **Path** = `feedback/[ID].md` — type `feedback/` (lower-case `f`; correct
  it if the keyboard capitalises it, or the file lands in a new `Feedback/`
  folder the desktop never reads), insert the `ID` variable, type `.md`.
* The content field (the action's input; its label — **File** or *Text* — is
  unverified) = `[Item]` (the Text from step 12).
* Tap **Show More**: leave the overwrite option **OFF**. With it off
  (Working Copy's "safe" write mode) the action creates the new file and
  refuses to clobber an existing one, which is exactly what we want. *(The
  option's exact label is unverified; builds from 6.6.1 also add
  append/prepend modes. None of those are needed.)*

The written file is staged for commit automatically.

### 14. Show Notification

**Show Notification** — **Title** `Add Paper Feedback`, body `Saved [ID]`.
It is a banner: no tap needed, and you return to the PDF app automatically.

## Test it

1. In the editor, tap **▶**. Because there is no Share Sheet input, the
   clipboard is used — copy a sentence first. Answer **Always Allow** to every
   permission prompt (Working Copy access, clipboard, notifications).
2. Type `test` at the prompt → **Done**. You should see the *Saved rev-…*
   banner.
3. Open Working Copy › your repository › `feedback/`: a new `rev-….md` file
   is listed as a staged change. Open it and compare with the block above.
4. Continue with [FIRST_RUN.md](../FIRST_RUN.md) to verify the item on the
   desktop with `python scripts/feedback.py validate`.

## Use it

* **Share Sheet** (if your reader offers **Share…** on a selection — see
  [READERS.md](../READERS.md); unverified in Preview, test once): select text
  in the PDF → in the callout tap the **▸** arrow until you see **Share…** →
  choose **Add Paper Feedback** (scroll the action list; favourite it once) →
  type → **Done**.
* **Clipboard:** select → **Copy** → run the shortcut from **Back Tap**, the
  **Action Button**, a **Control Center** control or a widget ([FIRST_RUN.md](../FIRST_RUN.md)
  shows how to set those up). The prompt shows a preview of what will be
  quoted.
* Empty comment + **Done** = a `TODO: revise.` item.

## Variants

* **Device stamp** (off by default: device *names* contain your name and are
  pushed to the remote): add **Get Device Details** → **Device Model** and
  insert a line `**Device:** [Device Model]` directly under the heading in
  step 12 (before the blank line).
* **Several papers:** set the **Repository** field in step 13 to **Ask Each
  Time** (unverified for this picker — test once), or duplicate the shortcut
  per paper.
* **Custom prompt text / notification:** free to change; they are not stored.

## Checklist

- [ ] ⓘ › **Show in Share Sheet** is on; input types are **Text** and **Rich text** only
- [ ] *If there's no input:* **Get Clipboard**
- [ ] All three **Replace Text** actions (trim, quote, preview) have **Regular Expression** on
- [ ] Format string is exactly `yyyyMMdd-HHmmss`
- [ ] The item block was **pasted** from `feedback/TEMPLATE.md`, and `rev-` / `feedback/` are lower-case
- [ ] **Path** is `feedback/[ID].md`; overwrite is off
- [ ] Ask for Input comes **before** Write Repository File

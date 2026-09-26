# Shortcut 04 — Start Paper Review (optional)

Pulls the latest commits before you start reading, so you review the current
`paper.pdf` (the desktop rebuilds it after each agent pass) and your phone
already has any items resolved on the desktop. Then it opens the PDF.

## Actions

New shortcut named `Start Paper Review`.

### 1. Pull Repository (Working Copy)

**Repository** = your paper repository. **Remote** empty.

### 2. Show Notification

**Title** `Start Paper Review`, body `Repository up to date`.

### 3. Open the PDF — pick one

* **Open in Working Copy** (Apps › Working Copy): **Repository** = your paper
  repository, **Path** = `paper.pdf` (parameter labels unverified — if the
  action has no path field, use **Open URLs** with
  `working-copy://open?repo=NAME&path=paper.pdf&mode=preview` instead).
  Working Copy renders PDFs natively,
  remembers your position, and (with Pro) lets you highlight. **Test once**
  whether its text-selection callout offers **Copy** or **Share…**; if it
  does, the whole loop stays inside Working Copy. If it does not, use the
  next option.
* **Open File** via the Files app (these action names are not on the verified
  list — test once): **Get File** → choose **Show Document
  Picker** ON, then at run time browse **Working Copy › your repository ›
  paper.pdf**; follow with **Quick Look** or **Open File** to hand it to your
  PDF app. Simpler alternative: end the shortcut after step 2 and open
  `paper.pdf` yourself from **Files › Working Copy › repository** (iOS 26
  opens it in **Preview**; on earlier versions use the share sheet › your
  PDF app). See [READERS.md](../READERS.md).

## Why pull first

* The desktop commits `paper.pdf` after resolving items. Reviewing a stale
  PDF means quoting text that no longer exists in the sources; the agent
  then reports NOT FOUND.
* Items the agent marked DONE arrive as changed `feedback/` files, so you can
  see what was addressed in Working Copy.

## Checklist

- [ ] Pull comes first
- [ ] Repository picked in every Working Copy action

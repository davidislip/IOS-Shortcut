# Shortcut 03 — Finish Paper Review

Ends a review session: commits the captured items, pulls whatever the
desktop pushed meanwhile, and pushes. Run it once at the end (or whenever you
want the desktop to see your items). Push requires **Working Copy Pro** (or
the trial) — see [REQUIREMENTS.md](../REQUIREMENTS.md).

## Actions

New shortcut named `Finish Paper Review` (no Share Sheet needed).

### 1. Commit Repository (Working Copy)

* **Repository** = your paper repository.
* **Message** = `Add paper review feedback`.
* Tap **Show More**:
  * **What to Commit** = **modified** (the default is **staged**; *modified*
    is meant to commit every changed file — Add Paper Feedback stages its
    files, but this should also catch PDF annotations you made inside Working
    Copy. Unverified: test once that the new item files are included; if not,
    use **staged**).
  * **Fail when nothing to Commit** = **OFF**. Otherwise the shortcut stops
    with an error when you run it twice in a row with nothing new.

### 2. Pull Repository (Working Copy)

**Repository** = your paper repository. **Remote** can stay empty (origin).

*Why before pushing:* if the desktop pushed since your last pull (resolved
items, a rebuilt `paper.pdf`), a push would be rejected. Pull merges those
commits first. Because every item is its own file, this merge never conflicts
on `feedback/`.

### 3. Push Repository (Working Copy)

**Repository** = your paper repository. **Remote** empty.

### 4. Show Notification

**Title** `Finish Paper Review`, body `Review feedback pushed`.

## Test it

Run it right after the first test capture. Working Copy › repository ›
history should show the commit *Add paper review feedback* containing the
`feedback/rev-….md` you just captured (if that file is not in the commit,
set **What to Commit** in step 1 to **staged**), and your Git host should
show it within seconds.

## When something fails

Shortcuts shows the failing action's error and stops; the notification does
not appear. (A merge conflict is a confirmed error; what happens on a network
failure is unverified — test once in Airplane Mode.)

| Symptom | Cause | What to do |
|---|---|---|
| Error at **Commit Repository** | Nothing to commit and the *Fail when nothing to Commit* toggle is on | Turn the toggle off (step 1). |
| Error at **Pull Repository** mentioning credentials | Working Copy is not signed in to the Git host | Open Working Copy › repository › **Pull**; enter credentials once; run the shortcut again. |
| Error at **Pull Repository** mentioning a conflict | A file was edited on both sides (not a `feedback/` item — those never conflict) | Open Working Copy, swipe left on the file › **Resolve**, commit, then run **Finish Paper Review** again. |
| Error at **Push Repository** | No Pro unlock / trial expired, or the remote moved again | Your commit exists locally; nothing is lost. Buy/renew Pro, or push later from the app (repository › **Push**). If the remote moved, run the shortcut again (it pulls first). |
| Nothing happens at all | The repository binding blanked out after an update | Re-pick the **Repository** in each of the three Working Copy actions. |

Unpushed items simply wait in the phone's repository; the desktop agent only
sees what has been pushed.

## Checklist

- [ ] **What to Commit** = modified, **Fail when nothing to Commit** = off
- [ ] Order is Commit → Pull → Push
- [ ] Pro unlock or trial active, Git host credentials saved in Working Copy

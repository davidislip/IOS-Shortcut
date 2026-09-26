# First run (five minutes)

Do this once after building the shortcuts. It triggers every permission
prompt in a calm setting (not inside a Share Sheet), sets up the launchers,
and verifies the first item on the desktop.

## 1. Run Add Paper Feedback from the editor

1. Copy any sentence (e.g. from Notes).
2. Shortcuts › **Add Paper Feedback** › **▶**.
3. Answer **Always Allow** to each prompt: *access Working Copy*, *paste from
   another app* (clipboard), *send notifications*. **Don't Allow** silently
   disables that action for good — if you tapped it by mistake, open the
   shortcut › **ⓘ** › **Privacy** › **Reset Privacy** and run again.
4. Type `test` → **Done**. You should see the banner *Saved rev-…*.
5. Working Copy › repository › `feedback/` shows the new file as staged.

## 2. Permissions in Settings

* **Settings › Apps › Shortcuts › Paste from Other Apps → Allow** (iOS 17:
  **Settings › Shortcuts**). Otherwise iOS asks "Allow Shortcuts to paste from …?" on every clipboard-mode run.
* **Settings › Notifications › Shortcuts → Allow Notifications** (banners).
  The *Saved …* and *pushed* banners are the only confirmation you get.

## 3. Make it reachable

* **Share Sheet** (if your reader offers **Share…** on a selection —
  unverified in Preview, see [READERS.md](READERS.md)): select text in the
  PDF › tap the **▸** arrow in the callout › **Share…** › scroll the action
  list to **Add Paper Feedback**.
  The first time, tap **Edit Actions…** at the bottom and add it to
  Favourites so it appears near the top.
* **Clipboard mode launcher** (pick one; runs without leaving the PDF app):
  * **Back Tap:** Settings › Accessibility › Touch › Back Tap › Double Tap ›
    choose *Add Paper Feedback*.
  * **Action Button** (iPhone 15 Pro and later): Settings › Action Button ›
    Shortcut › *Add Paper Feedback*.
  * **Control Center** (iOS 18): Control Center › **+** › Add a Control ›
    *Shortcut* › *Add Paper Feedback*.
  * A Lock Screen or Home Screen widget from the Shortcuts app.
  A Home Screen *icon* also works but opens the Shortcuts app first.

## 4. The first-capture test

1. Open `paper.pdf` (Files › Working Copy › repository, or inside Working
   Copy).
2. Select one full sentence › **Share…** › **Add Paper Feedback** (or **Copy**
   and use your launcher).
3. The prompt shows *Feedback on: …* with the start of your selection.
   Type `Test item, please ignore` › **Done**. Banner: *Saved rev-…*.
4. Run **Finish Paper Review**. Banner: *Review feedback pushed*. (No Pro:
   the commit exists locally; push later from the app.)

## 5. Verify on the desktop

```text
git pull
python scripts/feedback.py validate
python scripts/feedback.py list
python scripts/feedback.py locate --all
```

Expected:

```text
OK: 2 items (2 open, 0 done, 0 wontfix)

rev-20260825-101530      OPEN     -                                test                                      | Any sentence you copied…
rev-20260825-101902      OPEN     -                                Test item, please ignore                  | We therefore conclude that the estim…

rev-20260825-101530  NOT FOUND   "Any sentence you copied…"

rev-20260825-101902  UNIQUE   "We therefore conclude that the estimator is consistent uniformly…"
  sections/methodology.tex:24-25  score=1.00
       24: with Bernstein's inequality yields the rate. We therefore conclude that
       25: the estimator is consistent uniformly over the unit interval, which is
```

The first item quotes a sentence from Notes, so `locate` reports it NOT
FOUND — that is expected. The file and lines shown are the sample paper's;
with your own paper you see your sentence and your file.

If `validate` reports errors, the Text block in the shortcut was altered by
the keyboard — see [TROUBLESHOOTING.md](TROUBLESHOOTING.md) § Desktop
validate errors. Open the item file on the desktop and compare it with
`templates/review-item.md`.

## 6. Clean up

```text
git rm feedback/rev-20260825-101530.md feedback/rev-20260825-101902.md
git commit -m "Remove test review items"
git push
```

(or keep them and mark them DONE later). Then pull on the phone so it sees
the removal: **Start Paper Review** if you built the optional shortcut 04,
otherwise Working Copy › repository › **Pull**.

You are set. Daily use: pull (**Start Paper Review** or Working Copy ›
**Pull**) → read, capture → **Finish Paper Review** → desktop:
`/address-feedback` ([AGENT_HANDOFF.md](AGENT_HANDOFF.md)).

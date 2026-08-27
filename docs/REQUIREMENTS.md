# Requirements

## iPhone / iPad

| Need | Why |
|---|---|
| **iOS / iPadOS 17 or newer** (18 recommended) | Working Copy's **Get Repository Files** / **Write Repository File** Shortcuts actions were rewritten for iOS 18 and no longer run on iOS 16. On iOS 26 the Files app opens PDFs in the new **Preview** app, which is the recommended reader. |
| **Working Copy 6.6.1 or newer** | 6.1.3 rewrote the file actions for iOS 18; 6.6.1 added the append/prepend write modes (not used by the recipes). Whether older versions write correctly is unverified — test once if you cannot update. |
| **Working Copy Pro** (one-time in-app purchase; 10-day free trial) | **Push** is a Pro feature — in the app, in Shortcuts and via URL. Without it you can still clone, pull, write items and commit; you just cannot push (and are capped at 5 repositories). Finish Paper Review needs it. |
| **Git host credentials inside Working Copy** | GitHub/GitLab/… token or SSH key added in Working Copy's settings before the first pull or push; otherwise the Pull/Push actions fail (or wait for a login — which of the two is unverified). |
| **A PDF reader that lets you select text and Copy** | Share of the *selection* to Shortcuts is a bonus, not a requirement — the clipboard path always works. See [READERS.md](READERS.md). |
| A way to launch a shortcut without leaving the reader (optional) | **Back Tap**, the **Action Button**, a **Control Center** control (iOS 18) or a widget, for clipboard mode. |

Repositories in Working Copy are unavailable while the device is locked, so
time-triggered automations are out; everything here is run by hand.

## Desktop

| Need | Why |
|---|---|
| **Python 3.9 or newer** | `scripts/feedback.py` and the installer are standard-library only. On Windows without `python` on PATH use the interpreter's full path (e.g. `C:\Users\<you>\anaconda3\python.exe`). |
| **git** | Pull the phone's items, push the resolved paper. |
| **LaTeX toolchain with `latexmk`** (TeX Live or MiKTeX) | The agent compiles after every batch of edits and rebuilds `paper.pdf`. |
| **Claude Code** (for `/address-feedback`) or **Codex** / any agent that can run shell commands | Resolves the items. `AGENTS.md` / `CLAUDE.md` tell it what to do. |
| `pdftotext` (optional; ships with MiKTeX and poppler) | To check the PDF's copy fidelity ([PDF_COPY_FIDELITY.md](PDF_COPY_FIDELITY.md)). |

## The paper repository

* Hosted on a remote both devices can reach (GitHub, GitLab, …).
* `paper.pdf` **committed** — the phone reads the PDF from the repository; it
  cannot compile LaTeX.
* Contains the toolkit files ([INSTALL.md](INSTALL.md)): `scripts/feedback.py`,
  `prompts/address-feedback.md`, `feedback/README.md`, the `.gitattributes`
  lines, `AGENTS.md`.

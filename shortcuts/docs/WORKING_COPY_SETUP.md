# Working Copy setup

Working Copy is the git client on the phone. The shortcuts never talk to git
themselves; they call Working Copy's actions.

## 1. Install and unlock

* Install **Working Copy** from the App Store (free download).
* Pushing needs the **Pro** unlock. Start the 10-day trial or buy it in the
  app's settings (**Unlock Pro Features**). You can build and test everything
  except **Finish Paper Review**'s push without it.

## 2. Add your Git host

In Working Copy's settings (gear icon) look for the SSH-keys and
hosting-provider entries (exact labels unverified — they may also appear on
the **Clone repository** screen):

* GitHub/GitLab/Bitbucket: sign in through the provider entry, or create a
  personal access token on the website and enter it when Working Copy asks
  for credentials at the first pull/push.
* SSH: Working Copy generates a key pair; copy the public key to your host's
  SSH keys page.

Do this before running any shortcut: without credentials the **Pull Repository**
and **Push Repository** actions fail (or wait for a login and look like they
hang — which of the two is unverified; test once).

## 3. Clone the paper repository

Repositories list › **+** › **Clone repository** › paste the URL (the HTTPS
URL from your Git host's **Code**/clone button; the SSH URL only if you set
up an SSH key in step 2) or pick it from the provider list › **Clone**. Use
the same name you will recognise in the shortcuts' **Repository** picker
(the picker shows this name).

After cloning, open the repository and check that `feedback/README.md`,
`paper.pdf` and `scripts/feedback.py` are there. If not, the desktop side has
not pushed the toolkit yet ([INSTALL.md](INSTALL.md)).

## 4. Enable Working Copy in the Files app

Files app › **Browse** tab › **⋯** (top-right) › **Edit** › switch on
**Working Copy** › **Done**.
Your repositories now appear under **Files › Working Copy › repository**, so
any PDF reader can open `paper.pdf` from there.

Caveats (from Working Copy's manual):

* After some app updates the location becomes disabled and must be switched
  on again; occasionally a reboot is needed before it can be enabled.
* Changes other apps make to files in the location show up as uncommitted
  changes in Working Copy. Read-only use (viewing the PDF) changes nothing;
  annotating the PDF in another app will.
* Repositories are not accessible while the device is locked.

## 5. Read the PDF

Two options; try the first once.

* **Inside Working Copy:** repository › `paper.pdf`. PDFs render natively,
  scroll/zoom/page, and remember your position. Whether the selection
  callout offers **Copy**/**Share…** is undocumented — try it. Highlighting
  inside Working Copy is a Pro feature and modifies `paper.pdf` (a
  committable change).
* **From Files:** Files › Working Copy › repository › `paper.pdf`. On iOS 26
  this opens **Preview**; on older versions use the share sheet to open it in
  your PDF app. See [READERS.md](READERS.md) for which apps share selections.

## 6. The Repository picker in Shortcuts

* Every Working Copy action has a **Repository** parameter that lists the
  repositories in the app. Clone first, then build.
* After some Working Copy updates the binding is cleared and the action shows
  an empty Repository field ("pick the repository again"). Re-pick it in
  each action of each shortcut.
* Reviewing several papers: set the field to **Ask Each Time** (one extra tap
  per capture; unverified for this picker — test once) or duplicate the
  shortcuts per paper.

## 7. Settings worth knowing

* Repository › **Configuration**: leave **Rebase instead of Merge** off
  (default). With one file per item there is nothing to conflict either way.
* Repository › **Status** shows staged files; **Commit** and **Push** buttons
  there are your manual fallback when a shortcut fails.
* Working Copy › Settings › the **x-callback-url key** is only needed for the
  URL-scheme appendix; keep it private.

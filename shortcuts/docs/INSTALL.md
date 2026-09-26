# Install the toolkit into your paper repository

Order matters: everything is committed and pushed **from the desktop first**,
then cloned on the phone, then the shortcuts are built (their Repository
picker only lists repositories already in Working Copy).

## 1. Prerequisites

See [REQUIREMENTS.md](REQUIREMENTS.md). On the desktop you need Python 3.9+,
git, a LaTeX toolchain and a **local clone of the paper repository**
(`git clone` it from your Git host if you only have it there). On Windows,
if `python` opens the Microsoft Store instead of running, use the
interpreter's full path (e.g. `C:\Users\<you>\anaconda3\python.exe`) in
every command below.

## 2. Run the installer

From a clone of this repository (the toolkit is its `shortcuts/` folder),
where `/path/to/paper-repo` is your local clone of the paper repository:

```text
cd shortcuts
python scripts/install_toolkit.py /path/to/paper-repo
```

It copies into the paper repository:

| Source (toolkit) | Destination (paper repo) |
|---|---|
| `scripts/feedback.py` | `scripts/feedback.py` |
| `prompts/address-feedback.md` | `prompts/address-feedback.md` |
| `.claude/commands/address-feedback.md` | `.claude/commands/address-feedback.md` |
| `docs/FEEDBACK_SCHEMA.md`, `docs/CLI.md` | `docs/…` |
| `templates/feedback-README.md` | `feedback/README.md` (keeps the folder in every clone) |
| `templates/review-item.md` | `feedback/TEMPLATE.md` (the block you paste into the shortcut; ignored by the tools) |

and merges, without touching what is already there:

* `.gitattributes` — adds `* text=auto`, `feedback/*.md text eol=lf`,
  `feedback.md text eol=lf`, `*.tex text eol=lf`, `*.bib text eol=lf`,
  `*.pdf binary` (only the missing lines);
* `AGENTS.md` — appends a `## Review feedback` section (creates the file if
  missing);
* `CLAUDE.md` — adds an `@AGENTS.md` include line (creates the file if
  missing).

Options: `--dry-run` prints the plan and changes nothing; `--force` replaces
files that differ from the toolkit (e.g. after you upgrade the toolkit). The
installer is idempotent — running it again reports *nothing to do*. It never
edits `.tex` files.

**Manual alternative:** copy the files in the table by hand, append the
`.gitattributes` lines, and add the section from
`scripts/install_toolkit.py` (`AGENTS_SECTION`) to your `AGENTS.md`.

## 3. Make the PDF copy-friendly and commit it

From here on work **inside the paper repository** (`cd /path/to/paper-repo`),
not in the toolkit clone.

* Follow [PDF_COPY_FIDELITY.md](PDF_COPY_FIDELITY.md) (mostly: `[T1]{fontenc}`
  + `lmodern`, a recent LaTeX).
* Build the PDF the phone will read and **track it in git**:

  ```text
  latexmk -pdf -jobname=paper main.tex
  git add paper.pdf
  ```

  `main.tex` stands for your main file; `-jobname=paper` names the output
  `paper.pdf`, which is the file every phone-side document opens.
  If your `.gitignore` ignores `*.pdf`, add an exception line `!paper.pdf`.
  The phone cannot compile LaTeX; it can only read what is committed.

## 4. Commit and push

```text
git add -A
git commit -m "Add mobile review toolkit"
git push
```

Verify on the desktop that the CLI runs:

```text
python scripts/feedback.py validate      # OK: 0 items (0 open, 0 done, 0 wontfix)
```

## 5. On the iPhone / iPad

1. Install and set up Working Copy, clone the paper repository, enable the
   Files location — [WORKING_COPY_SETUP.md](WORKING_COPY_SETUP.md).
2. Build the shortcuts — [shortcuts/README.md](shortcuts/README.md)
   (01 and 03 are required).
3. Run the first-capture test — [FIRST_RUN.md](FIRST_RUN.md).

## Try it with the sample paper first (recommended)

`shortcuts/examples/sample-paper/` in a clone of this repository is a small
paper that compiles and already contains `feedback/README.md` and a tracked
`paper.pdf`. To rehearse the whole loop without touching your real paper:

1. Copy that folder somewhere, `git init`, commit, and push it to a scratch
   remote (a new, empty private GitHub repo is fine:
   `git remote add origin <url>` then `git push -u origin HEAD`). From
   `shortcuts/`, run the installer on it
   (`python scripts/install_toolkit.py /path/to/sample-copy`), then commit
   and push the copy.
2. Clone that remote in Working Copy and build the shortcuts against it.
3. Capture two or three items from `paper.pdf`, run **Finish Paper Review**,
   pull on the desktop, run `python scripts/feedback.py locate --all` and
   `/address-feedback`.

When it works, repeat steps 2–5 for the real paper (duplicate the shortcuts
and re-pick the repository, or set the Repository field to **Ask Each Time**
— unverified for this picker; test once).

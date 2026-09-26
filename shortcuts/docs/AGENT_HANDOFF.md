# Desktop hand-off: resolving the items with an agent

After **Finish Paper Review** pushed the phone's items, the desktop side
takes over. Nothing here needs the phone.

## 1. Pull and look

```text
git pull
python scripts/feedback.py validate
python scripts/feedback.py list
python scripts/feedback.py locate --all
```

Typical output:

```text
OK: 3 items (3 open, 0 done, 0 wontfix)

rev-20260825-101902      OPEN     -                                Need to justify why this convergence is…  | We therefore conclude that the estim…
rev-20260825-102240-41   OPEN     -                                TODO: revise.                             | a standard chaining argument over a gri…
rev-20260825-141502      OPEN     sections/introduction.tex:9      "Self-contained" overpromises.            | Our goal is a self-contained proof that…

rev-20260825-101902  UNIQUE   "We therefore conclude that the estimator is consistent uniformly…"
  sections/methodology.tex:24-25  score=1.00
       24: with Bernstein's inequality yields the rate. We therefore conclude that
       25: the estimator is consistent uniformly over the unit interval, which is

rev-20260825-102240-41  UNIQUE   "a standard chaining argument over a grid of mesh ℎ2 combined with Ber…"
  sections/methodology.tex:23-24  score=0.94
  …

rev-20260825-141502  UNIQUE   "Our goal is a self-contained proof that avoids the usual entropy calc…"
  source: sections/introduction.tex:9 — confirmed
  sections/introduction.tex:6-7  score=1.00
```

`locate` is advisory: it tells you (and the agent) where each quote lives,
whether a `**Source:**` hint still points at the right place (`confirmed` /
`DRIFT`), and which items are AMBIGUOUS or NOT FOUND and will need a human.

## 2. Run the agent

* **Claude Code:** start `claude` in the paper repository's directory and
  type `/address-feedback` (the command exists there because the installer
  copied `.claude/commands/address-feedback.md`). Extra instructions go
  after the command, e.g.
  `/address-feedback only items about Section 3; do not touch the abstract`.
  The command loads `prompts/address-feedback.md`.
* **Codex or another agent:** paste `prompts/address-feedback.md` as the
  task (Shortcut 05 copies it to the phone's clipboard if you chat from
  there). `AGENTS.md` in the repository carries the short version.

What the agent does, per `prompts/address-feedback.md`:

1. `validate`, `list --status OPEN --full`, `locate --all`.
2. For each OPEN item: find the passage (Source is a hint; confirm it), read
   the surrounding paragraph, make the requested change, preserve the
   mathematics unless asked otherwise, compile.
3. `python scripts/feedback.py done <id> --resolution "what changed, file:lines"`.
4. Leave AMBIGUOUS / NOT FOUND items OPEN and list them.
5. Rebuild `paper.pdf`, run `report`, summarise.

What it must not do: edit `**PDF text**` or `**Feedback**`, delete or rename
item files, set WONTFIX on its own, commit unless asked.

## 3. Review the result

```text
python scripts/feedback.py report          # table + "Still OPEN" list
git diff -- '*.tex'                        # the actual edits
git diff -- feedback/                      # one-line status changes + Resolution lines
```

Disagree with a resolution? Reopen it with a note and run the agent again
(or fix it yourself):

```text
python scripts/feedback.py reopen rev-20260825-101902 --resolution "Argument still not uniform in x; see chaining step"
```

Items the reviewer explicitly wants left alone:

```text
python scripts/feedback.py wontfix rev-20260825-141502 --resolution "Author prefers the current phrasing (discussed 2026-08-26)"
```

## 4. Rebuild, commit, push

(`main.tex` is your main file, as in [INSTALL.md](INSTALL.md) § 3.)

```text
latexmk -pdf -jobname=paper main.tex
git add -A
git commit -m "Address review feedback (3 items)"
git push
```

Pushing `paper.pdf` matters: the next pull on the phone (**Start Paper
Review**, or Working Copy › **Pull**) fetches it, and the reviewer reads the
revised text.

## Concurrency rules (short)

* Pull before the agent runs; push when done. That is all.
* Items are separate files, so the phone can capture while the desktop
  resolves; git merges the two sides without conflicts. Only editing the
  *same* item on both sides at once could conflict, and nothing in the
  workflow does that.

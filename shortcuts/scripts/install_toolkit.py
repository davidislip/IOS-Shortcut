#!/usr/bin/env python3
"""install_toolkit.py - copy the mobile review toolkit into a paper repository.

Usage::

    python scripts/install_toolkit.py /path/to/paper-repo [--force] [--dry-run]

What it does (idempotent; never clobbers a differing file unless --force):

* copies  scripts/feedback.py, prompts/address-feedback.md,
          .claude/commands/address-feedback.md, docs/FEEDBACK_SCHEMA.md, docs/CLI.md
          and templates/feedback-README.md (as feedback/README.md);
* merges  the review-related lines into .gitattributes,
          a "## Review feedback" section into AGENTS.md (created if missing),
          and an "@AGENTS.md" include into CLAUDE.md;
* prints  the next steps.

Exit codes: 0 done (or nothing to do), 1 refused (target invalid, or a file
differs and --force was not given), 2 usage error.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import List, Tuple

TOOLKIT = Path(__file__).resolve().parent.parent

COPIES: List[Tuple[str, str]] = [
    ("scripts/feedback.py", "scripts/feedback.py"),
    ("prompts/address-feedback.md", "prompts/address-feedback.md"),
    (".claude/commands/address-feedback.md", ".claude/commands/address-feedback.md"),
    ("docs/FEEDBACK_SCHEMA.md", "docs/FEEDBACK_SCHEMA.md"),
    ("docs/CLI.md", "docs/CLI.md"),
    ("templates/feedback-README.md", "feedback/README.md"),
    # The block the reviewer pastes into the shortcut's Text action. It sits
    # next to the items so Working Copy on the phone can open it; the tools
    # ignore it (only rev-*.md files are items).
    ("templates/review-item.md", "feedback/TEMPLATE.md"),
]

GITATTRIBUTES_HEADER = "# Review feedback toolkit (mobile LaTeX review)"
GITATTRIBUTES_LINES = [
    "* text=auto",
    "feedback/*.md text eol=lf",
    "feedback.md text eol=lf",
    "*.tex text eol=lf",
    "*.bib text eol=lf",
    "*.pdf binary",
]

AGENTS_HEADING = "## Review feedback"
AGENTS_SECTION = """## Review feedback

Review comments from the mobile/desktop review workflow live in `feedback/rev-*.md`,
one item per file (format: `docs/FEEDBACK_SCHEMA.md`). To resolve them follow
`prompts/address-feedback.md`:

1. `python scripts/feedback.py validate`, then `list --status OPEN --full`, then `locate --all`.
2. For each OPEN item find the passage (`**Source:**` is a hint; else use `locate`),
   make the requested change, keep mathematical meaning unless told otherwise, compile.
3. `python scripts/feedback.py done <id> --resolution "<what changed, file:lines>"`.
4. Leave unlocatable items OPEN and report them; finish with `python scripts/feedback.py report`.

Never edit a reviewer's `**PDF text**` or `**Feedback**`; never delete or rename item files.
"""

CLAUDE_INCLUDE = "@AGENTS.md"


def _norm(line: str) -> str:
    return " ".join(line.split())


def _read(path: Path) -> Tuple[str, str, str]:
    """Return (text with its original line endings, bom, eol) of an existing file.

    A merge must not rewrite what is already there, so callers append with the
    file's own line ending and keep its BOM; a fresh file gets LF and no BOM.
    """
    data = path.read_bytes()
    bom = ""
    if data.startswith(b"\xef\xbb\xbf"):
        bom = "\ufeff"
        data = data[3:]
    text = data.decode("utf-8")
    eol = "\r\n" if "\r\n" in text else "\n"
    return text, bom, eol


def _write(path: Path, text: str) -> None:
    """Write *text* verbatim - it already carries its line endings (and BOM)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(text)


def plan_copies(target: Path) -> Tuple[List[Tuple[Path, Path]], List[Path], List[Path]]:
    """Return (to_copy, identical, differing)."""
    to_copy, identical, differing = [], [], []
    for src_rel, dst_rel in COPIES:
        src = TOOLKIT / src_rel
        dst = target / dst_rel
        if not src.is_file():
            raise FileNotFoundError(f"toolkit file missing: {src}")
        if dst.exists():
            if src.read_bytes().replace(b"\r\n", b"\n") == dst.read_bytes().replace(b"\r\n", b"\n"):
                identical.append(dst)
            else:
                differing.append(dst)
                to_copy.append((src, dst))
        else:
            to_copy.append((src, dst))
    return to_copy, identical, differing


def merge_gitattributes(target: Path) -> Tuple[str, List[str]]:
    path = target / ".gitattributes"
    existing, bom, eol = _read(path) if path.exists() else ("", "", "\n")
    present = {_norm(l) for l in existing.splitlines()}
    missing = [l for l in GITATTRIBUTES_LINES if _norm(l) not in present]
    if not missing:
        return bom + existing, []
    body = existing
    if body and not body.endswith("\n"):
        body += eol
    if body:
        body += eol
    body += eol.join([GITATTRIBUTES_HEADER, *missing]) + eol
    return bom + body, missing


def merge_agents(target: Path) -> Tuple[str, bool]:
    path = target / "AGENTS.md"
    if not path.exists():
        return "# Instructions for coding agents\n\n" + AGENTS_SECTION, True
    existing, bom, eol = _read(path)
    if AGENTS_HEADING in existing:
        return bom + existing, False
    body = existing if existing.endswith("\n") else existing + eol
    return bom + body + eol + AGENTS_SECTION.replace("\n", eol), True


def merge_claude(target: Path) -> Tuple[str, bool]:
    path = target / "CLAUDE.md"
    if not path.exists():
        return CLAUDE_INCLUDE + "\n", True
    existing, bom, eol = _read(path)
    if "AGENTS.md" in existing:
        return bom + existing, False
    body = existing if existing.endswith("\n") else existing + eol
    return bom + body + eol + CLAUDE_INCLUDE + eol, True


def install(target: Path, force: bool, dry_run: bool) -> int:
    if not target.is_dir():
        print(f"error: {target} is not a directory", file=sys.stderr)
        return 1
    if target.resolve() == TOOLKIT:
        print(f"error: {target} is the toolkit itself - pass the paper repository to install into",
              file=sys.stderr)
        return 1
    if target.resolve() in TOOLKIT.parents:
        print(f"error: {target} contains the toolkit ({TOOLKIT.as_posix()}) - pass the paper repository to install into",
              file=sys.stderr)
        return 1
    if not (target / ".git").exists():
        print(f"warning: {target} has no .git directory - is this the paper repository?")

    to_copy, identical, differing = plan_copies(target)
    if differing and not force:
        print("refusing to overwrite files that differ from the toolkit (use --force to replace them):")
        for path in differing:
            print(f"  {path.relative_to(target).as_posix()}")
        return 1

    ga_text, ga_missing = merge_gitattributes(target)
    ag_text, ag_changed = merge_agents(target)
    cl_text, cl_changed = merge_claude(target)

    actions = []
    for src, dst in to_copy:
        verb = "replace" if dst in differing else "create"
        actions.append((verb, dst.relative_to(target).as_posix()))
    if ga_missing:
        actions.append(("append", ".gitattributes (" + ", ".join(ga_missing) + ")"))
    if ag_changed:
        actions.append(("create" if not (target / "AGENTS.md").exists() else "append", "AGENTS.md (## Review feedback)"))
    if cl_changed:
        actions.append(("create" if not (target / "CLAUDE.md").exists() else "append", "CLAUDE.md (@AGENTS.md)"))

    prefix = "would " if dry_run else ""
    for verb, what in actions:
        print(f"{prefix}{verb}: {what}")
    for path in identical:
        print(f"unchanged: {path.relative_to(target).as_posix()}")
    if not actions:
        print("nothing to do - toolkit already installed")
        return 0
    if dry_run:
        return 0

    for src, dst in to_copy:
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(src.read_bytes())
    if ga_missing:
        _write(target / ".gitattributes", ga_text)
    if ag_changed:
        _write(target / "AGENTS.md", ag_text)
    if cl_changed:
        _write(target / "CLAUDE.md", cl_text)

    print()
    print("Next steps:")
    print("  1. Review the changes (git status), then commit and push them from the desktop:")
    print('       git add -A && git commit -m "Add mobile review toolkit" && git push')
    print("  2. Make sure the compiled PDF (e.g. paper.pdf) is committed - the phone reads it from the repo.")
    print("  3. On the iPhone/iPad: clone the paper repository in Working Copy (docs/WORKING_COPY_SETUP.md).")
    print("  4. Build the shortcuts from docs/shortcuts/ (01 and 03 are required).")
    print("  5. Run the first-capture test (docs/FIRST_RUN.md).")
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="install_toolkit.py",
                                     description="Copy the mobile review toolkit into a paper repository.")
    parser.add_argument("repo", help="path to the paper repository")
    parser.add_argument("--force", action="store_true", help="replace files that differ from the toolkit")
    parser.add_argument("--dry-run", action="store_true", help="print what would change and exit")
    args = parser.parse_args(argv)
    return install(Path(args.repo).resolve(), args.force, args.dry_run)


if __name__ == "__main__":
    sys.exit(main())

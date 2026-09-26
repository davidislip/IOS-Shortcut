#!/usr/bin/env python3
"""feedback.py - manage LaTeX review items captured on iOS or the desktop.

Review items are small Markdown files, one per item, under ``feedback/``
(``feedback/rev-YYYYMMDD-HHmmss.md``); a legacy single ``feedback.md`` is read
as well.  The format is specified in ``docs/FEEDBACK_SCHEMA.md`` and this
command surface in ``docs/CLI.md``.

Usage::

    python scripts/feedback.py [--root DIR] [--json] <command> [options]

Commands::

    init      [--into DIR]                 create feedback/README.md
    validate  [--strict]                   check every item against the schema
    list      [--status S] [--full]        list items (default: OPEN)
    show      ID                           print one item verbatim
    add       --comment TEXT [--text TEXT | --text-file PATH | --stdin]
              [--source PATH:LINE] [--device NAME | --no-device]
    done      ID --resolution TEXT         mark DONE
    wontfix   ID --resolution TEXT         mark WONTFIX
    reopen    ID [--resolution TEXT]       mark OPEN again
    locate    (ID... | --text TEXT | --all) [--top N] [--min-score F]
    report                                 Markdown summary for the agent's report

Standard library only; Python 3.9+.  Exit codes: 0 ok, 1 validation failure or
item not found, 2 usage error.
"""

from __future__ import annotations

import argparse
import difflib
import io
import json
import os
import posixpath
import random
import re
import string
import sys
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Optional, Sequence, Tuple

__version__ = "2.0.0"

# --------------------------------------------------------------------------- #
# Constants
# --------------------------------------------------------------------------- #

ID_RE = re.compile(r"^rev-\d{8}-\d{6}(-[A-Za-z0-9]{1,8})?$")
HEADING_RE = re.compile(r"^##\s+Review\s+(\S+)\s*$")
FIELD_RE = re.compile(r"^\*\*([A-Za-z][A-Za-z0-9 _-]*?):\*\*\s*(.*?)\s*$")
SECTION_RE = re.compile(r"^\*\*(PDF text|Feedback)\*\*\s*$")
RULE_RE = re.compile(r"^-{3,}\s*$")
STATUSES = ("OPEN", "DONE", "WONTFIX")
ITEM_DIR = "feedback"
LEGACY_FILE = "feedback.md"
ITEM_GLOB = "rev-*.md"
NO_TEXT_SENTINEL = "(no text selected)"
EMPTY_COMMENT = "TODO: revise."
SKIP_DIRS = {".git", "build", "_build", "out", "node_modules", ".venv", "__pycache__"}
MAX_TEX_BYTES = 2 * 1024 * 1024
BOM = "\ufeff"

README_TEXT = """# Review feedback

One file per review item, named `rev-YYYYMMDD-HHmmss.md`.

* Created on iPhone/iPad by the **Add Paper Feedback** shortcut (Working Copy)
  or on the desktop by `python scripts/feedback.py add`.
* Resolved by the AI agent with `python scripts/feedback.py done <id> --resolution "..."`.
* Format: `docs/FEEDBACK_SCHEMA.md`. Do not edit or delete a reviewer's text.

This README keeps the directory present in every clone; tools ignore it.
"""


# --------------------------------------------------------------------------- #
# Data model
# --------------------------------------------------------------------------- #


@dataclass
class Problem:
    path: str
    line: int
    level: str  # "error" | "warning"
    message: str

    def format(self) -> str:
        return f"{self.path}:{self.line}: {self.level}: {self.message}"


@dataclass
class Item:
    path: Path
    container: str  # "dir" | "legacy"
    heading_token: str
    line_start: int  # 1-based line of the heading
    line_end: int  # 1-based last line of the item
    id: Optional[str] = None
    id_line: Optional[str] = None
    source: Optional[str] = None
    device: Optional[str] = None
    pdf_lines: List[str] = field(default_factory=list)
    feedback_lines: List[str] = field(default_factory=list)
    status: Optional[str] = None
    status_raw: Optional[str] = None
    resolution: List[str] = field(default_factory=list)
    extra_fields: Dict[str, str] = field(default_factory=dict)
    raw_lines: List[str] = field(default_factory=list)
    status_index: Optional[int] = None  # 0-based absolute line index in file
    insert_index: Optional[int] = None  # 0-based absolute index of the line after which a Resolution goes
    problems: List[Problem] = field(default_factory=list)

    @property
    def pdf_text(self) -> str:
        return "\n".join(self.pdf_lines).strip()

    @property
    def feedback(self) -> str:
        return "\n".join(self.feedback_lines).strip()

    @property
    def raw(self) -> str:
        lines = list(self.raw_lines)
        while lines and not lines[-1].strip():
            lines.pop()
        return "\n".join(lines)

    def display_path(self, root: Path) -> str:
        return rel_posix(self.path, root)

    def to_dict(self, root: Path) -> dict:
        return {
            "id": self.id,
            "heading": self.heading_token,
            "status": self.status,
            "source": self.source,
            "device": self.device,
            "pdf_text": self.pdf_text,
            "feedback": self.feedback,
            "resolution": list(self.resolution),
            "path": self.display_path(root),
            "container": self.container,
            "line_start": self.line_start,
            "line_end": self.line_end,
            "extra_fields": dict(self.extra_fields),
        }


# --------------------------------------------------------------------------- #
# Small helpers
# --------------------------------------------------------------------------- #


def rel_posix(path: Path, root: Path) -> str:
    try:
        return Path(os.path.relpath(path, root)).as_posix()
    except ValueError:  # different drive on Windows
        return path.as_posix()


def read_text_raw(path: Path, errors: str = "replace") -> Tuple[str, bool]:
    """Return (text with original line endings, had_bom).

    *errors* is the UTF-8 decode policy: ``"replace"`` for parsing/display,
    ``"surrogateescape"`` when the text will be written back (invalid bytes
    then round-trip unchanged).  Both policies split lines identically.
    """
    data = path.read_bytes()
    had_bom = data.startswith(b"\xef\xbb\xbf")
    if had_bom:
        data = data[3:]
    return data.decode("utf-8", errors=errors), had_bom


def write_text_raw(path: Path, text: str, bom: bool = False) -> None:
    data = text.encode("utf-8", errors="surrogateescape")
    if bom:
        data = b"\xef\xbb\xbf" + data
    path.write_bytes(data)


def write_text_lf(path: Path, text: str) -> None:
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)


def find_root(start: Optional[Path] = None) -> Path:
    env = os.environ.get("FEEDBACK_ROOT")
    if env:
        return Path(env).resolve()
    here = (start or Path.cwd()).resolve()
    for candidate in [here, *here.parents]:
        if (candidate / ITEM_DIR).is_dir() or (candidate / LEGACY_FILE).is_file():
            return candidate
    return here


def strip_backticks(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == "`" and value[-1] == "`":
        return value[1:-1].strip()
    return value


def first_line(text: str, width: int = 60) -> str:
    line = text.strip().splitlines()[0] if text.strip() else ""
    line = " ".join(line.split())
    if len(line) > width:
        return line[: width - 1] + "…"
    return line


def normalise_newlines(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n").replace("\u2028", "\n").replace("\u2029", "\n")


# --------------------------------------------------------------------------- #
# Parsing
# --------------------------------------------------------------------------- #


def parse_items(text: str, path: Path, container: str) -> Tuple[List[Item], List[Problem]]:
    """Parse every ``## Review`` item in *text*.

    *text* may contain any line endings; indices refer to ``splitlines()``.
    """
    lines = text.splitlines()
    problems: List[Problem] = []
    display = path.as_posix()
    heads = [i for i, line in enumerate(lines) if HEADING_RE.match(line)]
    items: List[Item] = []
    for n, start in enumerate(heads):
        end = heads[n + 1] if n + 1 < len(heads) else len(lines)
        items.append(_parse_block(lines, start, end, path, container, display))
    return items, problems


def _parse_block(lines: List[str], start: int, end: int, path: Path, container: str, display: str) -> Item:
    token = HEADING_RE.match(lines[start]).group(1)
    item = Item(path=path, container=container, heading_token=token, line_start=start + 1, line_end=end)
    item.raw_lines = lines[start:end]
    probs = item.problems

    def warn(i: int, msg: str) -> None:
        probs.append(Problem(display, i + 1, "warning", msg))

    def err(i: int, msg: str) -> None:
        probs.append(Problem(display, i + 1, "error", msg))

    def record_field(i: int, name: str, value: str) -> None:
        key = name.strip().lower()
        if not value.strip():
            warn(i, f"empty **{name.strip()}:** field (omit optional fields instead)")
        if key == "id":
            item.id_line = strip_backticks(value)
        elif key == "source":
            item.source = strip_backticks(value)
        elif key == "device":
            item.device = value.strip()
        else:
            item.extra_fields[name.strip()] = value.strip()

    phase = "head"
    saw_pdf_header = False
    saw_feedback_header = False
    resolution_open = False
    i = start + 1
    while i < end:
        line = lines[i]
        stripped = line.strip()
        if phase == "head":
            if not stripped or RULE_RE.match(stripped):
                i += 1
                continue
            sec = SECTION_RE.match(stripped)
            if sec and sec.group(1) == "PDF text":
                saw_pdf_header = True
                phase = "pdf"
                i += 1
                continue
            if sec and sec.group(1) == "Feedback":
                err(i, "**Feedback** found before **PDF text**")
                saw_feedback_header = True
                phase = "feedback"
                i += 1
                continue
            fld = FIELD_RE.match(stripped)
            if fld:
                name, value = fld.group(1), fld.group(2)
                if name.strip().lower() == "status":
                    err(i, "**Status:** found before **PDF text**")
                    item.status_raw = value.strip()
                    item.status_index = i
                    item.insert_index = i
                    phase = "tail"
                else:
                    record_field(i, name, value)
                i += 1
                continue
            warn(i, f"unexpected line before **PDF text**: {stripped[:40]!r}")
            i += 1
            continue

        if phase == "pdf":
            if stripped.startswith(">"):
                body = line.lstrip()[1:]
                if body.startswith(" "):
                    body = body[1:]
                item.pdf_lines.append(body.rstrip())
                i += 1
                continue
            if not stripped:
                i += 1
                continue
            sec = SECTION_RE.match(stripped)
            if sec and sec.group(1) == "Feedback":
                saw_feedback_header = True
                phase = "feedback"
                i += 1
                continue
            fld = FIELD_RE.match(stripped)
            if fld:
                name, value = fld.group(1), fld.group(2)
                if name.strip().lower() == "status":
                    err(i, "**Status:** found before **Feedback**")
                    item.status_raw = value.strip()
                    item.status_index = i
                    item.insert_index = i
                    phase = "tail"
                else:
                    # Optional fields may come in any order: one that follows the
                    # blockquote is recorded exactly like one before **PDF text**.
                    record_field(i, name, value)
                i += 1
                continue
            warn(i, f"unexpected line inside **PDF text**: {stripped[:40]!r}")
            i += 1
            continue

        if phase == "feedback":
            fld = FIELD_RE.match(stripped)
            if fld and fld.group(1).strip().lower() == "status":
                item.status_raw = fld.group(2).strip()
                item.status_index = i
                item.insert_index = i
                phase = "tail"
                i += 1
                continue
            item.feedback_lines.append(line.rstrip())
            i += 1
            continue

        # phase == "tail"
        if RULE_RE.match(stripped):
            resolution_open = False
            i += 1
            continue
        fld = FIELD_RE.match(stripped)
        if fld:
            name, value = fld.group(1).strip(), fld.group(2).strip()
            if name.lower() == "resolution":
                item.resolution.append(value)
                resolution_open = True
                item.insert_index = i
            else:
                resolution_open = False
                if name.lower() == "status":
                    warn(i, "second **Status:** line ignored")
                else:
                    item.extra_fields[name] = value
            i += 1
            continue
        if not stripped:
            i += 1
            continue
        if resolution_open:
            item.resolution[-1] = (item.resolution[-1] + "\n" + line.rstrip()).strip()
            item.insert_index = i
            i += 1
            continue
        warn(i, f"unexpected line after **Status:**: {stripped[:40]!r}")
        i += 1

    # Resolve the ID.
    tok_ok = bool(ID_RE.match(token))
    if tok_ok:
        item.id = token
        if item.id_line is not None and item.id_line != token:
            warn(start, f"**ID:** line ({item.id_line}) disagrees with heading ({token}); heading wins")
    elif item.id_line is not None:
        if ID_RE.match(item.id_line):
            item.id = item.id_line
        else:
            err(start, f"malformed ID {item.id_line!r} (expected rev-YYYYMMDD-HHmmss)")
    else:
        err(start, f"cannot resolve an ID from heading {token!r} and no **ID:** line")

    if not saw_pdf_header:
        err(start, "missing **PDF text** section")
    elif not item.pdf_text:
        err(start, "empty **PDF text** blockquote")
    if not saw_feedback_header:
        err(start, "missing **Feedback** section")
    elif not item.feedback:
        err(start, "empty **Feedback**")
    if item.status_raw is None:
        err(start, "missing **Status:** line")
    else:
        norm = item.status_raw.strip().upper()
        if norm in STATUSES:
            item.status = norm
        else:
            err(item.status_index or start, f"invalid status {item.status_raw!r} (OPEN, DONE or WONTFIX)")
    if item.status in ("DONE", "WONTFIX") and not any(r.strip() for r in item.resolution):
        err(item.status_index or start, f"status {item.status} requires a **Resolution:** line")
    for name in item.extra_fields:
        warn(start, f"unknown field **{name}:** preserved")
    return item


def load_file(path: Path, container: str) -> Tuple[List[Item], List[Problem], dict]:
    text, had_bom = read_text_raw(path)
    info = {
        "bom": had_bom,
        "crlf": "\r\n" in text,
        "final_newline": text.endswith("\n") or text == "",
        "empty": text.strip() == "",
    }
    items, problems = parse_items(text, path, container)
    return items, problems, info


def load_all(root: Path) -> Tuple[List[Item], List[Problem]]:
    items: List[Item] = []
    problems: List[Problem] = []
    item_dir = root / ITEM_DIR
    if item_dir.is_dir():
        # Chronological: the bare ID sorts before its suffixed siblings.
        paths = sorted(item_dir.glob(ITEM_GLOB), key=lambda p: (p.stem[:19], p.stem[19:]))
        for path in paths:
            if not path.is_file():
                continue
            found, probs, info = load_file(path, "dir")
            display = rel_posix(path, root)
            problems.extend(probs)
            if not found:
                problems.append(Problem(display, 1, "error", "no review item found in file"))
            if len(found) > 1:
                problems.append(Problem(display, 1, "warning", f"{len(found)} items in one file (expected 1)"))
            for it in found:
                if it.id and path.stem != it.id:
                    problems.append(Problem(display, it.line_start, "warning", f"file name {path.name!r} does not match ID {it.id}"))
            _file_warnings(display, info, problems)
            items.extend(found)
    legacy = root / LEGACY_FILE
    if legacy.is_file():
        found, probs, info = load_file(legacy, "legacy")
        display = rel_posix(legacy, root)
        problems.extend(probs)
        if found:
            _file_warnings(display, info, problems)
        items.extend(found)
    # Item-level problems use the path as given; rewrite to root-relative.
    for it in items:
        rel = it.display_path(root)
        for p in it.problems:
            p.path = rel
        problems.extend(it.problems)
    # Duplicate IDs.
    seen: Dict[str, Item] = {}
    for it in items:
        if not it.id:
            continue
        if it.id in seen:
            problems.append(Problem(it.display_path(root), it.line_start, "error",
                                    f"duplicate ID {it.id} (also in {seen[it.id].display_path(root)}:{seen[it.id].line_start})"))
        else:
            seen[it.id] = it
    return items, problems


def _file_warnings(display: str, info: dict, problems: List[Problem]) -> None:
    if info["bom"]:
        problems.append(Problem(display, 1, "warning", "file starts with a UTF-8 BOM"))
    if info["crlf"]:
        problems.append(Problem(display, 1, "warning", "CRLF line endings (expected LF)"))
    if not info["final_newline"]:
        problems.append(Problem(display, 1, "warning", "file does not end with a newline"))


def find_item(items: Sequence[Item], item_id: str) -> Optional[Item]:
    for it in items:
        if it.id == item_id:
            return it
    return None


# --------------------------------------------------------------------------- #
# Rendering / adding
# --------------------------------------------------------------------------- #


def blockquote(text: str) -> List[str]:
    text = normalise_newlines(text).strip()
    if not text:
        return ["> " + NO_TEXT_SENTINEL]
    return [("> " + line.rstrip()).rstrip() for line in text.split("\n")]


def _escape_comment_line(line: str) -> str:
    """Neutralise a comment line the parser would read as structure.

    A reviewer comment starting with ``**Status:**``, ``## Review`` or a
    section marker would end the item early; a leading backslash keeps the
    text visible while making it inert (Markdown treats it as an escape).
    """
    stripped = line.strip()
    fld = FIELD_RE.match(stripped)
    if (fld and fld.group(1).strip().lower() == "status") or HEADING_RE.match(stripped) or SECTION_RE.match(stripped):
        return "\\" + line.lstrip()
    return line


def render_item(item_id: str, pdf_text: str, comment: str, source: Optional[str] = None,
                device: Optional[str] = None) -> str:
    comment = normalise_newlines(comment).strip() or EMPTY_COMMENT
    comment = "\n".join(_escape_comment_line(line) for line in comment.split("\n"))
    out = [f"## Review {item_id}"]
    if source:
        out.append(f"**Source:** `{source}`")
    if device:
        out.append(f"**Device:** {device}")
    out.append("")
    out.append("**PDF text**")
    out.extend(blockquote(pdf_text))
    out.append("")
    out.append("**Feedback**")
    out.append(comment)
    out.append("")
    out.append("**Status:** OPEN")
    return "\n".join(out) + "\n"


def make_id(now: Optional[datetime] = None) -> str:
    now = now or datetime.now()
    return now.strftime("rev-%Y%m%d-%H%M%S")


def unique_id(base: str, exists: Callable[[str], bool], rng: Optional[random.Random] = None) -> str:
    if not exists(base):
        return base
    rng = rng or random.Random()
    alphabet = string.ascii_lowercase + string.digits
    for _ in range(1000):
        candidate = f"{base}-{rng.choice(alphabet)}{rng.choice(alphabet)}"
        if not exists(candidate):
            return candidate
    raise RuntimeError("could not find a unique ID")


def ensure_item_dir(root: Path) -> Path:
    item_dir = root / ITEM_DIR
    item_dir.mkdir(parents=True, exist_ok=True)
    readme = item_dir / "README.md"
    if not readme.exists():
        write_text_lf(readme, README_TEXT)
    return item_dir


def add_item(root: Path, pdf_text: str, comment: str, source: Optional[str] = None,
             device: Optional[str] = "desktop", now: Optional[datetime] = None,
             rng: Optional[random.Random] = None) -> Tuple[str, Path]:
    item_dir = ensure_item_dir(root)
    existing_ids = {it.id for it in load_all(root)[0] if it.id}

    def exists(candidate: str) -> bool:
        return candidate in existing_ids or (item_dir / f"{candidate}.md").exists()

    item_id = unique_id(make_id(now), exists, rng)
    path = item_dir / f"{item_id}.md"
    write_text_lf(path, render_item(item_id, pdf_text, comment, source, device))
    return item_id, path


# --------------------------------------------------------------------------- #
# Status changes (byte-preserving)
# --------------------------------------------------------------------------- #


def change_status(item: Item, new_status: str, resolution: Optional[str]) -> bool:
    """Rewrite the item's file changing only the Status line and adding a Resolution.

    Returns True if the file was modified.
    """
    if item.status_index is None:
        raise ValueError("item has no **Status:** line to change")
    # Re-read with surrogateescape so bytes that are not valid UTF-8 (a stray
    # Latin-1 byte in the reviewer's text) survive the rewrite untouched.  The
    # parse decoded them as U+FFFD, which splits lines identically, so
    # status_index / insert_index still point at the same lines.
    text, had_bom = read_text_raw(item.path, errors="surrogateescape")
    lines = text.splitlines(keepends=True)
    eol = "\r\n" if "\r\n" in text else "\n"

    def ending(line: str) -> str:
        if line.endswith("\r\n"):
            return "\r\n"
        if line.endswith("\n") or line.endswith("\r"):
            return line[-1]
        return ""

    changed = False
    old = lines[item.status_index]
    new = f"**Status:** {new_status}" + ending(old)
    if old != new:
        lines[item.status_index] = new
        changed = True

    if resolution is not None and resolution.strip():
        idx = item.insert_index if item.insert_index is not None else item.status_index
        anchor = lines[idx]
        if not ending(anchor):
            lines[idx] = anchor + eol
        body = normalise_newlines(resolution).strip().split("\n")
        block = [eol, f"**Resolution:** {body[0]}" + eol] + [line + eol for line in body[1:]]
        lines[idx + 1:idx + 1] = block
        changed = True

    if changed:
        write_text_raw(item.path, "".join(lines), bom=had_bom)
    return changed


# --------------------------------------------------------------------------- #
# Locate: normalisation, detex, matching
# --------------------------------------------------------------------------- #

_QUOTE_MAP = {
    "\u2018": "'", "\u2019": "'", "\u201a": "'", "\u2032": "'",
    "\u201c": '"', "\u201d": '"', "\u201e": '"', "\u2033": '"',
    "\u2013": "-", "\u2014": "-", "\u2212": "-", "\u2010": "-", "\u2011": "-",
    "\u00a0": " ", "\u2009": " ", "\u202f": " ", "\u2007": " ",
}
_DELETE_CHARS = "\u00ad\u200b\u200c\u200d\ufeff"
_HYPHEN_BREAK_RE = re.compile(r"-[ \t]*\n[ \t]*")
_NON_WORD_RE = re.compile(r"[^A-Za-z0-9'\s-]+")


def normalise_tokens(text: str) -> List[str]:
    text = unicodedata.normalize("NFKC", text)
    text = "".join(_QUOTE_MAP.get(ch, ch) for ch in text)
    text = "".join(ch for ch in text if ch not in _DELETE_CHARS)
    text = normalise_newlines(text)
    text = _HYPHEN_BREAK_RE.sub("", text)
    text = text.replace("\n", " ")
    text = _NON_WORD_RE.sub(" ", text)
    tokens = []
    for word in text.lower().split():
        word = word.replace("-", "").replace("'", "")
        # Single characters and bare numbers are almost always math residue
        # ("m", "f", "n", "0", "1", "h2" survives) - drop them on both sides.
        if len(word) < 2 or word.isdigit():
            continue
        tokens.append(word)
    return tokens


_DROP_CMDS = {
    "cite", "citep", "citet", "citealp", "ref", "eqref", "cref", "Cref", "autoref", "pageref",
    "label", "index", "vspace", "hspace", "includegraphics", "input", "include", "bibliography",
    "bibliographystyle", "usepackage", "documentclass", "newcommand", "renewcommand", "setlength",
    "pagestyle", "thispagestyle",
}
_DISPLAY_ENVS = {"equation", "align", "gather", "multline", "eqnarray", "displaymath", "alignat", "flalign"}
# "%" starts a comment unless escaped.  "\\%" is a line break *followed by* a
# comment, so only an odd number of preceding backslashes escapes it; the even
# run is captured and kept so the line-break rule below still sees it.
_COMMENT_RE = re.compile(r"(?<!\\)((?:\\\\)*)%.*$")
_LINEBREAK_RE = re.compile(r"\\\\\*?(\[[^\]]*\])?")  # \\  \\*  \\[2pt]
_INLINE_MATH_RE = re.compile(r"\$[^$]*\$|\\\([^)]*?\\\)")
_BEGIN_END_RE = re.compile(r"\\(begin|end)\{([A-Za-z*]+)\}")
_DROP_CMD_RE = re.compile(r"\\(" + "|".join(sorted(_DROP_CMDS, key=len, reverse=True)) + r")\*?(\[[^\]]*\])?(\{[^{}]*\})*")
_OTHER_CMD_RE = re.compile(r"\\([A-Za-z]+)\*?(\[[^\]]*\])?")
_SPACE_CMD_RE = re.compile(r"\\[,;! ]|~|\\quad|\\qquad")
_ESCAPED_RE = re.compile(r"\\([%&$#_{}])")


def detex_line(line: str) -> str:
    line = _COMMENT_RE.sub(r"\1", line)
    # Line breaks before other commands: otherwise "\\second" is eaten as \second.
    line = _LINEBREAK_RE.sub(" ", line)
    line = _INLINE_MATH_RE.sub(" ", line)
    line = _BEGIN_END_RE.sub(" ", line)
    line = _DROP_CMD_RE.sub(" ", line)
    line = _SPACE_CMD_RE.sub(" ", line)
    line = _ESCAPED_RE.sub(r"\1", line)
    line = _OTHER_CMD_RE.sub(" ", line)
    line = line.replace("---", "-").replace("--", "-")
    line = line.replace("``", '"').replace("''", '"')
    line = line.replace("{", "").replace("}", "").replace("\\", " ")
    return line


def tokenize_tex_text(text: str) -> List[Tuple[str, int]]:
    tokens: List[Tuple[str, int]] = []
    depth = 0
    for lineno, line in enumerate(text.splitlines(), start=1):
        code = _COMMENT_RE.sub(r"\1", line)
        opens = 0
        closes = 0
        for m in _BEGIN_END_RE.finditer(code):
            env = m.group(2).rstrip("*")
            if env in _DISPLAY_ENVS:
                if m.group(1) == "begin":
                    opens += 1
                else:
                    closes += 1
        # "\\[2pt]" is a line break with spacing, not display math: drop every
        # "\\" pair before looking for "\[" / "\]" (an unmatched opener would
        # otherwise hide the rest of the file).
        bare = code.replace("\\\\", "")
        opens += bare.count("\\[")
        closes += bare.count("\\]")
        if depth > 0 or opens > 0:
            depth = max(0, depth + opens - closes)
            continue
        for word in normalise_tokens(detex_line(line)):
            tokens.append((word, lineno))
    return tokens


def tokenize_tex_file(path: Path) -> List[Tuple[str, int]]:
    with open(path, encoding="utf-8-sig", errors="replace") as fh:
        return tokenize_tex_text(fh.read())


def iter_tex_files(root: Path) -> Iterable[Path]:
    for path in sorted(root.rglob("*.tex")):
        if any(part in SKIP_DIRS or part.startswith("_minted") for part in path.relative_to(root).parts[:-1]):
            continue
        try:
            if path.stat().st_size > MAX_TEX_BYTES:
                continue
        except OSError:
            continue
        yield path


def _score_file(query: List[str], tokens: List[Tuple[str, int]], min_score: float) -> List[dict]:
    words = [t[0] for t in tokens]
    n, L = len(words), len(query)
    if n == 0 or L == 0:
        return []
    found: List[Tuple[int, int, float]] = []
    # Fast path: exact contiguous occurrences.
    if n >= L:
        first = query[0]
        for i in range(n - L + 1):
            if words[i] == first and words[i:i + L] == query:
                found.append((i, i + L - 1, 1.0))
    if not found:
        qset = set(query)
        need = max(1, int(0.3 * len(qset) + 0.999))
        keep = min_score * 0.8  # near-misses stay for ranking; the verdict filters later
        seen = set()

        def score(a: int) -> Optional[float]:
            """ratio() of the window starting at token *a*, or None when gated out."""
            if a in seen:
                return None
            seen.add(a)
            window = words[a:a + L]
            if len(qset.intersection(window)) < need:
                return None
            sm = difflib.SequenceMatcher(None, query, window, autojunk=False)
            if sm.quick_ratio() < keep:  # upper bound on ratio() at O(L) cost
                return None
            s = sm.ratio()
            if s >= keep:
                found.append((a, min(a + L, n) - 1, s))
            return s

        if n < L:
            score(0)
        else:
            last = n - L
            # ratio() is O(L^2); scoring every start position makes a page-long
            # query cost O(n * L^2).  For long queries sample every `step`
            # positions, then score every position around a sample that comes
            # near the threshold.  A window shifted by d tokens keeps all but d
            # of the matched tokens, so a real match scores within step/L of
            # its best value at the nearest sample and is always refined.
            step = max(1, L // 40)
            starts = list(range(0, last + 1, step))
            if starts[-1] != last:
                starts.append(last)
            for a in starts:
                s = score(a)
                if s is not None and s >= keep - 0.1:
                    for c in range(max(0, a - step + 1), min(last, a + step - 1) + 1):
                        score(c)
    # Non-maximum suppression (ties broken by position, as before sampling).
    found.sort(key=lambda c: (-c[2], c[0]))
    kept: List[Tuple[int, int, float]] = []
    for cand in found:
        if any(not (cand[1] < k[0] or cand[0] > k[1]) for k in kept):
            continue
        kept.append(cand)
    return [
        {"start_tok": a, "end_tok": b, "score": round(s, 3),
         "line_start": tokens[a][1], "line_end": tokens[b][1]}
        for a, b, s in kept
    ]


def locate_text(query_tokens: List[str], root: Path, top: int = 3, min_score: float = 0.55,
                files: Optional[Iterable[Path]] = None) -> List[dict]:
    candidates: List[dict] = []
    for path in (files if files is not None else iter_tex_files(root)):
        try:
            tokens = tokenize_tex_file(path)
        except OSError:
            continue
        for cand in _score_file(query_tokens, tokens, min_score):
            cand["path"] = rel_posix(path, root)
            cand["abs_path"] = path
            candidates.append(cand)
    candidates.sort(key=lambda c: (-c["score"], c["path"], c["line_start"]))
    for cand in candidates[:top]:
        cand["snippet"] = _snippet(cand["abs_path"], cand["line_start"], cand["line_end"])
    return candidates


def _snippet(path: Path, start: int, end: int, cap: int = 15) -> str:
    try:
        with open(path, encoding="utf-8-sig", errors="replace") as fh:
            lines = fh.read().splitlines()
    except OSError:
        return ""
    out = []
    for n in range(start, min(end, start + cap - 1) + 1):
        if 1 <= n <= len(lines):
            out.append(f"{n:>5}: {lines[n - 1]}")
    if end - start + 1 > cap:
        out.append("       …")
    return "\n".join(out)


def verdict(candidates: Sequence[dict], n_query_words: int, min_score: float = 0.55) -> str:
    good = [c for c in candidates if c["score"] >= min_score]
    if not good:
        return "NOT FOUND"
    best = good[0]
    if n_query_words < 4:
        exact = [c for c in good if c["score"] >= 0.999]
        return "UNIQUE" if len(exact) == 1 else ("AMBIGUOUS" if exact else "NOT FOUND")
    if len(good) == 1:
        return "UNIQUE"
    runner = good[1]
    return "UNIQUE" if runner["score"] < best["score"] - 0.10 else "AMBIGUOUS"


def parse_source(source: str) -> Optional[Tuple[str, int]]:
    m = re.match(r"^(.*?):(\d+)$", source.strip())
    if not m:
        return None
    # Tolerate backslashes and a leading "./" (editor / SyncTeX output); the
    # candidate paths are relpath-normalised, so compare like with like.
    path = posixpath.normpath(m.group(1).replace("\\", "/"))
    return path, int(m.group(2))


def check_source(source: Optional[str], candidates: Sequence[dict], min_score: float, tolerance: int = 10) -> Optional[str]:
    if not source:
        return None
    parsed = parse_source(source)
    if not parsed:
        return "unparseable"
    path, line = parsed
    for cand in candidates:
        if cand["score"] < min_score:
            continue
        if cand["path"] == path and cand["line_start"] - tolerance <= line <= cand["line_end"] + tolerance:
            return "confirmed"
    return "drift"


def locate_item(query_text: str, root: Path, top: int, min_score: float, source: Optional[str] = None,
                files: Optional[Iterable[Path]] = None) -> dict:
    tokens = normalise_tokens(query_text)
    cands = locate_text(tokens, root, top=top, min_score=min_score, files=files)
    result = {
        "query_words": len(tokens),
        "verdict": verdict(cands, len(tokens), min_score),
        "candidates": [
            {k: v for k, v in c.items() if k not in ("abs_path", "start_tok", "end_tok")}
            for c in cands[:top]
        ],
        "source": source,
        "source_status": check_source(source, cands, min_score),
    }
    return result


# --------------------------------------------------------------------------- #
# Reporting helpers
# --------------------------------------------------------------------------- #


def counts(items: Sequence[Item]) -> Dict[str, int]:
    out = {s: 0 for s in STATUSES}
    for it in items:
        if it.status in out:
            out[it.status] += 1
    return out


def format_counts(c: Dict[str, int]) -> str:
    return f"{c['OPEN']} open, {c['DONE']} done, {c['WONTFIX']} wontfix"


def report_markdown(items: Sequence[Item], root: Path) -> str:
    c = counts(items)
    lines = ["# Review feedback report", "",
             f"Total: {len(items)} items — {c['OPEN']} OPEN, {c['DONE']} DONE, {c['WONTFIX']} WONTFIX", ""]
    if items:
        lines += ["| ID | Status | Source | Feedback | Resolution |", "|---|---|---|---|---|"]
        for it in items:
            res = first_line(it.resolution[-1]) if it.resolution else ""
            lines.append(f"| {it.id or it.heading_token} | {it.status or '?'} | {it.source or '-'} | "
                         f"{_cell(first_line(it.feedback))} | {_cell(res)} |")
        lines.append("")
    open_items = [it for it in items if it.status == "OPEN"]
    if open_items:
        lines.append("Still OPEN:")
        for it in open_items:
            lines.append(f"- {it.id or it.heading_token} — {first_line(it.feedback)} ({it.display_path(root)})")
    else:
        lines.append("Still OPEN: none")
    return "\n".join(lines) + "\n"


def _cell(text: str) -> str:
    return text.replace("|", "\\|")


# --------------------------------------------------------------------------- #
# Command implementations
# --------------------------------------------------------------------------- #


def cmd_init(args: argparse.Namespace, root: Path) -> int:
    target = Path(args.into).resolve() if args.into else root
    readme = target / ITEM_DIR / "README.md"
    if readme.exists():
        print(f"exists: {rel_posix(readme, Path.cwd())}")
        return 0
    ensure_item_dir(target)
    print(f"created: {rel_posix(readme, Path.cwd())}")
    return 0


def cmd_validate(args: argparse.Namespace, root: Path) -> int:
    items, problems = load_all(root)
    errors = [p for p in problems if p.level == "error"]
    warnings = [p for p in problems if p.level == "warning"]
    failed = bool(errors) or (args.strict and bool(warnings))
    if args.json:
        print(json.dumps({
            "ok": not failed,
            "items": len(items),
            "counts": counts(items),
            "problems": [p.__dict__ for p in problems],
        }, ensure_ascii=False, indent=2))
        return 1 if failed else 0
    for p in problems:
        print(p.format())
    if not failed:
        print(f"OK: {len(items)} items ({format_counts(counts(items))})")
        return 0
    print(f"FAILED: {len(errors)} errors, {len(warnings)} warnings")
    return 1


def _filter_status(items: Sequence[Item], status: str) -> List[Item]:
    status = status.upper()
    if status == "ALL":
        return list(items)
    return [it for it in items if it.status == status]


def cmd_list(args: argparse.Namespace, root: Path) -> int:
    items, _ = load_all(root)
    selected = _filter_status(items, args.status)
    if args.json:
        print(json.dumps([it.to_dict(root) for it in selected], ensure_ascii=False, indent=2))
        return 0
    if args.full:
        for it in selected:
            print(f"[{it.display_path(root)}]")
            print(it.raw)
            print()
        if not selected:
            print(f"no items with status {args.status.upper()}")
        return 0
    if not selected:
        print(f"no items with status {args.status.upper()}")
        return 0
    for it in selected:
        print(f"{(it.id or it.heading_token):<24} {(it.status or '?'):<8} {(it.source or '-'):<32} "
              f"{first_line(it.feedback, 40):<40}  | {first_line(it.pdf_text, 40)}")
    return 0


def cmd_show(args: argparse.Namespace, root: Path) -> int:
    items, _ = load_all(root)
    it = find_item(items, args.id)
    if not it:
        print(f"error: no item with ID {args.id}", file=sys.stderr)
        if args.json:
            print(json.dumps({"error": f"no item with ID {args.id}"}))
        return 1
    if args.json:
        print(json.dumps(it.to_dict(root), ensure_ascii=False, indent=2))
        return 0
    print(f"[{it.display_path(root)}]")
    print(it.raw)
    return 0


def cmd_add(args: argparse.Namespace, root: Path) -> int:
    if args.text_file:
        with open(args.text_file, encoding="utf-8-sig") as fh:
            text = fh.read()
    elif args.stdin:
        text = sys.stdin.read()
    else:
        text = args.text or ""
    device = None if args.no_device else (args.device or "desktop")
    item_id, path = add_item(root, text, args.comment, source=args.source, device=device)
    print(f"{item_id}  {rel_posix(path, root)}")
    return 0


def _cmd_status(args: argparse.Namespace, root: Path, new_status: str) -> int:
    items, _ = load_all(root)
    it = find_item(items, args.id)
    if not it:
        print(f"error: no item with ID {args.id}", file=sys.stderr)
        return 1
    if it.status_index is None:
        print(f"error: {it.display_path(root)} has no **Status:** line to change", file=sys.stderr)
        return 1
    resolution = getattr(args, "resolution", None)
    has_note = bool(resolution and resolution.strip())
    if it.status == new_status and not has_note:
        print(f"{args.id} is already {new_status}; nothing changed")
        return 0
    if new_status != "OPEN" and not has_note:
        print(f"error: {args.command} needs a non-empty --resolution (the schema requires one for {new_status})",
              file=sys.stderr)
        return 2
    change_status(it, new_status, resolution)
    if it.status == new_status:
        print(f"{args.id} is already {new_status}; added a resolution note  ({it.display_path(root)})")
    else:
        print(f"{args.id}: {it.status or '?'} -> {new_status}  ({it.display_path(root)})")
    return 0


def cmd_done(args: argparse.Namespace, root: Path) -> int:
    return _cmd_status(args, root, "DONE")


def cmd_wontfix(args: argparse.Namespace, root: Path) -> int:
    return _cmd_status(args, root, "WONTFIX")


def cmd_reopen(args: argparse.Namespace, root: Path) -> int:
    return _cmd_status(args, root, "OPEN")


def cmd_locate(args: argparse.Namespace, root: Path) -> int:
    targets: List[Tuple[str, str, Optional[str]]] = []  # (label, text, source)
    if args.text:
        targets.append(("(text)", args.text, None))
    if args.all or args.ids:
        items, _ = load_all(root)
        if args.all:
            targets.extend((it.id or it.heading_token, it.pdf_text, it.source) for it in items if it.status == "OPEN")
        for item_id in args.ids:
            it = find_item(items, item_id)
            if not it:
                print(f"error: no item with ID {item_id}", file=sys.stderr)
                continue
            targets.append((it.id or it.heading_token, it.pdf_text, it.source))
    if not targets:
        if args.json:
            print("[]")
        else:
            print("nothing to locate (no OPEN items)" if args.all else "nothing to locate (no such items)")
        return 0
    files = list(iter_tex_files(root))
    results = []
    for label, text, source in targets:
        res = locate_item(text, root, args.top, args.min_score, source=source, files=files)
        res["id"] = label
        res["preview"] = first_line(text, 70)
        results.append(res)
    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
        return 0
    for res in results:
        print(f"{res['id']}  {res['verdict']}   \"{res['preview']}\"")
        if res["source"]:
            status = res["source_status"]
            if status == "confirmed":
                print(f"  source: {res['source']} — confirmed")
            elif status == "drift":
                best = res["candidates"][0] if res["candidates"] else None
                where = f"{best['path']}:{best['line_start']}-{best['line_end']}" if best else "no match"
                print(f"  source: {res['source']} — DRIFT, best match at {where}")
            else:
                print(f"  source: {res['source']} — could not parse (expected path:line)")
        for cand in res["candidates"]:
            note = "" if cand["score"] >= args.min_score else "  (below threshold)"
            print(f"  {cand['path']}:{cand['line_start']}-{cand['line_end']}  score={cand['score']:.2f}{note}")
        if res["candidates"] and res["candidates"][0].get("snippet"):
            for line in res["candidates"][0]["snippet"].splitlines():
                print("    " + line)
        print()
    return 0


def cmd_report(args: argparse.Namespace, root: Path) -> int:
    items, _ = load_all(root)
    if args.json:
        print(json.dumps({"totals": counts(items), "items": [it.to_dict(root) for it in items]},
                         ensure_ascii=False, indent=2))
        return 0
    print(report_markdown(items, root), end="")
    return 0


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="feedback.py",
        description="Manage LaTeX review items (feedback/rev-*.md). See docs/CLI.md.",
    )
    parser.add_argument("--root", help="paper repository root (default: auto-detect from the current directory)")
    parser.add_argument("--json", action="store_true", help="machine-readable output where supported")
    parser.add_argument("--version", action="version", version=f"feedback.py {__version__}")
    sub = parser.add_subparsers(dest="command", metavar="<command>")
    sub.required = True

    p = sub.add_parser("init", help="create feedback/README.md")
    p.add_argument("--into", help="directory to initialise instead of the root")
    p.set_defaults(func=cmd_init)

    p = sub.add_parser("validate", help="check every item against the schema")
    p.add_argument("--strict", action="store_true", help="treat warnings as errors")
    p.set_defaults(func=cmd_validate)

    p = sub.add_parser("list", help="list items (default: OPEN)")
    p.add_argument("--status", default="OPEN", type=str.upper, choices=["OPEN", "DONE", "WONTFIX", "ALL"],
                   metavar="STATUS", help="OPEN, DONE, WONTFIX or ALL (default: OPEN)")
    p.add_argument("--full", action="store_true", help="print each item's raw block")
    p.set_defaults(func=cmd_list)

    p = sub.add_parser("show", help="print one item verbatim")
    p.add_argument("id")
    p.set_defaults(func=cmd_show)

    p = sub.add_parser("add", help="create a new item file")
    p.add_argument("--comment", required=True, help="reviewer comment (empty -> 'TODO: revise.')")
    src = p.add_mutually_exclusive_group()
    src.add_argument("--text", help="quoted PDF text")
    src.add_argument("--text-file", help="read the quoted PDF text from a file")
    src.add_argument("--stdin", action="store_true", help="read the quoted PDF text from stdin")
    p.add_argument("--source", help="source location, e.g. sections/intro.tex:42")
    dev = p.add_mutually_exclusive_group()
    dev.add_argument("--device", help="device stamp (default: desktop)")
    dev.add_argument("--no-device", action="store_true", help="omit the **Device:** line")
    p.set_defaults(func=cmd_add)

    p = sub.add_parser("done", help="mark an item DONE")
    p.add_argument("id")
    p.add_argument("--resolution", required=True, help="what changed and where")
    p.set_defaults(func=cmd_done)

    p = sub.add_parser("wontfix", help="mark an item WONTFIX")
    p.add_argument("id")
    p.add_argument("--resolution", required=True, help="why it is not addressed")
    p.set_defaults(func=cmd_wontfix)

    p = sub.add_parser("reopen", help="mark an item OPEN again")
    p.add_argument("id")
    p.add_argument("--resolution", help="optional note")
    p.set_defaults(func=cmd_reopen)

    p = sub.add_parser("locate", help="find quoted PDF text in the .tex sources")
    p.add_argument("ids", nargs="*", metavar="ID")
    p.add_argument("--text", help="locate this text instead of an item")
    p.add_argument("--all", action="store_true", help="every OPEN item")
    p.add_argument("--top", type=int, default=3)
    p.add_argument("--min-score", type=float, default=0.55)
    p.set_defaults(func=cmd_locate)

    p = sub.add_parser("report", help="Markdown summary of all items")
    p.set_defaults(func=cmd_report)
    return parser


def _configure_stdio() -> None:
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name)
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except (ValueError, io.UnsupportedOperation):
                pass


def main(argv: Optional[Sequence[str]] = None) -> int:
    _configure_stdio()
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command == "locate":
        if not (args.ids or args.text or args.all):
            parser.error("locate needs an ID, --text or --all")
        if args.top < 0:
            parser.error("--top must be 0 or more")
        if not 0.0 <= args.min_score <= 1.0:
            parser.error("--min-score must be between 0 and 1")
    root = Path(args.root).resolve() if args.root else find_root()
    if not root.is_dir():
        parser.error(f"--root {root} is not a directory")
    return args.func(args, root)


if __name__ == "__main__":
    sys.exit(main())

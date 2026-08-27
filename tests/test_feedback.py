"""Tests for scripts/feedback.py (unittest; pytest runs them too).

Run:  python -m unittest discover -s tests -v
"""

from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import os
import random
import shutil
import sys
import tempfile
import time
import unittest
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
SAMPLE = REPO / "examples" / "sample-paper"


def _load_module():
    spec = importlib.util.spec_from_file_location("feedback", REPO / "scripts" / "feedback.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module  # dataclasses need the module registered
    spec.loader.exec_module(module)
    return module


fb = _load_module()

MOBILE = """## Review rev-20260817-235221

**PDF text**
> We therefore conclude that the estimator is consistent uniformly over the
> unit interval, which is the sufficient condition required for the affine

**Feedback**
Need to justify why this convergence is uniform.

**Status:** OPEN
"""

TODO = """## Review rev-20260817-235430-41

**PDF text**
> a standard chaining argument over a grid of mesh h2 combined with Bernstein’s inequality

**Feedback**
TODO: revise.

**Status:** OPEN
"""

DESKTOP = """## Review rev-20260818-101502
**Source:** `sections/introduction.tex:9`
**Device:** desktop

**PDF text**
> Our goal is a self-contained proof that avoids the usual entropy calculations.

**Feedback**
"Self-contained" overpromises — we still cite Giné & Nickl for the maximal inequality.

**Status:** OPEN
"""

RESOLVED = """## Review rev-20260817-235221

**PDF text**
> We therefore conclude that the estimator is consistent uniformly over the
> unit interval, which is the sufficient condition required for the affine

**Feedback**
Need to justify why this convergence is uniform.

**Status:** DONE

**Resolution:** Added a sentence after the chaining step explaining that the
grid bound is uniform in x because the mesh is chosen independently of x
(sections/methodology.tex:27-29). Paper compiles.
"""

LEGACY = """# LaTeX Review Feedback

Review comments captured from desktop and mobile.

---

## Review 12

**ID:** `rev-20260817-235221`

**PDF text**
> first quoted line
> second quoted line

**Feedback**
Legacy comment line one.
Legacy comment line two.

**Status:** open

---

## Review rev-20260818-101502

**ID:** `rev-20260818-101502`
**Reviewed on:** 2026-08-18 10:15

**PDF text**
> another passage

**Feedback**
Second item.

**Status:** OPEN

---
"""


def write(path: Path, text: str, newline: str = "\n", bom: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = text.replace("\n", newline).encode("utf-8")
    if bom:
        data = b"\xef\xbb\xbf" + data
    path.write_bytes(data)


def run(argv, cwd: Path | None = None):
    """Run the CLI in-process; returns (exit_code, stdout, stderr)."""
    out, err = io.StringIO(), io.StringIO()
    old = Path.cwd()
    if cwd:
        os.chdir(cwd)
    try:
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            try:
                code = fb.main([str(a) for a in argv])
            except SystemExit as exc:  # argparse
                code = exc.code if isinstance(exc.code, int) else 2
    finally:
        os.chdir(old)
    return code, out.getvalue(), err.getvalue()


class TempRepo(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="fbtest-"))
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.repo = self.tmp / "paper"
        shutil.copytree(SAMPLE, self.repo)
        # Keep the sample's feedback/README.md only.
        for p in (self.repo / "feedback").glob("rev-*.md"):
            p.unlink()

    def item(self, name: str, text: str, **kw) -> Path:
        path = self.repo / "feedback" / name
        write(path, text, **kw)
        return path

    def load(self):
        return fb.load_all(self.repo)


# --------------------------------------------------------------------------- #
# Parsing
# --------------------------------------------------------------------------- #


class TestParse(TempRepo):
    def test_mobile_item(self):
        self.item("rev-20260817-235221.md", MOBILE)
        items, problems = self.load()
        self.assertEqual(len(items), 1)
        it = items[0]
        self.assertEqual(it.id, "rev-20260817-235221")
        self.assertEqual(it.status, "OPEN")
        self.assertIsNone(it.source)
        self.assertIsNone(it.device)
        self.assertEqual(len(it.pdf_lines), 2)
        self.assertTrue(it.pdf_text.startswith("We therefore conclude"))
        self.assertEqual(it.feedback, "Need to justify why this convergence is uniform.")
        self.assertEqual([p for p in problems if p.level == "error"], [])
        self.assertEqual(it.raw, MOBILE.rstrip("\n"))

    def test_todo_item_with_suffix(self):
        self.item("rev-20260817-235430-41.md", TODO)
        items, problems = self.load()
        self.assertEqual(items[0].id, "rev-20260817-235430-41")
        self.assertEqual(items[0].feedback, "TODO: revise.")
        self.assertEqual(problems, [])

    def test_desktop_item_with_source_and_device(self):
        self.item("rev-20260818-101502.md", DESKTOP)
        items, problems = self.load()
        it = items[0]
        self.assertEqual(it.source, "sections/introduction.tex:9")
        self.assertEqual(it.device, "desktop")
        self.assertIn("Giné", it.feedback)
        self.assertEqual(problems, [])

    def test_resolved_item(self):
        self.item("rev-20260817-235221.md", RESOLVED)
        items, problems = self.load()
        it = items[0]
        self.assertEqual(it.status, "DONE")
        self.assertEqual(len(it.resolution), 1)
        self.assertTrue(it.resolution[0].startswith("Added a sentence"))
        self.assertTrue(it.resolution[0].endswith("Paper compiles."))
        self.assertEqual(problems, [])

    def test_legacy_file(self):
        write(self.repo / "feedback.md", LEGACY)
        items, problems = self.load()
        self.assertEqual([it.id for it in items], ["rev-20260817-235221", "rev-20260818-101502"])
        first = items[0]
        self.assertEqual(first.container, "legacy")
        self.assertEqual(first.heading_token, "12")
        self.assertEqual(first.status, "OPEN")  # lower-case normalised
        self.assertEqual(first.pdf_lines, ["first quoted line", "second quoted line"])
        self.assertEqual(first.feedback, "Legacy comment line one.\nLegacy comment line two.")
        second = items[1]
        self.assertEqual(second.extra_fields, {"Reviewed on": "2026-08-18 10:15"})
        self.assertEqual([p for p in problems if p.level == "error"], [])
        self.assertTrue(any("unknown field" in p.message for p in problems))

    def test_blockquote_bare_marker_and_multiline_feedback(self):
        text = MOBILE.replace("> unit interval, which is the sufficient condition required for the affine",
                              ">\n> third line")
        text = text.replace("Need to justify why this convergence is uniform.",
                            "Line one.\n\nLine three after a blank.")
        self.item("rev-20260817-235221.md", text)
        items, problems = self.load()
        self.assertEqual(items[0].pdf_lines[1], "")
        self.assertEqual(items[0].pdf_lines[2], "third line")
        self.assertEqual(items[0].feedback, "Line one.\n\nLine three after a blank.")
        self.assertEqual([p for p in problems if p.level == "error"], [])

    def test_field_after_blockquote_is_recorded(self):
        # Optional fields may come in any order: a **Field:** line between the
        # blockquote and **Feedback** is read like one before **PDF text**.
        text = MOBILE.replace("> unit interval, which is the sufficient condition required for the affine\n",
                              "> unit interval, which is the sufficient condition required for the affine\n"
                              "**Source:** `sections/methodology.tex:24`\n**Reviewed on:** 2026-08-17 23:52\n")
        self.item("rev-20260817-235221.md", text)
        items, problems = self.load()
        it = items[0]
        self.assertEqual(it.source, "sections/methodology.tex:24")
        self.assertEqual(it.extra_fields, {"Reviewed on": "2026-08-17 23:52"})
        self.assertEqual(len(it.pdf_lines), 2)
        self.assertEqual(it.feedback, "Need to justify why this convergence is uniform.")
        self.assertEqual([p for p in problems if p.level == "error"], [])
        self.assertFalse(any("unexpected line" in p.message for p in problems))

    def test_resolution_continuation_that_looks_like_a_field(self):
        # Schema: a Resolution ends at the next **Field:** line; what follows
        # that field is not a continuation any more.
        text = RESOLVED.rstrip("\n") + "\n**Note:** looks like a field\nnot a continuation\n"
        self.item("rev-20260817-235221.md", text)
        items, problems = self.load()
        it = items[0]
        self.assertTrue(it.resolution[0].endswith("Paper compiles."))
        self.assertEqual(it.extra_fields, {"Note": "looks like a field"})
        self.assertTrue(any("unexpected line after **Status:**" in p.message for p in problems))
        self.assertEqual([p for p in problems if p.level == "error"], [])

    def test_status_line_inside_feedback_ends_feedback(self):
        text = MOBILE.replace("Need to justify why this convergence is uniform.",
                              "Comment.\n\n**Status:** DONE\nstray")
        self.item("rev-20260817-235221.md", text)
        items, problems = self.load()
        self.assertEqual(items[0].feedback, "Comment.")
        self.assertEqual(items[0].status, "DONE")  # the first Status line wins

    def test_crlf_and_bom_files_parse_with_warnings(self):
        self.item("rev-20260817-235221.md", MOBILE, newline="\r\n", bom=True)
        items, problems = self.load()
        self.assertEqual(items[0].id, "rev-20260817-235221")
        self.assertEqual(items[0].feedback, "Need to justify why this convergence is uniform.")
        msgs = " ".join(p.message for p in problems)
        self.assertIn("CRLF", msgs)
        self.assertIn("BOM", msgs)
        self.assertEqual([p for p in problems if p.level == "error"], [])

    def test_heading_without_id_line_is_error(self):
        self.item("rev-20260817-235221.md", MOBILE.replace("## Review rev-20260817-235221", "## Review 12"))
        items, problems = self.load()
        self.assertIsNone(items[0].id)
        self.assertTrue(any(p.level == "error" and "cannot resolve an ID" in p.message for p in problems))

    def test_id_line_disagreeing_with_heading_warns_and_heading_wins(self):
        text = MOBILE.replace("\n\n**PDF text**", "\n**ID:** `rev-20260101-000000`\n\n**PDF text**", 1)
        self.item("rev-20260817-235221.md", text)
        items, problems = self.load()
        self.assertEqual(items[0].id, "rev-20260817-235221")
        self.assertTrue(any("disagrees" in p.message for p in problems))


# --------------------------------------------------------------------------- #
# validate
# --------------------------------------------------------------------------- #


class TestValidate(TempRepo):
    def test_readme_only_is_ok(self):
        code, out, _ = run(["--root", self.repo, "validate"])
        self.assertEqual(code, 0)
        self.assertIn("OK: 0 items", out)

    def test_ok_with_items(self):
        self.item("rev-20260817-235221.md", MOBILE)
        self.item("rev-20260818-101502.md", DESKTOP)
        code, out, _ = run(["--root", self.repo, "validate"])
        self.assertEqual(code, 0, out)
        self.assertIn("OK: 2 items (2 open, 0 done, 0 wontfix)", out)

    def test_duplicate_ids_across_containers(self):
        self.item("rev-20260817-235221.md", MOBILE)
        write(self.repo / "feedback.md", LEGACY)
        code, out, _ = run(["--root", self.repo, "validate"])
        self.assertEqual(code, 1)
        self.assertIn("duplicate ID rev-20260817-235221", out)

    def test_bad_id(self):
        self.item("rev-2026-1.md", MOBILE.replace("rev-20260817-235221", "rev-2026-1"))
        code, out, _ = run(["--root", self.repo, "validate"])
        self.assertEqual(code, 1)
        self.assertIn("cannot resolve an ID", out)

    def test_empty_pdf_text(self):
        text = MOBILE.replace("> We therefore conclude that the estimator is consistent uniformly over the\n", "")
        text = text.replace("> unit interval, which is the sufficient condition required for the affine\n", "")
        self.item("rev-20260817-235221.md", text)
        code, out, _ = run(["--root", self.repo, "validate"])
        self.assertEqual(code, 1)
        self.assertIn("empty **PDF text**", out)

    def test_bad_status(self):
        self.item("rev-20260817-235221.md", MOBILE.replace("**Status:** OPEN", "**Status:** PENDING"))
        code, out, _ = run(["--root", self.repo, "validate"])
        self.assertEqual(code, 1)
        self.assertIn("invalid status", out)

    def test_done_without_resolution(self):
        self.item("rev-20260817-235221.md", MOBILE.replace("**Status:** OPEN", "**Status:** DONE"))
        code, out, _ = run(["--root", self.repo, "validate"])
        self.assertEqual(code, 1)
        self.assertIn("requires a **Resolution:**", out)

    def test_filename_mismatch_is_warning_then_strict_error(self):
        self.item("rev-20260101-000000.md", MOBILE)
        code, out, _ = run(["--root", self.repo, "validate"])
        self.assertEqual(code, 0)
        self.assertIn("does not match ID", out)
        code, out, _ = run(["--root", self.repo, "validate", "--strict"])
        self.assertEqual(code, 1)

    def test_missing_final_newline_and_two_items_warn(self):
        self.item("rev-20260817-235221.md", MOBILE.rstrip("\n") + "\n\n" + TODO.rstrip("\n"))
        code, out, _ = run(["--root", self.repo, "validate"])
        self.assertEqual(code, 0, out)
        self.assertIn("does not end with a newline", out)
        self.assertIn("2 items in one file", out)

    def test_empty_file_is_error(self):
        (self.repo / "feedback" / "rev-20260817-235221.md").write_bytes(b"")
        code, out, _ = run(["--root", self.repo, "validate"])
        self.assertEqual(code, 1)
        self.assertIn("no review item found", out)

    def test_json_output(self):
        self.item("rev-20260817-235221.md", MOBILE)
        code, out, _ = run(["--root", self.repo, "--json", "validate"])
        data = json.loads(out)
        self.assertTrue(data["ok"])
        self.assertEqual(data["items"], 1)
        self.assertEqual(data["counts"]["OPEN"], 1)


# --------------------------------------------------------------------------- #
# add
# --------------------------------------------------------------------------- #


class TestAdd(TempRepo):
    def test_add_creates_directory_and_readme(self):
        shutil.rmtree(self.repo / "feedback")
        item_id, path = fb.add_item(self.repo, "quoted text", "a comment", now=datetime(2026, 8, 17, 23, 52, 21))
        self.assertEqual(item_id, "rev-20260817-235221")
        self.assertTrue((self.repo / "feedback" / "README.md").exists())
        self.assertEqual(path.read_text(encoding="utf-8"),
                         "## Review rev-20260817-235221\n**Device:** desktop\n\n**PDF text**\n> quoted text\n\n"
                         "**Feedback**\na comment\n\n**Status:** OPEN\n")

    def test_collision_gets_suffix(self):
        now = datetime(2026, 8, 17, 23, 52, 21)
        rng = random.Random(1)
        a, _ = fb.add_item(self.repo, "one", "c", now=now, rng=rng)
        b, _ = fb.add_item(self.repo, "two", "c", now=now, rng=rng)
        self.assertEqual(a, "rev-20260817-235221")
        self.assertRegex(b, r"^rev-20260817-235221-[a-z0-9]{2}$")
        code, out, _ = run(["--root", self.repo, "validate"])
        self.assertEqual(code, 0, out)

    def test_empty_comment_and_text(self):
        _, path = fb.add_item(self.repo, "   ", "  \n ", device=None)
        text = path.read_text(encoding="utf-8")
        self.assertIn("> (no text selected)", text)
        self.assertIn("**Feedback**\nTODO: revise.\n", text)
        self.assertNotIn("**Device:**", text)

    def test_multiline_text_blockquoted_and_normalised(self):
        _, path = fb.add_item(self.repo, "line one\r\nline two\rline three\u2028line four  \n", "c")
        text = path.read_text(encoding="utf-8")
        self.assertIn("> line one\n> line two\n> line three\n> line four\n", text)
        self.assertNotIn("\r", text)

    def test_cli_add_with_source_and_no_device(self):
        code, out, _ = run(["--root", self.repo, "add", "--comment", "Fix", "--text", "Our goal is",
                            "--source", "sections/introduction.tex:9", "--no-device"])
        self.assertEqual(code, 0)
        item_id = out.split()[0]
        text = (self.repo / "feedback" / f"{item_id}.md").read_text(encoding="utf-8")
        self.assertIn("**Source:** `sections/introduction.tex:9`", text)
        self.assertNotIn("**Device:**", text)
        self.assertIn("\n\n**PDF text**", text)

    def test_cli_add_text_file_and_stdin(self):
        src = self.tmp / "sel.txt"
        src.write_text("from a file", encoding="utf-8")
        code, out, _ = run(["--root", self.repo, "add", "--comment", "c", "--text-file", src])
        self.assertEqual(code, 0)
        self.assertIn("> from a file", (self.repo / "feedback" / f"{out.split()[0]}.md").read_text(encoding="utf-8"))


# --------------------------------------------------------------------------- #
# done / wontfix / reopen
# --------------------------------------------------------------------------- #


class TestStatus(TempRepo):
    def test_done_changes_only_status_and_adds_resolution(self):
        path = self.item("rev-20260817-235221.md", MOBILE)
        code, out, _ = run(["--root", self.repo, "done", "rev-20260817-235221", "--resolution", "Fixed it."])
        self.assertEqual(code, 0, out)
        expected = MOBILE.replace("**Status:** OPEN\n", "**Status:** DONE\n\n**Resolution:** Fixed it.\n")
        self.assertEqual(path.read_text(encoding="utf-8"), expected)
        code, out, _ = run(["--root", self.repo, "validate"])
        self.assertEqual(code, 0, out)

    def test_crlf_and_bom_preserved(self):
        path = self.item("rev-20260817-235221.md", MOBILE, newline="\r\n", bom=True)
        before = path.read_bytes()
        code, _, _ = run(["--root", self.repo, "done", "rev-20260817-235221", "--resolution", "Done."])
        self.assertEqual(code, 0)
        after = path.read_bytes()
        self.assertTrue(after.startswith(b"\xef\xbb\xbf"))
        self.assertNotIn(b"\n", after.replace(b"\r\n", b""))  # every newline is CRLF
        expected = before.replace(b"**Status:** OPEN\r\n", b"**Status:** DONE\r\n\r\n**Resolution:** Done.\r\n")
        self.assertEqual(after, expected)

    def test_second_resolution_appended_after_first(self):
        path = self.item("rev-20260817-235221.md", RESOLVED)
        code, _, _ = run(["--root", self.repo, "reopen", "rev-20260817-235221"])
        self.assertEqual(code, 0)
        code, _, _ = run(["--root", self.repo, "done", "rev-20260817-235221", "--resolution", "Second pass."])
        self.assertEqual(code, 0)
        text = path.read_text(encoding="utf-8")
        self.assertEqual(text, RESOLVED.rstrip("\n") + "\n\n**Resolution:** Second pass.\n")
        items, _ = self.load()
        self.assertEqual(items[0].resolution[1], "Second pass.")

    def test_multiline_resolution(self):
        path = self.item("rev-20260817-235221.md", MOBILE)
        fb.change_status(self.load()[0][0], "DONE", "line one\nline two")
        self.assertIn("**Status:** DONE\n\n**Resolution:** line one\nline two\n", path.read_text(encoding="utf-8"))
        items, problems = self.load()
        self.assertEqual(items[0].resolution, ["line one\nline two"])
        self.assertEqual([p for p in problems if p.level == "error"], [])

    def test_done_on_file_without_trailing_newline(self):
        path = self.item("rev-20260817-235221.md", MOBILE.rstrip("\n"))
        code, _, _ = run(["--root", self.repo, "done", "rev-20260817-235221", "--resolution", "ok"])
        self.assertEqual(code, 0)
        self.assertTrue(path.read_text(encoding="utf-8").endswith("**Status:** DONE\n\n**Resolution:** ok\n"))

    def test_unknown_id_and_missing_resolution(self):
        self.item("rev-20260817-235221.md", MOBILE)
        code, _, err = run(["--root", self.repo, "done", "rev-00000000-000000", "--resolution", "x"])
        self.assertEqual(code, 1)
        self.assertIn("no item", err)
        code, _, err = run(["--root", self.repo, "wontfix", "rev-20260817-235221"])
        self.assertEqual(code, 2)

    def test_done_twice_is_idempotent(self):
        path = self.item("rev-20260817-235221.md", RESOLVED)
        before = path.read_bytes()
        code, out, _ = run(["--root", self.repo, "done", "rev-20260817-235221", "--resolution", ""])
        self.assertEqual(code, 0)
        self.assertIn("already DONE", out)
        self.assertEqual(path.read_bytes(), before)

    def test_resolution_inserted_after_continuation_lines(self):
        # The insert anchor is the last continuation line of the last Resolution,
        # even when a blank line separates it from the rest.
        text = RESOLVED.rstrip("\n") + "\n\nA paragraph that continues the resolution.\n"
        path = self.item("rev-20260817-235221.md", text)
        code, _, _ = run(["--root", self.repo, "reopen", "rev-20260817-235221", "--resolution", "Reopened."])
        self.assertEqual(code, 0)
        self.assertEqual(path.read_text(encoding="utf-8"),
                         text.replace("**Status:** DONE", "**Status:** OPEN") + "\n**Resolution:** Reopened.\n")
        items, problems = self.load()
        self.assertTrue(items[0].resolution[0].endswith("A paragraph that continues the resolution."))
        self.assertEqual(items[0].resolution[-1], "Reopened.")
        self.assertEqual([p for p in problems if p.level == "error"], [])

    def test_done_on_crlf_file_whose_status_line_is_last_without_newline(self):
        path = self.item("rev-20260817-235221.md", MOBILE.rstrip("\n"), newline="\r\n")
        code, _, _ = run(["--root", self.repo, "done", "rev-20260817-235221", "--resolution", "ok"])
        self.assertEqual(code, 0)
        after = path.read_bytes()
        self.assertTrue(after.endswith(b"**Status:** DONE\r\n\r\n**Resolution:** ok\r\n"))
        self.assertNotIn(b"\n", after.replace(b"\r\n", b""))

    def test_wontfix_and_legacy_file_other_items_untouched(self):
        path = self.repo / "feedback.md"
        write(path, LEGACY)
        before = path.read_text(encoding="utf-8")
        code, _, _ = run(["--root", self.repo, "wontfix", "rev-20260818-101502", "--resolution", "Out of scope."])
        self.assertEqual(code, 0)
        after = path.read_text(encoding="utf-8")
        expected = before.replace("Second item.\n\n**Status:** OPEN\n",
                                  "Second item.\n\n**Status:** WONTFIX\n\n**Resolution:** Out of scope.\n")
        self.assertEqual(after, expected)
        items, _ = self.load()
        self.assertEqual(items[0].status, "OPEN")
        self.assertEqual(items[1].status, "WONTFIX")

    def test_unknown_field_preserved_by_done(self):
        text = MOBILE.replace("## Review rev-20260817-235221\n", "## Review rev-20260817-235221\n**Page:** 4\n")
        path = self.item("rev-20260817-235221.md", text)
        run(["--root", self.repo, "done", "rev-20260817-235221", "--resolution", "r"])
        self.assertIn("**Page:** 4\n", path.read_text(encoding="utf-8"))


# --------------------------------------------------------------------------- #
# locate
# --------------------------------------------------------------------------- #


class TestLocate(TempRepo):
    def locate(self, text, **kw):
        return fb.locate_item(text, self.repo, kw.get("top", 3), kw.get("min_score", 0.55), source=kw.get("source"))

    def assertUnique(self, res, path, line_lo, line_hi):
        self.assertEqual(res["verdict"], "UNIQUE", res)
        best = res["candidates"][0]
        self.assertEqual(best["path"], path)
        self.assertGreaterEqual(best["line_start"], line_lo)
        self.assertLessEqual(best["line_end"], line_hi)

    def test_exact_sentence(self):
        res = self.locate("We therefore conclude that the estimator is consistent uniformly over the unit interval")
        self.assertUnique(res, "sections/methodology.tex", 20, 30)
        self.assertEqual(res["candidates"][0]["score"], 1.0)

    def test_pdftotext_garbage(self):
        res = self.locate("a standard chaining argument over a grid of mesh ℎ2 combined with Bernstein’s inequality yields the rate")
        self.assertUnique(res, "sections/methodology.tex", 20, 30)

    def test_hyphenated_line_breaks(self):
        res = self.locate("which is the suffi-\ncient condition required for the affine correc-\ntion step")
        self.assertUnique(res, "sections/methodology.tex", 20, 30)
        self.assertEqual(res["candidates"][0]["score"], 1.0)

    def test_ligature_glyphs(self):
        res = self.locate("establish suﬃcient conditions for its uniform consistency. The analysis is eﬃcient")
        self.assertUnique(res, "main.tex", 20, 35)

    def test_prose_around_inline_math(self):
        res = self.locate("Suppose m is Lipschitz, f is bounded away from zero on [0, 1], and nh/ log n → ∞")
        self.assertUnique(res, "sections/methodology.tex", 8, 16)
        self.assertGreater(res["candidates"][0]["score"], 0.7)

    def test_short_query_not_unique(self):
        self.assertNotEqual(self.locate("affine")["verdict"], "UNIQUE")
        self.assertEqual(self.locate("chaining argument")["verdict"], "UNIQUE")  # exact and single

    def test_not_found(self):
        self.assertEqual(self.locate("quantum chromodynamics on the lattice")["verdict"], "NOT FOUND")
        self.assertEqual(self.locate("������ℎ")["verdict"], "NOT FOUND")
        self.assertEqual(self.locate("")["verdict"], "NOT FOUND")

    def test_ambiguous_when_duplicated(self):
        dup = self.repo / "sections" / "appendix.tex"
        dup.write_text("\\section{Appendix}\nWe therefore conclude that the estimator is consistent uniformly "
                       "over the unit interval, which is the sufficient condition.\n", encoding="utf-8")
        res = self.locate("We therefore conclude that the estimator is consistent uniformly over the unit interval")
        self.assertEqual(res["verdict"], "AMBIGUOUS")

    def test_comments_and_display_math_and_input_ignored(self):
        extra = self.repo / "sections" / "extra.tex"
        extra.write_text("% the secret phrase lives only in a comment\n"
                         "\\begin{equation}\nthe secret phrase lives inside display math\n\\end{equation}\n"
                         "\\input{sections/introduction}\n", encoding="utf-8")
        self.assertEqual(self.locate("the secret phrase lives only in a comment")["verdict"], "NOT FOUND")
        self.assertEqual(self.locate("the secret phrase lives inside display math")["verdict"], "NOT FOUND")
        self.assertEqual(fb.tokenize_tex_text("\\input{sections/introduction}\n"), [])

    def test_linebreak_with_spacing_is_not_display_math(self):
        # "\\[2pt]" is a line break; it used to count as a "\[" opener and hide
        # every later line of the file from locate.
        tex = ("\\begin{tabular}{ll}\na & b \\\\[2pt]\nc & d\n\\end{tabular}\n"
               "Prose after the table survives.\n\\[\n x = y \n\\]\nProse after real display math too.\n")
        words = [w for w, _ in fb.tokenize_tex_text(tex)]
        self.assertIn("survives", words)
        self.assertIn("too", words)
        self.assertNotIn("2pt", words)
        # A genuine display-math block is still skipped.
        self.assertEqual([w for w, _ in fb.tokenize_tex_text("\\[\nthe secret phrase\n\\]\nafter\n")], ["after"])

    def test_detex_double_backslash(self):
        # "\\second" is a line break followed by a word, not the command \second.
        self.assertEqual(fb.normalise_tokens(fb.detex_line(r"first line\\second line")),
                         ["first", "line", "second", "line"])
        self.assertEqual(fb.normalise_tokens(fb.detex_line(r"row one \\[2pt] row two \\* row three")),
                         ["row", "one", "row", "two", "row", "three"])
        # "\\%" is a line break followed by a comment; "\%" is an escaped percent.
        self.assertEqual(fb.normalise_tokens(fb.detex_line(r"kept \\% dropped comment")), ["kept"])
        self.assertEqual(fb.normalise_tokens(fb.detex_line(r"kept 100\% also kept % dropped")),
                         ["kept", "also", "kept"])

    def test_source_confirmed_and_drift(self):
        q = "Our goal is a self-contained proof that avoids the usual entropy calculations."
        self.assertEqual(self.locate(q, source="sections/introduction.tex:7")["source_status"], "confirmed")
        self.assertEqual(self.locate(q, source="sections/introduction.tex:60")["source_status"], "drift")
        self.assertEqual(self.locate(q, source="sections/methodology.tex:7")["source_status"], "drift")

    def test_long_query_is_fast(self):
        words = ("uniform consistency of the kernel estimator under weak moment conditions " * 250).split()
        start = time.time()
        res = self.locate(" ".join(words))
        self.assertLess(time.time() - start, 10.0)
        self.assertIn(res["verdict"], ("NOT FOUND", "AMBIGUOUS", "UNIQUE"))

    def test_no_tex_files(self):
        empty = self.tmp / "empty"
        empty.mkdir()
        code, out, _ = run(["--root", empty, "locate", "--text", "anything at all here"])
        self.assertEqual(code, 0)
        self.assertIn("NOT FOUND", out)

    def test_cli_all_and_json(self):
        self.item("rev-20260817-235221.md", MOBILE)
        self.item("rev-20260818-101502.md", DESKTOP)
        code, out, _ = run(["--root", self.repo, "locate", "--all"])
        self.assertEqual(code, 0)
        self.assertIn("rev-20260817-235221  UNIQUE", out)
        self.assertIn("source: sections/introduction.tex:9 — confirmed", out)
        code, out, _ = run(["--root", self.repo, "--json", "locate", "--all"])
        data = json.loads(out)
        self.assertEqual({d["id"] for d in data}, {"rev-20260817-235221", "rev-20260818-101502"})
        self.assertEqual(set(data[0].keys()) >= {"id", "verdict", "candidates", "source", "source_status"}, True)
        self.assertEqual(set(data[0]["candidates"][0].keys()) >= {"path", "line_start", "line_end", "score", "snippet"}, True)

    def test_cli_requires_target(self):
        code, _, _ = run(["--root", self.repo, "locate"])
        self.assertEqual(code, 2)

    def test_detex_line(self):
        self.assertEqual(fb.normalise_tokens(fb.detex_line(r"\emph{Uniform} rates \cite{a,b} are \textbf{hard}~to get (see~\ref{x}) 100\% ``quoted''.")),
                         ["uniform", "rates", "are", "hard", "to", "get", "see", "quoted"])
        self.assertEqual(fb.normalise_tokens(fb.detex_line(r"\section*{Intro} Let $x$ be \(y\) fine. % comment here")),
                         ["intro", "let", "be", "fine"])


# --------------------------------------------------------------------------- #
# list / show / report / discovery
# --------------------------------------------------------------------------- #


class TestListReport(TempRepo):
    def setUp(self):
        super().setUp()
        self.item("rev-20260817-235221.md", RESOLVED)
        self.item("rev-20260817-235430-41.md", TODO)
        self.item("rev-20260818-101502.md", DESKTOP)

    def test_list_default_open(self):
        code, out, _ = run(["--root", self.repo, "list"])
        self.assertEqual(code, 0)
        self.assertNotIn("rev-20260817-235221 ", out)
        self.assertIn("rev-20260817-235430-41", out)
        self.assertIn("sections/introduction.tex:9", out)

    def test_list_all_case_insensitive_and_order(self):
        code, out, _ = run(["--root", self.repo, "list", "--status", "all"])
        self.assertEqual(code, 0)
        ids = [line.split()[0] for line in out.splitlines()]
        self.assertEqual(ids, ["rev-20260817-235221", "rev-20260817-235430-41", "rev-20260818-101502"])

    def test_list_full_and_json(self):
        code, out, _ = run(["--root", self.repo, "list", "--full"])
        self.assertIn("[feedback/rev-20260817-235430-41.md]", out)
        self.assertIn("**Status:** OPEN", out)
        code, out, _ = run(["--root", self.repo, "--json", "list", "--status", "ALL"])
        data = json.loads(out)
        self.assertEqual(len(data), 3)
        self.assertEqual(data[0]["resolution"][0][:16], "Added a sentence")
        for key in ("id", "status", "source", "device", "pdf_text", "feedback", "resolution", "path", "line_start", "line_end", "extra_fields"):
            self.assertIn(key, data[0])

    def test_show(self):
        code, out, _ = run(["--root", self.repo, "show", "rev-20260818-101502"])
        self.assertEqual(code, 0)
        self.assertTrue(out.startswith("[feedback/rev-20260818-101502.md]\n## Review rev-20260818-101502\n"))
        self.assertEqual(run(["--root", self.repo, "show", "rev-1"])[0], 1)

    def test_report(self):
        code, out, _ = run(["--root", self.repo, "report"])
        self.assertEqual(code, 0)
        self.assertIn("Total: 3 items — 2 OPEN, 1 DONE, 0 WONTFIX", out)
        self.assertIn("| rev-20260817-235221 | DONE |", out)
        self.assertIn("Still OPEN:\n- rev-20260817-235430-41", out)
        code, out, _ = run(["--root", self.repo, "--json", "report"])
        data = json.loads(out)
        self.assertEqual(data["totals"], {"OPEN": 2, "DONE": 1, "WONTFIX": 0})

    def test_find_root_walks_up_and_env_override(self):
        nested = self.repo / "sections"
        self.assertEqual(fb.find_root(nested), self.repo.resolve())
        old = os.environ.get("FEEDBACK_ROOT")
        os.environ["FEEDBACK_ROOT"] = str(self.tmp)
        try:
            self.assertEqual(fb.find_root(nested), self.tmp.resolve())
        finally:
            if old is None:
                del os.environ["FEEDBACK_ROOT"]
            else:
                os.environ["FEEDBACK_ROOT"] = old

    def test_init(self):
        target = self.tmp / "other"
        target.mkdir()
        code, out, _ = run(["--root", self.repo, "init", "--into", target])
        self.assertEqual(code, 0)
        self.assertTrue((target / "feedback" / "README.md").exists())
        code, out, _ = run(["--root", self.repo, "init", "--into", target])
        self.assertIn("exists", out)


if __name__ == "__main__":
    unittest.main()


class TestUsageGuards(TempRepo):
    """Regressions for usage errors and escaping added after the adversarial review."""

    def test_unknown_status_is_usage_error(self):
        code, _, err = run(["--root", self.repo, "list", "--status", "bogus"])
        self.assertEqual(code, 2)
        code, out, _ = run(["--root", self.repo, "list", "--status", "all"])
        self.assertEqual(code, 0)

    def test_missing_root_is_usage_error(self):
        code, _, _ = run(["--root", self.tmp / "nope", "validate"])
        self.assertEqual(code, 2)

    def test_negative_top_and_bad_min_score(self):
        self.assertEqual(run(["--root", self.repo, "locate", "--text", "x y z", "--top", "-1"])[0], 2)
        self.assertEqual(run(["--root", self.repo, "locate", "--text", "x y z", "--min-score", "1.5"])[0], 2)

    def test_json_show_unknown_emits_json_error(self):
        code, out, _ = run(["--root", self.repo, "--json", "show", "rev-00000000-000000"])
        self.assertEqual(code, 1)
        self.assertIn("error", json.loads(out))

    def test_empty_optional_field_warns(self):
        self.item("rev-20260817-235221.md", MOBILE.replace("## Review rev-20260817-235221\n",
                                                            "## Review rev-20260817-235221\n**Device:**\n"))
        code, out, _ = run(["--root", self.repo, "validate"])
        self.assertEqual(code, 0, out)
        self.assertIn("empty **Device:** field", out)

    def test_add_escapes_structural_comment_lines(self):
        _, path = fb.add_item(self.repo, "quote", "**Status:** DONE\n## Review 9\n**Feedback**\nreal text")
        text = path.read_text(encoding="utf-8")
        self.assertIn("\**Status:** DONE\n\## Review 9\n\**Feedback**\nreal text", text)
        code, out, _ = run(["--root", self.repo, "validate"])
        self.assertEqual(code, 0, out)
        items, _ = self.load()
        self.assertEqual(items[0].status, "OPEN")
        self.assertTrue(items[0].feedback.endswith("real text"))

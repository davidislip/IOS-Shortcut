"""Adversarial edge-case tests for scripts/feedback.py (unittest; pytest runs them too).

Every test works in a private temporary copy of examples/sample-paper and never
touches the repository.  Run:  python -m unittest discover -s tests -v
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

EXACT_SENTENCE = "We therefore conclude that the estimator is consistent uniformly over the unit interval"
FUZZY_SENTENCE = "Suppose m is Lipschitz, f is bounded away from zero on [0, 1], and nh/ log n → ∞"
INTRO_SENTENCE = "Our goal is a self-contained proof that avoids the usual entropy calculations."

# Display-math environment whose \begin and \end lines also carry prose.
ALIGN_TEX = (
    "Before the display we say something quite specific here.\n"
    "The estimator is defined by the display \\begin{align*}\n"
    " x &= y \\\\\n"
    " y &= z\n"
    "\\end{align*} and the prose right after the end marker is lost.\n"
    "But the very next line of prose is still matched normally.\n"
)


def write(path: Path, text: str, newline: str = "\n", bom: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = text.replace("\n", newline).encode("utf-8")
    if bom:
        data = b"\xef\xbb\xbf" + data
    path.write_bytes(data)


def run(argv, cwd: Path | None = None, stdin: str | None = None):
    """Run the CLI in-process; returns (exit_code, stdout, stderr)."""
    out, err = io.StringIO(), io.StringIO()
    old_cwd = Path.cwd()
    old_stdin = sys.stdin
    if cwd:
        os.chdir(cwd)
    if stdin is not None:
        sys.stdin = io.StringIO(stdin)
    try:
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            try:
                code = fb.main([str(a) for a in argv])
            except SystemExit as exc:  # argparse
                code = exc.code if isinstance(exc.code, int) else 2
    finally:
        os.chdir(old_cwd)
        sys.stdin = old_stdin
    return code, out.getvalue(), err.getvalue()


class TempRepo(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="fbedge-"))
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.repo = self.tmp / "paper"
        shutil.copytree(SAMPLE, self.repo)
        for p in (self.repo / "feedback").glob("rev-*.md"):
            p.unlink()

    def item(self, name: str, text: str, **kw) -> Path:
        path = self.repo / "feedback" / name
        write(path, text, **kw)
        return path

    def load(self):
        return fb.load_all(self.repo)

    def errors(self, problems):
        return [p for p in problems if p.level == "error"]

    def validate(self, *extra):
        return run(["--root", self.repo, "validate", *extra])


# --------------------------------------------------------------------------- #
# Parsing edge cases
# --------------------------------------------------------------------------- #


class TestParseEdge(TempRepo):
    def test_fenced_status_open_inside_feedback_ends_feedback_and_still_validates(self):
        # Schema: the feedback runs "up to the **Status:** line" - a Status line
        # inside a fenced code block is still the first Status line.
        text = MOBILE.replace("Need to justify why this convergence is uniform.",
                              "Comment before the fence.\n```md\n**Status:** OPEN\n```\nComment after the fence.")
        self.item("rev-20260817-235221.md", text)
        items, problems = self.load()
        it = items[0]
        self.assertEqual(it.status, "OPEN")
        self.assertTrue(it.feedback.startswith("Comment before the fence."))
        self.assertNotIn("Comment after the fence.", it.feedback)
        self.assertEqual(self.errors(problems), [])
        code, out, _ = self.validate()
        self.assertEqual(code, 0, out)
        self.assertIn("second **Status:** line ignored", out)
        self.assertIn("unexpected line after **Status:**", out)

    def test_fenced_status_done_inside_feedback_becomes_the_status(self):
        text = MOBILE.replace("Need to justify why this convergence is uniform.",
                              "Comment.\n```md\n**Status:** DONE\n```\nMore comment.")
        self.item("rev-20260817-235221.md", text)
        items, _ = self.load()
        self.assertEqual(items[0].status, "DONE")
        self.assertEqual(items[0].feedback, "Comment.\n```md")
        code, out, _ = self.validate()
        self.assertEqual(code, 1)
        self.assertIn("requires a **Resolution:**", out)
        self.assertIn("second **Status:** line ignored", out)

    def test_review_like_lines_in_feedback_that_are_not_headings(self):
        # HEADING_RE needs exactly "## Review <one-token>": these three must not split the item.
        comment = ("Comment.\n## Reviewer note: see above\n## Review this carefully please\n"
                   "## Review\nStill the same comment.")
        self.item("rev-20260817-235221.md", MOBILE.replace("Need to justify why this convergence is uniform.", comment))
        items, problems = self.load()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].feedback, comment)
        self.assertEqual(items[0].status, "OPEN")
        self.assertEqual(problems, [])
        self.assertEqual(self.validate()[0], 0)

    def test_review_heading_with_one_token_in_feedback_splits_the_item(self):
        # "## Review again" IS a heading per the grammar: the comment is cut and a
        # second (broken) item appears.  Documented reviewer pitfall.
        self.item("rev-20260817-235221.md",
                  MOBILE.replace("Need to justify why this convergence is uniform.", "Comment.\n## Review again\nmore"))
        items, problems = self.load()
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0].feedback, "Comment.")
        self.assertIsNone(items[0].status)
        self.assertEqual(items[1].heading_token, "again")
        msgs = " ".join(p.message for p in problems)
        self.assertIn("missing **Status:** line", msgs)
        self.assertIn("cannot resolve an ID", msgs)
        self.assertIn("2 items in one file", msgs)
        self.assertEqual(self.validate()[0], 1)

    def test_whitespace_only_file_is_error(self):
        self.item("rev-20260817-235221.md", "  \n\t\n   ")
        code, out, _ = self.validate()
        self.assertEqual(code, 1)
        self.assertIn("no review item found", out)
        code, out, _ = run(["--root", self.repo, "--json", "validate"])
        data = json.loads(out)
        self.assertFalse(data["ok"])
        self.assertEqual(data["items"], 0)

    def test_status_line_inside_blockquote_is_pdf_text(self):
        text = MOBILE.replace("> unit interval, which is the sufficient condition required for the affine",
                              "> **Status:** DONE\n> ## Review rev-20260101-000000")
        self.item("rev-20260817-235221.md", text)
        items, problems = self.load()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].status, "OPEN")
        self.assertIn("**Status:** DONE", items[0].pdf_lines)
        self.assertIn("## Review rev-20260101-000000", items[0].pdf_lines)
        self.assertEqual(problems, [])

    def test_field_like_lines_inside_feedback_stay_in_feedback(self):
        comment = "See below.\n**Note:** keep me\n**Resolution:** not yet\n**Source:** `x.tex:1`"
        self.item("rev-20260817-235221.md", MOBILE.replace("Need to justify why this convergence is uniform.", comment))
        items, problems = self.load()
        it = items[0]
        self.assertEqual(it.feedback, comment)
        self.assertEqual(it.extra_fields, {})
        self.assertEqual(it.resolution, [])
        self.assertIsNone(it.source)
        self.assertEqual(problems, [])

    def test_status_spelling_variants_are_normalised(self):
        self.item("rev-20260817-235221.md", MOBILE.replace("**Status:** OPEN", "**Status:**OPEN"))
        self.item("rev-20260817-235222.md",
                  MOBILE.replace("rev-20260817-235221", "rev-20260817-235222")
                  .replace("**Status:** OPEN", "**status:** Done\n\n**Resolution:** r"))
        self.item("rev-20260817-235223.md",
                  MOBILE.replace("rev-20260817-235221", "rev-20260817-235223")
                  .replace("**Status:** OPEN", "**STATUS:**   wontfix   \n\n**Resolution:** r"))
        items, problems = self.load()
        self.assertEqual([it.status for it in items], ["OPEN", "DONE", "WONTFIX"])
        self.assertEqual(self.errors(problems), [])
        code, out, _ = self.validate()
        self.assertEqual(code, 0, out)
        self.assertIn("OK: 3 items (1 open, 1 done, 1 wontfix)", out)

    def test_id_suffix_length_boundaries(self):
        good = ["rev-20260817-235221-abcdefgh", "rev-20260817-235221-AB"]
        bad = ["rev-20260817-235221-abcdefghi", "rev-20260817-235221-"]
        for ident in good + bad:
            self.item(f"{ident}.md", MOBILE.replace("rev-20260817-235221", ident))
        items, problems = self.load()
        self.assertEqual(sorted(it.id for it in items if it.id), sorted(good))
        unresolved = [p for p in problems if "cannot resolve an ID" in p.message]
        self.assertEqual(len(unresolved), 2)
        self.assertEqual(self.validate()[0], 1)

    def test_heading_spacing_variants(self):
        self.item("rev-20260817-235221.md", MOBILE.replace("## Review rev-20260817-235221", "##Review rev-20260817-235221"))
        self.item("rev-20260817-235222.md", MOBILE.replace("## Review rev-20260817-235221", "### Review rev-20260817-235222"))
        self.item("rev-20260817-235223.md", MOBILE.replace("## Review rev-20260817-235221", "##  Review\trev-20260817-235223  "))
        items, problems = self.load()
        self.assertEqual([it.id for it in items], ["rev-20260817-235223"])
        self.assertEqual(sum("no review item found" in p.message for p in problems), 2)
        self.assertFalse(any("does not match ID" in p.message for p in problems))

    def test_duplicate_id_within_one_file(self):
        self.item("rev-20260817-235221.md", MOBILE + "\n" + MOBILE)
        code, out, _ = self.validate()
        self.assertEqual(code, 1)
        self.assertIn("duplicate ID rev-20260817-235221", out)
        self.assertIn("2 items in one file", out)

    def test_legacy_preamble_only_is_ignored(self):
        write(self.repo / "feedback.md", "# Notes\n\n**Status:** OPEN\n\n> quoted\n\nno headings here\n")
        self.item("rev-20260817-235221.md", MOBILE)
        code, out, _ = self.validate()
        self.assertEqual(code, 0, out)
        self.assertIn("OK: 1 items", out)
        self.assertNotIn("feedback.md:", out.replace("feedback/rev-", ""))

    def test_legacy_problem_line_numbers_are_absolute(self):
        text = LEGACY.replace("Second item.\n\n**Status:** OPEN", "Second item.\n\n**Status:** MAYBE")
        write(self.repo / "feedback.md", text)
        expected_line = text.splitlines().index("**Status:** MAYBE") + 1
        _, problems = self.load()
        hits = [p for p in problems if "invalid status" in p.message]
        self.assertEqual(len(hits), 1)
        self.assertEqual((hits[0].path, hits[0].line), ("feedback.md", expected_line))
        code, out, _ = self.validate()
        self.assertEqual(code, 1)
        self.assertIn(f"feedback.md:{expected_line}: error: invalid status 'MAYBE'", out)

    def test_directory_named_like_an_item_is_skipped(self):
        (self.repo / "feedback" / "rev-20260101-000000.md").mkdir()
        self.item("rev-20260817-235221.md", MOBILE)
        code, out, _ = self.validate()
        self.assertEqual(code, 0, out)
        self.assertIn("OK: 1 items", out)

    def test_raw_line_separator_in_blockquote_splits_line_but_done_preserves_it(self):
        # U+2028 is a str.splitlines() boundary. Capture tools normalise it, but a
        # hand-written file may contain one; the parser warns and the rewrite
        # must still keep every byte of the reviewer's text.
        text = MOBILE.replace("> We therefore conclude", "> We therefore\u2028conclude")
        path = self.item("rev-20260817-235221.md", text)
        items, problems = self.load()
        self.assertEqual(items[0].pdf_lines[0], "We therefore")
        self.assertTrue(any("unexpected line inside **PDF text**" in p.message for p in problems))
        before = path.read_bytes()
        code, _, _ = run(["--root", self.repo, "done", "rev-20260817-235221", "--resolution", "ok"])
        self.assertEqual(code, 0)
        self.assertEqual(path.read_bytes(),
                         before.replace(b"**Status:** OPEN\n", b"**Status:** DONE\n\n**Resolution:** ok\n"))


# --------------------------------------------------------------------------- #
# validate / list / show / report / CLI plumbing
# --------------------------------------------------------------------------- #


class TestCliEdge(TempRepo):
    def test_filename_mismatch_heading_wins_in_list_and_show(self):
        self.item("rev-20260101-000000.md", MOBILE)
        code, out, _ = run(["--root", self.repo, "list"])
        self.assertEqual(code, 0)
        self.assertEqual(out.split()[0], "rev-20260817-235221")
        self.assertNotIn("rev-20260101-000000", out)
        code, out, _ = run(["--root", self.repo, "show", "rev-20260817-235221"])
        self.assertEqual(code, 0)
        self.assertTrue(out.startswith("[feedback/rev-20260101-000000.md]\n"))
        self.assertEqual(run(["--root", self.repo, "show", "rev-20260101-000000"])[0], 1)
        code, out, _ = run(["--root", self.repo, "--json", "list"])
        data = json.loads(out)
        self.assertEqual((data[0]["id"], data[0]["path"]), ("rev-20260817-235221", "feedback/rev-20260101-000000.md"))

    def test_unknown_status_filter_is_a_usage_error(self):
        # A typo such as "OPNE" must not silently select nothing.
        self.item("rev-20260817-235221.md", MOBILE)
        code, out, err = run(["--root", self.repo, "list", "--status", "OPNE"])
        self.assertEqual(code, 2)
        self.assertIn("invalid choice", err)
        for value in ("open", "Done", "WONTFIX", "all"):
            code, out, _ = run(["--root", self.repo, "--json", "list", "--status", value])
            self.assertEqual(code, 0, value)
            json.loads(out)

    def test_report_with_no_items(self):
        code, out, _ = run(["--root", self.repo, "report"])
        self.assertEqual(code, 0)
        self.assertIn("Total: 0 items — 0 OPEN, 0 DONE, 0 WONTFIX", out)
        self.assertIn("Still OPEN: none", out)
        self.assertNotIn("| ID |", out)
        code, out, _ = run(["--root", self.repo, "--json", "report"])
        data = json.loads(out)
        self.assertEqual(data, {"totals": {"OPEN": 0, "DONE": 0, "WONTFIX": 0}, "items": []})

    def test_report_escapes_pipes_in_table_cells(self):
        self.item("rev-20260817-235221.md",
                  RESOLVED.replace("Need to justify why this convergence is uniform.", "either a | b")
                  .replace("**Resolution:** Added a sentence", "**Resolution:** used a | b"))
        code, out, _ = run(["--root", self.repo, "report"])
        self.assertEqual(code, 0)
        row = [line for line in out.splitlines() if line.startswith("| rev-20260817-235221")][0]
        self.assertIn("| either a \\| b |", row)
        self.assertIn("| used a \\| b", row)
        self.assertEqual(row.count("|") - row.count("\\|"), 6)

    def test_json_outputs_parse_for_every_json_command(self):
        unicode_item = (MOBILE.replace("> We therefore conclude that the estimator is consistent uniformly over the",
                                       "> The ﬁnite–sample bound uses Bernstein’s inequality")
                        .replace("Need to justify why this convergence is uniform.", "Fix “this” 🙂 | now"))
        self.item("rev-20260817-235221.md", unicode_item)
        self.item("rev-20260818-101502.md", DESKTOP)
        self.item("rev-20260819-000000.md",
                  MOBILE.replace("rev-20260817-235221", "rev-20260819-000000").replace("**Status:** OPEN", "**Status:** LATER"))
        commands = {
            "validate": ["validate"],
            "list": ["list", "--status", "ALL"],
            "list-full": ["list", "--status", "ALL", "--full"],
            "show": ["show", "rev-20260817-235221"],
            "locate-id": ["locate", "rev-20260818-101502"],
            "locate-text": ["locate", "--text", EXACT_SENTENCE],
            "locate-all": ["locate", "--all"],
            "report": ["report"],
        }
        parsed = {}
        for name, argv in commands.items():
            with self.subTest(command=name):
                code, out, err = run(["--root", self.repo, "--json", *argv])
                self.assertIn(code, (0, 1), err)
                parsed[name] = json.loads(out)
        self.assertFalse(parsed["validate"]["ok"])
        self.assertEqual({p["level"] for p in parsed["validate"]["problems"]} & {"error"}, {"error"})
        self.assertEqual(set(parsed["validate"]["problems"][0]), {"path", "line", "level", "message"})
        by_id = {d["id"]: d for d in parsed["list"]}
        self.assertIn("ﬁnite", by_id["rev-20260817-235221"]["pdf_text"])
        self.assertIn("🙂", by_id["rev-20260817-235221"]["feedback"])
        self.assertIsNone(by_id["rev-20260819-000000"]["status"])
        self.assertEqual(parsed["list-full"], parsed["list"])  # --full is ignored under --json
        self.assertEqual(parsed["show"]["id"], "rev-20260817-235221")
        self.assertEqual(parsed["locate-id"][0]["source_status"], "confirmed")
        self.assertEqual(parsed["locate-text"][0]["id"], "(text)")
        self.assertEqual({d["id"] for d in parsed["locate-all"]}, {"rev-20260817-235221", "rev-20260818-101502"})
        self.assertEqual(parsed["report"]["totals"]["OPEN"], 2)

    def test_json_locate_with_nothing_to_locate_is_still_json(self):
        # CLI.md: --json switches locate to JSON on stdout. With no OPEN items
        # (or only unknown IDs) stdout must still parse.
        self.item("rev-20260817-235221.md", RESOLVED)
        with self.subTest(case="--all with no OPEN items"):
            code, out, _ = run(["--root", self.repo, "--json", "locate", "--all"])
            self.assertEqual(code, 0)
            self.assertEqual(json.loads(out), [])
        with self.subTest(case="unknown ID only"):
            code, out, err = run(["--root", self.repo, "--json", "locate", "rev-00000000-000000"])
            self.assertEqual(code, 0)
            self.assertIn("no item with ID", err)
            self.assertEqual(json.loads(out), [])

    def test_show_unknown_id_under_json_prints_a_json_error(self):
        code, out, err = run(["--root", self.repo, "--json", "show", "rev-00000000-000000"])
        self.assertEqual(code, 1)
        self.assertIn("no item with ID", json.loads(out)["error"])
        self.assertIn("no item with ID", err)

    def test_json_flag_on_commands_without_json_support_does_not_crash(self):
        code, out, _ = run(["--root", self.repo, "--json", "add", "--comment", "c", "--text", "t"])
        self.assertEqual(code, 0)
        self.assertRegex(out, r"^rev-\d{8}-\d{6}\S*  feedback/rev-\S+\.md\n$")
        item_id = out.split()[0]
        code, out, _ = run(["--root", self.repo, "--json", "done", item_id, "--resolution", "r"])
        self.assertEqual(code, 0)
        self.assertIn("OPEN -> DONE", out)
        target = self.tmp / "elsewhere"
        target.mkdir()
        code, out, _ = run(["--root", self.repo, "--json", "init", "--into", target])
        self.assertEqual(code, 0)
        self.assertIn("created:", out)

    def test_main_without_arguments_is_usage_error(self):
        code, out, err = run([])
        self.assertEqual(code, 2)
        self.assertIn("usage", err.lower())
        self.assertEqual(run(["--root", self.repo])[0], 2)
        self.assertEqual(run(["--root", self.repo, "frobnicate"])[0], 2)

    def test_relative_root_with_trailing_slash(self):
        self.item("rev-20260817-235221.md", MOBILE)
        code, out, _ = run(["--root", "paper/", "validate"], cwd=self.tmp)
        self.assertEqual(code, 0, out)
        self.assertIn("OK: 1 items", out)
        code, out, _ = run(["--root", "paper/", "--json", "list"], cwd=self.tmp)
        self.assertEqual(json.loads(out)[0]["path"], "feedback/rev-20260817-235221.md")
        code, out, _ = run(["--root", "./paper/", "show", "rev-20260817-235221"], cwd=self.tmp)
        self.assertTrue(out.startswith("[feedback/rev-20260817-235221.md]\n"), out)

    def test_root_flag_beats_feedback_root_env(self):
        self.item("rev-20260817-235221.md", MOBILE)
        old = os.environ.get("FEEDBACK_ROOT")
        os.environ["FEEDBACK_ROOT"] = str(self.tmp)  # no items up here
        try:
            code, out, _ = run(["--root", self.repo, "validate"])
            self.assertIn("OK: 1 items", out)
            code, out, _ = run(["validate"], cwd=self.repo)
            self.assertIn("OK: 0 items", out)  # env wins over auto-detection
        finally:
            if old is None:
                del os.environ["FEEDBACK_ROOT"]
            else:
                os.environ["FEEDBACK_ROOT"] = old

    def test_nonexistent_root_is_a_usage_error(self):
        # A typo in --root must not silently validate an empty tree.
        code, out, err = run(["--root", self.tmp / "does-not-exist", "validate"])
        self.assertEqual(code, 2)
        self.assertIn("is not a directory", err)

    def test_init_into_relative_path_resolves_against_cwd(self):
        code, out, _ = run(["--root", self.repo, "init", "--into", "other/"], cwd=self.tmp)
        self.assertEqual(code, 0)
        self.assertTrue((self.tmp / "other" / "feedback" / "README.md").is_file())
        self.assertIn("other/feedback/README.md", out)


# --------------------------------------------------------------------------- #
# add
# --------------------------------------------------------------------------- #


class TestAddEdge(TempRepo):
    def test_text_line_already_starting_with_gt_is_double_prefixed_and_round_trips(self):
        code, out, _ = run(["--root", self.repo, "add", "--comment", "c", "--text", "> already quoted\nsecond line"])
        self.assertEqual(code, 0)
        path = self.repo / "feedback" / f"{out.split()[0]}.md"
        self.assertIn("**PDF text**\n> > already quoted\n> second line\n", path.read_text(encoding="utf-8"))
        items, problems = self.load()
        self.assertEqual(items[0].pdf_lines, ["> already quoted", "second line"])
        self.assertEqual(problems, [])

    def test_very_long_single_line(self):
        text = " ".join(f"w{i}" for i in range(1500))  # ~7 500 characters, no newline
        code, out, _ = run(["--root", self.repo, "add", "--comment", "c", "--text", text])
        self.assertEqual(code, 0)
        item_id = out.split()[0]
        content = (self.repo / "feedback" / f"{item_id}.md").read_text(encoding="utf-8")
        self.assertIn(f"\n> {text}\n", content)
        self.assertEqual(self.validate()[0], 0)
        code, out, _ = run(["--root", self.repo, "list"])
        preview = out.rstrip("\n").split("  | ")[-1]
        self.assertLessEqual(len(preview), 40)
        self.assertTrue(preview.endswith("…"))
        code, out, _ = run(["--root", self.repo, "--json", "show", item_id])
        self.assertEqual(json.loads(out)["pdf_text"], text)

    def test_stdin_with_crlf_and_trailing_blank_lines(self):
        code, out, _ = run(["--root", self.repo, "add", "--comment", "c", "--stdin"], stdin="quoted\r\nline\r\n\r\n")
        self.assertEqual(code, 0)
        content = (self.repo / "feedback" / f"{out.split()[0]}.md").read_text(encoding="utf-8")
        self.assertIn("**PDF text**\n> quoted\n> line\n\n**Feedback**", content)
        self.assertNotIn("\r", content)

    def test_empty_stdin_gives_sentinel(self):
        code, out, _ = run(["--root", self.repo, "add", "--comment", "c", "--stdin"], stdin="")
        self.assertEqual(code, 0)
        content = (self.repo / "feedback" / f"{out.split()[0]}.md").read_text(encoding="utf-8")
        self.assertIn("> (no text selected)\n", content)

    def test_collision_with_a_legacy_id_gets_a_suffix(self):
        write(self.repo / "feedback.md", LEGACY)  # holds rev-20260817-235221
        item_id, path = fb.add_item(self.repo, "t", "c", now=datetime(2026, 8, 17, 23, 52, 21), rng=random.Random(3))
        self.assertRegex(item_id, r"^rev-20260817-235221-[a-z0-9]{2}$")
        self.assertEqual(path.name, f"{item_id}.md")
        code, out, _ = self.validate()
        self.assertEqual(code, 0, out)
        self.assertIn("OK: 3 items", out)

    def test_comment_starting_with_status_line_is_escaped(self):
        # The schema tells reviewers not to do this; add neutralises it with a
        # Markdown escape so the file stays valid and the text stays visible.
        code, out, _ = run(["--root", self.repo, "add", "--comment", "**Status:** DONE", "--text", "t"])
        self.assertEqual(code, 0)
        code, out, _ = self.validate()
        self.assertEqual(code, 0, out)
        items, _ = self.load()
        self.assertEqual(items[0].status, "OPEN")
        self.assertEqual(items[0].feedback, "\\**Status:** DONE")

    def test_source_with_backslashes_is_written_verbatim(self):
        code, out, _ = run(["--root", self.repo, "add", "--comment", "c", "--text", INTRO_SENTENCE,
                            "--source", "sections\\introduction.tex:7"])
        self.assertEqual(code, 0)
        items, _ = self.load()
        self.assertEqual(items[0].source, "sections\\introduction.tex:7")


# --------------------------------------------------------------------------- #
# done / wontfix / reopen
# --------------------------------------------------------------------------- #


class TestStatusEdge(TempRepo):
    def test_done_in_legacy_crlf_file_with_rule_terminators_leaves_other_bytes_intact(self):
        path = self.repo / "feedback.md"
        write(path, LEGACY, newline="\r\n")
        before = path.read_bytes()
        code, out, _ = run(["--root", self.repo, "done", "rev-20260817-235221", "--resolution", "Fixed."])
        self.assertEqual(code, 0, out)
        after = path.read_bytes()
        expected = before.replace(b"**Status:** open\r\n", b"**Status:** DONE\r\n\r\n**Resolution:** Fixed.\r\n", 1)
        self.assertEqual(after, expected)
        marker = b"## Review rev-20260818-101502"
        self.assertEqual(after.split(marker, 1)[1], before.split(marker, 1)[1])
        self.assertEqual(after.split(b"## Review 12", 1)[0], before.split(b"## Review 12", 1)[0])
        self.assertNotIn(b"\n", after.replace(b"\r\n", b""))
        items, problems = self.load()
        self.assertEqual([it.status for it in items], ["DONE", "OPEN"])
        self.assertEqual(items[0].resolution, ["Fixed."])
        self.assertEqual(self.errors(problems), [])

    def test_reopen_with_resolution_then_done_again_keeps_every_resolution(self):
        path = self.item("rev-20260817-235221.md", RESOLVED)
        code, out, _ = run(["--root", self.repo, "reopen", "rev-20260817-235221", "--resolution", "Reopened by reviewer."])
        self.assertEqual(code, 0, out)
        self.assertIn("DONE -> OPEN", out)
        items, problems = self.load()
        self.assertEqual(items[0].status, "OPEN")
        self.assertEqual(len(items[0].resolution), 2)
        self.assertEqual(self.errors(problems), [])
        self.assertEqual(self.validate()[0], 0)
        code, _, _ = run(["--root", self.repo, "done", "rev-20260817-235221", "--resolution", "Second fix."])
        self.assertEqual(code, 0)
        self.assertEqual(path.read_text(encoding="utf-8"),
                         RESOLVED.rstrip("\n") + "\n\n**Resolution:** Reopened by reviewer.\n\n**Resolution:** Second fix.\n")
        items, _ = self.load()
        self.assertEqual([r.splitlines()[0][:10] for r in items[0].resolution], ["Added a se", "Reopened b", "Second fix"])
        code, out, _ = run(["--root", self.repo, "report"])
        self.assertIn("| DONE | - | Need to justify why this convergence is uniform. | Second fix. |", out)

    def test_resolution_containing_status_text_inline_is_plain_text(self):
        path = self.item("rev-20260817-235221.md", MOBILE)
        note = "Kept the line **Status:** OPEN as an example in the text."
        code, _, _ = run(["--root", self.repo, "done", "rev-20260817-235221", "--resolution", note])
        self.assertEqual(code, 0)
        items, problems = self.load()
        self.assertEqual(items[0].status, "DONE")
        self.assertEqual(items[0].resolution, [note])
        self.assertFalse(any("second **Status:**" in p.message for p in problems))
        self.assertEqual(self.validate()[0], 0)

    def test_resolution_continuation_line_starting_with_status_does_not_change_status(self):
        self.item("rev-20260817-235221.md", MOBILE)
        note = "Rewrote it.\n**Status:** OPEN was the reviewer's wording."
        code, _, _ = run(["--root", self.repo, "done", "rev-20260817-235221", "--resolution", note])
        self.assertEqual(code, 0)
        items, problems = self.load()
        self.assertEqual(items[0].status, "DONE")
        self.assertEqual(items[0].resolution[0], "Rewrote it.")  # schema: the field ends at the next **Field:** line
        self.assertTrue(any("second **Status:** line ignored" in p.message for p in problems))
        code, out, _ = self.validate()
        self.assertEqual(code, 0, out)

    def test_done_on_second_item_of_a_two_item_file_touches_only_that_item(self):
        text = MOBILE + "\n" + TODO
        path = self.item("rev-20260817-235221.md", text)
        code, _, _ = run(["--root", self.repo, "done", "rev-20260817-235430-41", "--resolution", "r"])
        self.assertEqual(code, 0)
        self.assertEqual(path.read_text(encoding="utf-8"),
                         MOBILE + "\n" + TODO.replace("**Status:** OPEN\n", "**Status:** DONE\n\n**Resolution:** r\n"))
        items, _ = self.load()
        self.assertEqual([it.status for it in items], ["OPEN", "DONE"])

    def test_done_repairs_an_invalid_status(self):
        self.item("rev-20260817-235221.md", MOBILE.replace("**Status:** OPEN", "**Status:** PENDING"))
        self.assertEqual(self.validate()[0], 1)
        code, out, _ = run(["--root", self.repo, "done", "rev-20260817-235221", "--resolution", "r"])
        self.assertEqual(code, 0)
        self.assertIn("? -> DONE", out)
        code, out, _ = self.validate()
        self.assertEqual(code, 0, out)

    def test_whitespace_resolution_on_done_item_changes_nothing_and_says_so(self):
        path = self.item("rev-20260817-235221.md", RESOLVED)
        before = path.read_bytes()
        code, out, _ = run(["--root", self.repo, "done", "rev-20260817-235221", "--resolution", "   "])
        self.assertEqual(code, 0)
        self.assertEqual(path.read_bytes(), before)
        self.assertNotIn("added a resolution note", out)  # nothing was added

    def test_reopen_on_open_item_without_resolution_is_a_noop(self):
        path = self.item("rev-20260817-235221.md", MOBILE)
        before = path.read_bytes()
        code, out, _ = run(["--root", self.repo, "reopen", "rev-20260817-235221"])
        self.assertEqual(code, 0)
        self.assertIn("already OPEN", out)
        self.assertEqual(path.read_bytes(), before)

    def test_done_preserves_non_utf8_reviewer_bytes(self):
        # Schema rule 3 + CLI.md: reviewer text is immutable and every other byte
        # of the file is preserved. A stray Latin-1 byte must survive the rewrite.
        path = self.repo / "feedback" / "rev-20260817-235221.md"
        before = MOBILE.encode("utf-8").replace(b"justify", b"justif\xe9")
        path.write_bytes(before)
        code, _, _ = run(["--root", self.repo, "done", "rev-20260817-235221", "--resolution", "ok"])
        self.assertEqual(code, 0)
        self.assertEqual(path.read_bytes(),
                         before.replace(b"**Status:** OPEN\n", b"**Status:** DONE\n\n**Resolution:** ok\n"))


# --------------------------------------------------------------------------- #
# locate
# --------------------------------------------------------------------------- #


class TestLocateEdge(TempRepo):
    def locate_json(self, *argv):
        code, out, err = run(["--root", self.repo, "--json", "locate", *argv])
        self.assertEqual(code, 0, err)
        return json.loads(out)

    def test_top_one_with_high_min_score(self):
        res = self.locate_json("--text", FUZZY_SENTENCE, "--top", "1", "--min-score", "0.9")[0]
        self.assertEqual(res["verdict"], "NOT FOUND")
        self.assertLessEqual(len(res["candidates"]), 1)
        for cand in res["candidates"]:
            self.assertLess(cand["score"], 0.9)
        code, out, _ = run(["--root", self.repo, "locate", "--text", FUZZY_SENTENCE, "--top", "1", "--min-score", "0.9"])
        self.assertIn("NOT FOUND", out)
        self.assertIn("(below threshold)", out)
        res = self.locate_json("--text", EXACT_SENTENCE, "--top", "1", "--min-score", "0.9")[0]
        self.assertEqual(res["verdict"], "UNIQUE")
        self.assertEqual(len(res["candidates"]), 1)
        self.assertEqual(res["candidates"][0]["score"], 1.0)

    def test_top_zero_keeps_verdict_but_prints_no_candidates(self):
        res = self.locate_json("--text", EXACT_SENTENCE, "--top", "0")[0]
        self.assertEqual(res["verdict"], "UNIQUE")
        self.assertEqual(res["candidates"], [])
        code, out, _ = run(["--root", self.repo, "locate", "--text", EXACT_SENTENCE, "--top", "0"])
        self.assertEqual(code, 0)
        self.assertNotIn("score=", out)

    def test_min_score_extremes(self):
        # Outside 0..1 is a usage error; the ends of the range work.
        code, _, err = run(["--root", self.repo, "locate", "--text", EXACT_SENTENCE, "--min-score", "1.5"])
        self.assertEqual(code, 2)
        self.assertIn("--min-score", err)
        res = self.locate_json("--text", EXACT_SENTENCE, "--min-score", "1")[0]
        self.assertEqual(res["verdict"], "UNIQUE")  # an exact match scores 1.0
        self.assertEqual(res["candidates"][0]["score"], 1.0)
        res = self.locate_json("--text", EXACT_SENTENCE, "--min-score", "0")[0]
        self.assertIn(res["verdict"], ("UNIQUE", "AMBIGUOUS"))

    def test_windows_1252_tex_file_does_not_crash(self):
        (self.repo / "sections" / "w1252.tex").write_bytes(
            b"Caf\xe9 au lait is served every morning in the old caf\xe9 near the station.\n")
        res = self.locate_json("--text", "Café au lait is served every morning in the old café near the station")[0]
        self.assertEqual(res["verdict"], "UNIQUE")
        self.assertEqual(res["candidates"][0]["path"], "sections/w1252.tex")
        self.assertIn("\ufffd", res["candidates"][0]["snippet"])
        code, out, _ = run(["--root", self.repo, "locate", "--text", "Café au lait is served every morning"])
        self.assertEqual(code, 0)
        self.assertIn("sections/w1252.tex", out)

    def test_display_env_with_prose_on_begin_and_end_lines(self):
        # Documented limitation: a line carrying \begin{align*} or \end{align*}
        # is skipped whole, prose included; the surrounding lines still match.
        (self.repo / "sections" / "al.tex").write_text(ALIGN_TEX, encoding="utf-8")
        tokens = fb.tokenize_tex_text(ALIGN_TEX)
        self.assertEqual(sorted({lineno for _, lineno in tokens}), [1, 6])
        words = [w for w, _ in tokens]
        self.assertNotIn("marker", words)
        self.assertNotIn("defined", words)
        res = self.locate_json("--text", "But the very next line of prose is still matched normally")[0]
        self.assertEqual(res["verdict"], "UNIQUE")
        self.assertEqual((res["candidates"][0]["path"], res["candidates"][0]["line_start"]), ("sections/al.tex", 6))
        res = self.locate_json("--text", "and the prose right after the end marker is lost")[0]
        self.assertEqual(res["verdict"], "NOT FOUND")
        res = self.locate_json("--text", "Before the display we say something quite specific here")[0]
        self.assertEqual(res["verdict"], "UNIQUE")

    def test_2000_word_query_against_a_section_sized_file_is_fast(self):
        # A ~2 250-token prose file (an ordinary section) sharing vocabulary with
        # the query: every sliding window passes the 30 % overlap filter, so the
        # cost is ~250 SequenceMatcher runs on 2 000 x 2 000 tokens.
        vocab = ("the of and to in is that for we with as by this it on be are from an which or at "
                 "estimator kernel uniform consistency bandwidth moment noise regression rate grid mesh "
                 "chaining argument inequality bias variance stochastic term lipschitz bounded density "
                 "interval sufficient condition affine correction step proof theorem lemma section").split()
        rng = random.Random(7)
        lines = [" ".join(rng.choice(vocab) for _ in range(12)) for _ in range(188)]
        (self.repo / "sections" / "long.tex").write_text("\n".join(lines) + "\n", encoding="utf-8")
        query = " ".join(rng.choice(vocab) for _ in range(2000))
        start = time.time()
        res = fb.locate_item(query, self.repo, 3, 0.55)
        elapsed = time.time() - start
        self.assertEqual(res["query_words"], 2000)
        self.assertLess(elapsed, 10.0, f"locate took {elapsed:.1f}s for a 2000-word query")

    def test_source_with_backslashes_is_confirmed(self):
        self.item("rev-20260818-101502.md", DESKTOP.replace("`sections/introduction.tex:9`", "`sections\\introduction.tex:9`"))
        res = self.locate_json("rev-20260818-101502")[0]
        self.assertEqual(res["source"], "sections\\introduction.tex:9")
        self.assertEqual(res["source_status"], "confirmed")
        code, out, _ = run(["--root", self.repo, "locate", "rev-20260818-101502"])
        self.assertIn("source: sections\\introduction.tex:9 — confirmed", out)

    def test_source_with_dot_slash_prefix_is_confirmed(self):
        # "./sections/x.tex:9" names the same file as "sections/x.tex:9".
        self.item("rev-20260818-101502.md", DESKTOP.replace("`sections/introduction.tex:9`", "`./sections/introduction.tex:9`"))
        res = self.locate_json("rev-20260818-101502")[0]
        self.assertEqual(res["source_status"], "confirmed")

    def test_source_without_line_number_is_unparseable(self):
        self.item("rev-20260818-101502.md", DESKTOP.replace("`sections/introduction.tex:9`", "`sections/introduction.tex`"))
        res = self.locate_json("rev-20260818-101502")[0]
        self.assertEqual(res["source_status"], "unparseable")
        self.assertEqual(res["verdict"], "UNIQUE")
        code, out, _ = run(["--root", self.repo, "locate", "rev-20260818-101502"])
        self.assertIn("could not parse (expected path:line)", out)

    def test_unknown_id_next_to_a_known_id_is_advisory(self):
        self.item("rev-20260818-101502.md", DESKTOP)
        code, out, err = run(["--root", self.repo, "locate", "rev-00000000-000000", "rev-20260818-101502"])
        self.assertEqual(code, 0)
        self.assertIn("no item with ID rev-00000000-000000", err)
        self.assertIn("rev-20260818-101502  UNIQUE", out)
        self.assertNotIn("rev-00000000-000000", out)

    def test_all_skips_resolved_items_and_survives_the_no_text_sentinel(self):
        self.item("rev-20260817-235221.md", RESOLVED)
        self.item("rev-20260817-235430-41.md",
                  TODO.replace("> a standard chaining argument over a grid of mesh h2 combined with Bernstein’s inequality",
                               "> (no text selected)"))
        data = self.locate_json("--all")
        self.assertEqual([d["id"] for d in data], ["rev-20260817-235430-41"])
        self.assertEqual(data[0]["verdict"], "NOT FOUND")
        code, out, _ = run(["--root", self.repo, "locate", "--all"])
        self.assertEqual(code, 0)
        self.assertIn("rev-20260817-235430-41  NOT FOUND", out)

    def test_oversized_files_and_skip_directories_are_ignored(self):
        big = self.repo / "sections" / "big.tex"
        big.write_text("the oversized phrase hides in a giant file\n" + ("filler words here\n" * 130000), encoding="utf-8")
        self.assertGreater(big.stat().st_size, fb.MAX_TEX_BYTES)
        (self.repo / "sections" / "build").mkdir()
        (self.repo / "sections" / "build" / "gen.tex").write_text("the nested build phrase is generated output\n", encoding="utf-8")
        (self.repo / "_minted-main").mkdir()
        (self.repo / "_minted-main" / "x.tex").write_text("the minted cache phrase is generated output\n", encoding="utf-8")
        (self.repo / "sections" / "ok.tex").write_text("the control phrase is ordinary prose that counts\n", encoding="utf-8")
        found = {p.relative_to(self.repo).as_posix() for p in fb.iter_tex_files(self.repo)}
        self.assertIn("sections/ok.tex", found)
        self.assertNotIn("sections/big.tex", found)
        self.assertNotIn("sections/build/gen.tex", found)
        self.assertNotIn("_minted-main/x.tex", found)
        self.assertEqual(self.locate_json("--text", "the oversized phrase hides in a giant file")[0]["verdict"], "NOT FOUND")
        self.assertEqual(self.locate_json("--text", "the nested build phrase is generated output")[0]["verdict"], "NOT FOUND")
        self.assertEqual(self.locate_json("--text", "the minted cache phrase is generated output")[0]["verdict"], "NOT FOUND")
        self.assertEqual(self.locate_json("--text", "the control phrase is ordinary prose that counts")[0]["verdict"], "UNIQUE")


if __name__ == "__main__":
    unittest.main()

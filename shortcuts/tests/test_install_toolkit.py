"""Tests for scripts/install_toolkit.py."""

from __future__ import annotations

import contextlib
import importlib.util
import io
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent


def _load():
    spec = importlib.util.spec_from_file_location("install_toolkit", REPO / "scripts" / "install_toolkit.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


inst = _load()

EXPECTED_FILES = [
    "scripts/feedback.py",
    "prompts/address-feedback.md",
    ".claude/commands/address-feedback.md",
    "docs/FEEDBACK_SCHEMA.md",
    "docs/CLI.md",
    "feedback/README.md",
    "feedback/TEMPLATE.md",
    ".gitattributes",
    "AGENTS.md",
    "CLAUDE.md",
]


def run(argv):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        try:
            code = inst.main([str(a) for a in argv])
        except SystemExit as exc:
            code = exc.code if isinstance(exc.code, int) else 2
    return code, out.getvalue(), err.getvalue()


class TestInstall(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="inst-"))
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.target = self.tmp / "paper"
        (self.target / ".git").mkdir(parents=True)
        (self.target / "main.tex").write_text("\\documentclass{article}\n", encoding="utf-8")

    def test_fresh_install_creates_everything(self):
        code, out, _ = run([self.target])
        self.assertEqual(code, 0, out)
        for rel in EXPECTED_FILES:
            self.assertTrue((self.target / rel).exists(), rel)
        self.assertEqual((self.target / "scripts" / "feedback.py").read_bytes(),
                         (REPO / "scripts" / "feedback.py").read_bytes())
        ga = (self.target / ".gitattributes").read_text(encoding="utf-8")
        self.assertIn("feedback/*.md text eol=lf", ga)
        self.assertIn("* text=auto", ga)
        self.assertIn("## Review feedback", (self.target / "AGENTS.md").read_text(encoding="utf-8"))
        self.assertEqual((self.target / "CLAUDE.md").read_text(encoding="utf-8"), "@AGENTS.md\n")
        self.assertIn("Next steps", out)

    def test_idempotent(self):
        run([self.target])
        snapshot = {rel: (self.target / rel).read_bytes() for rel in EXPECTED_FILES}
        code, out, _ = run([self.target])
        self.assertEqual(code, 0)
        self.assertIn("nothing to do", out)
        for rel in EXPECTED_FILES:
            self.assertEqual((self.target / rel).read_bytes(), snapshot[rel], rel)

    def test_merges_existing_files_once(self):
        (self.target / ".gitattributes").write_text("* text=auto\n*.png binary\n", encoding="utf-8")
        (self.target / "AGENTS.md").write_text("# My agents file\n\nKeep this.\n", encoding="utf-8")
        (self.target / "CLAUDE.md").write_text("Project notes.\n", encoding="utf-8")
        code, _, _ = run([self.target])
        self.assertEqual(code, 0)
        ga = (self.target / ".gitattributes").read_text(encoding="utf-8")
        self.assertEqual(ga.count("* text=auto"), 1)
        self.assertIn("*.png binary", ga)
        self.assertIn("feedback/*.md text eol=lf", ga)
        agents = (self.target / "AGENTS.md").read_text(encoding="utf-8")
        self.assertIn("Keep this.", agents)
        self.assertEqual(agents.count("## Review feedback"), 1)
        claude = (self.target / "CLAUDE.md").read_text(encoding="utf-8")
        self.assertTrue(claude.startswith("Project notes.\n"))
        self.assertEqual(claude.count("@AGENTS.md"), 1)
        run([self.target])
        self.assertEqual((self.target / "AGENTS.md").read_text(encoding="utf-8").count("## Review feedback"), 1)
        self.assertEqual((self.target / ".gitattributes").read_text(encoding="utf-8").count("feedback/*.md"), 1)

    def test_differing_file_refused_without_force(self):
        run([self.target])
        (self.target / "scripts" / "feedback.py").write_text("print('old')\n", encoding="utf-8")
        code, out, _ = run([self.target])
        self.assertEqual(code, 1)
        self.assertIn("scripts/feedback.py", out)
        self.assertEqual((self.target / "scripts" / "feedback.py").read_text(encoding="utf-8"), "print('old')\n")
        code, _, _ = run([self.target, "--force"])
        self.assertEqual(code, 0)
        self.assertEqual((self.target / "scripts" / "feedback.py").read_bytes(),
                         (REPO / "scripts" / "feedback.py").read_bytes())

    def test_dry_run_changes_nothing(self):
        code, out, _ = run([self.target, "--dry-run"])
        self.assertEqual(code, 0)
        self.assertIn("would create: scripts/feedback.py", out)
        self.assertFalse((self.target / "scripts").exists())
        self.assertFalse((self.target / ".gitattributes").exists())

    def test_not_a_directory(self):
        code, _, err = run([self.tmp / "missing"])
        self.assertEqual(code, 1)
        self.assertIn("not a directory", err)

    def test_no_git_warns_but_installs(self):
        shutil.rmtree(self.target / ".git")
        code, out, _ = run([self.target])
        self.assertEqual(code, 0)
        self.assertIn("warning", out)
        self.assertTrue((self.target / "feedback" / "README.md").exists())

    def test_merge_keeps_existing_line_endings_and_bom(self):
        ga = b"\xef\xbb\xbf* text=auto\r\n*.png binary\r\n"
        agents = b"# My agents file\r\n\r\nKeep this.\r\n"
        claude = b"Project notes."  # no final newline
        (self.target / ".gitattributes").write_bytes(ga)
        (self.target / "AGENTS.md").write_bytes(agents)
        (self.target / "CLAUDE.md").write_bytes(claude)
        code, _, _ = run([self.target])
        self.assertEqual(code, 0)
        ga_after = (self.target / ".gitattributes").read_bytes()
        self.assertTrue(ga_after.startswith(ga))  # existing bytes untouched, BOM included
        self.assertIn(b"\r\nfeedback/*.md text eol=lf\r\n", ga_after)
        self.assertNotIn(b"\n", ga_after.replace(b"\r\n", b""))  # no lone LF introduced
        self.assertEqual(ga_after.count(b"* text=auto"), 1)
        agents_after = (self.target / "AGENTS.md").read_bytes()
        self.assertTrue(agents_after.startswith(agents))
        self.assertIn(b"\r\n## Review feedback\r\n", agents_after)
        self.assertNotIn(b"\n", agents_after.replace(b"\r\n", b""))
        self.assertEqual((self.target / "CLAUDE.md").read_bytes(), b"Project notes.\n\n@AGENTS.md\n")
        code, out, _ = run([self.target])
        self.assertEqual(code, 0)
        self.assertIn("nothing to do", out)

    def test_refuses_to_install_into_the_toolkit_itself(self):
        watched = [rel for rel in ("AGENTS.md", "CLAUDE.md", ".gitattributes") if (REPO / rel).exists()]
        before = {rel: (REPO / rel).read_bytes() for rel in watched}
        code, out, err = run([REPO])
        self.assertEqual(code, 1)
        self.assertIn("toolkit itself", err)
        self.assertNotIn("append", out)
        for rel in watched:
            self.assertEqual((REPO / rel).read_bytes(), before[rel], rel)
        code, _, err = run([REPO / "scripts" / "..", "--dry-run"])
        self.assertEqual(code, 1)
        self.assertIn("toolkit itself", err)


if __name__ == "__main__":
    unittest.main()

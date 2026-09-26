// Verifies lessons: every complete C++ block (one with `main`) must compile,
// and each lesson's solution must produce its expected output.
//
//   node scripts/check-lessons.mjs                 # all lessons
//   node scripts/check-lessons.mjs lessons/009-*.md
import { readdir, readFile } from "node:fs/promises";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import { parseLesson, normalizeOutput } from "../src/lesson-format.js";
import { parsePageRange } from "./textbook.mjs";
import { compile, run } from "./toolchain.mjs";

process.removeAllListeners("warning"); // node:wasi is "experimental"

export async function checkLesson(text) {
  const problems = [];
  const lesson = parseLesson(text);
  const { meta, body } = lesson;
  if (!meta.id) problems.push("front matter is missing `id`");
  if (!meta.title) problems.push("front matter is missing `title`");
  if (!lesson.starter) problems.push("no ```cpp starter block");
  if (!lesson.solution) problems.push("no ```cpp solution block");
  if (lesson.expected == null) problems.push("no ```expected block");
  if (meta.source_pages != null && !parsePageRange(meta.source_pages)) {
    problems.push("`source_pages` must be a page or a range, e.g. 12-14");
  }
  if ((meta.source != null) !== (meta.source_pages != null)) {
    problems.push("`source` (the book) and `source_pages` go together");
  }

  const blocks = [...body.matchAll(/^```(cpp[^\n]*)\n([\s\S]*?)^```[ \t]*$/gm)];
  for (const [, info, code] of blocks) {
    if (!/\bint\s+main\s*\(/.test(code)) continue; // fragment, not a full program
    const tag = info.split(/\s+/)[1] ?? "example";
    const res = await compile(code);
    if (!res.ok) {
      // Starters may be deliberately incomplete (e.g. calling functions the learner must write).
      if (tag === "starter") continue;
      problems.push(`${tag} block does not compile:\n${res.diagnostics.trim()}`);
    }
  }

  if (lesson.solution && lesson.expected != null) {
    const res = await compile(lesson.solution);
    if (res.ok) {
      const out = await run(res.wasm, lesson.stdin ?? "");
      if (out.code !== 0) problems.push(`solution exited with ${out.code}\n${out.stderr}`);
      if (normalizeOutput(out.stdout) !== normalizeOutput(lesson.expected)) {
        problems.push(`solution output doesn't match expected.\n--- expected\n${lesson.expected}\n--- got\n${out.stdout}`);
      }
    }
  }
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  let files = process.argv.slice(2);
  if (!files.length) {
    files = (await readdir("lessons")).filter((f) => /^\d.*\.md$/.test(f)).sort().map((f) => `lessons/${f}`);
  }
  let failed = 0;
  for (const f of files) {
    const problems = await checkLesson(await readFile(f, "utf8"));
    if (problems.length) {
      failed++;
      console.log(`✗ ${basename(f)}`);
      for (const p of problems) console.log("   " + p.replace(/\n/g, "\n   "));
    } else {
      console.log(`✓ ${basename(f)}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

// Shows where the lessons are in the textbook and extracts the next pages,
// for writing new lessons by hand (or with Claude Code; see the
// cppad-add-lessons skill in .claude/skills/).
//
//   npm run next-pages            # next ~40 pages
//   npm run next-pages -- 25      # next 25 pages
//
// Writes the page text to textbook/.next-pages.txt (git-ignored) and prints
// a summary: the next lesson id, the next page, and where the text is.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { parseFrontMatter } from "../src/lesson-format.js";
import { loadTextbook, parsePageRange } from "./textbook.mjs";

const maxPages = Number(process.argv[2]) || 40;
const OUT = "textbook/.next-pages.txt";

const lessons = [];
for (const file of (await readdir("lessons")).filter((f) => /^\d.*\.md$/.test(f)).sort()) {
  const { meta } = parseFrontMatter(await readFile(`lessons/${file}`, "utf8"));
  lessons.push({ file, id: Number(meta.id), title: meta.title, pages: parsePageRange(meta.source_pages) });
}
const nextId = Math.max(0, ...lessons.map((l) => l.id || 0)) + 1;
console.log(`lessons: ${lessons.length}; next lesson id: ${nextId}`);
const last = lessons.filter((l) => l.pages).at(-1);
if (last) console.log(`last textbook lesson: ${last.file} (pages ${last.pages.start}-${last.pages.end})`);

const book = await loadTextbook();
if (!book) {
  console.log("no textbook in textbook/ (and no TEXTBOOK_URL); use lessons/CURRICULUM.md instead");
  process.exit(0);
}
const start = Math.max(0, ...lessons.map((l) => l.pages?.end ?? 0)) + 1;
if (start > book.pages.length) {
  console.log(`textbook "${book.name}" is finished (${book.pages.length} pages); use lessons/CURRICULUM.md`);
  process.exit(0);
}
const end = Math.min(book.pages.length, start + maxPages - 1);
let text = "";
for (let p = start; p <= end; p++) text += `\n\n<page number="${p}">\n${book.pages[p - 1]}\n</page>`;
await writeFile(OUT, text.trimStart() + "\n");
console.log(`textbook "${book.name}": ${book.pages.length} pages; next page: ${start}`);
console.log(`wrote pages ${start}-${end} (${text.length.toLocaleString()} chars) to ${OUT}`);

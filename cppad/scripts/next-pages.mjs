// Shows where the lessons are in the textbooks and extracts the next pages,
// for writing new lessons by hand (or with Claude Code; see the
// cppad-add-lessons skill in .claude/skills/).
//
//   npm run next-pages            # next ~40 pages
//   npm run next-pages -- 25      # next 25 pages
//
// The books are read in order (see textbook.mjs). A lesson's `source` names
// its book and `source_pages` the pages printed in that book; the next book
// starts once the lessons reach the current one's index. Writes the page text
// to textbook/.next-pages.txt (git-ignored) and prints a summary.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { parseFrontMatter } from "../src/lesson-format.js";
import { loadTextbooks, parsePageRange, pdfPageOf, printedPage } from "./textbook.mjs";

const maxPages = Number(process.argv[2]) || 40;
const OUT = "textbook/.next-pages.txt";

const lessons = [];
for (const file of (await readdir("lessons")).filter((f) => /^\d.*\.md$/.test(f)).sort()) {
  const { meta } = parseFrontMatter(await readFile(`lessons/${file}`, "utf8"));
  const source = meta.source == null ? null : String(meta.source);
  lessons.push({ file, id: Number(meta.id), title: meta.title, source, pages: parsePageRange(meta.source_pages) });
}
const nextId = Math.max(0, ...lessons.map((l) => l.id || 0)) + 1;
console.log(`lessons: ${lessons.length}; next lesson id: ${nextId}`);
const last = lessons.filter((l) => l.pages).at(-1);
if (last) console.log(`last textbook lesson: ${last.file} (${last.source ?? "textbook"}, pages ${last.pages.start}-${last.pages.end})`);

const books = await loadTextbooks();
if (!books.length) {
  console.log("no textbook in textbook/ (and no TEXTBOOK_URL); use lessons/CURRICULUM.md instead");
  process.exit(0);
}

// How far the lessons have got in each book, as a PDF page. Lessons without
// `source` count toward the first book.
for (const book of books) {
  book.reached = 0;
  for (const l of lessons) {
    if (!l.pages || (l.source ?? books[0].title) !== book.title) continue;
    const end = pdfPageOf(book, l.pages.end);
    if (end == null) console.log(`warning: ${l.file}: page ${l.pages.end} is not a page number printed in "${book.title}"`);
    else book.reached = Math.max(book.reached, end);
  }
}
for (const l of lessons) {
  if (l.source != null && !books.some((b) => b.title === l.source)) {
    console.log(`warning: ${l.file} cites "${l.source}", which isn't one of the textbooks`);
  }
}
console.log("textbooks, in reading order:");
for (const b of books) {
  const at = b.reached ? `lessons reach printed page ${printedPage(b, b.reached)}` : "not started";
  console.log(`  ${b.reached >= b.contentEnd ? "✓" : "·"} ${b.title}: ${b.pages.length} PDF pages, ${at}`);
}

const book = books.find((b) => b.reached < b.contentEnd);
if (!book) {
  console.log("all textbooks are finished; use lessons/CURRICULUM.md");
  process.exit(0);
}
// A new book starts at printed page 1, after the cover, contents and preface.
const start = book.reached ? book.reached + 1 : Math.min(pdfPageOf(book, 1) ?? 1, book.contentEnd);
const end = Math.min(book.contentEnd, start + maxPages - 1);
let text = "";
for (let p = start; p <= end; p++) {
  text += `\n\n<page number="${printedPage(book, p)}" pdf-page="${p}">\n${book.pages[p - 1]}\n</page>`;
}
await writeFile(OUT, text.trimStart() + "\n");
console.log(`next: "${book.title}" (source: ${book.title}), printed page ${printedPage(book, start)} (PDF page ${start})`);
console.log(`wrote printed pages ${printedPage(book, start)}-${printedPage(book, end)} (${text.length.toLocaleString()} chars) to ${OUT}`);

// Loads the learner's textbooks, in reading order, as arrays of page texts so
// lessons can work through them.
//
// Sources, in order of preference:
//   1. every .pdf / .md / .txt file in textbook/ (README.md excluded), in
//      file-name order; prefix names with 1-, 2- … to choose another order
//   2. the URLs in $TEXTBOOK_URL, separated by spaces or newlines, in order
//      (for keeping the books out of a public repo)
//
// Each book is { name, title, pages, labels, contentEnd }:
//   title       the file name without its extension; lessons cite it in `source:`
//   labels      the page numbers printed in the book (PDF page labels), or null
//   contentEnd  the last PDF page before the index (from the PDF outline), so a
//               book counts as finished without lessons on its index
import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const TEXT_PAGE_CHARS = 3500;

export async function loadTextbooks(dir = "textbook") {
  const sources = [];
  let files = [];
  try {
    files = (await readdir(dir)).filter((f) => !f.startsWith(".") && /\.(pdf|md|txt)$/i.test(f) && f.toLowerCase() !== "readme.md").sort();
  } catch {}
  if (files.length) {
    for (const f of files) sources.push({ name: f, bytes: await readFile(join(dir, f)) });
  } else if (process.env.TEXTBOOK_URL) {
    for (const u of process.env.TEXTBOOK_URL.split(/\s+/).filter(Boolean)) {
      const url = new URL(u);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`TEXTBOOK_URL ${u}: HTTP ${res.status}`);
      let name = decodeURIComponent(url.pathname.split("/").pop() || "textbook");
      const type = res.headers.get("content-type") ?? "";
      if (!extname(name) && type.includes("pdf")) name += ".pdf";
      sources.push({ name, bytes: new Uint8Array(await res.arrayBuffer()) });
    }
  }

  const books = [];
  for (const { name, bytes } of sources) {
    const isPdf = extname(name).toLowerCase() === ".pdf" || (bytes[0] === 0x25 && bytes[1] === 0x50); // "%P"
    const book = isPdf ? await pdfBook(bytes) : { pages: textPages(new TextDecoder().decode(bytes)), labels: null };
    books.push({ name, title: basename(name, extname(name)), contentEnd: book.pages.length, ...book });
  }
  return books;
}

// The page number printed in the book for a PDF page (1-based).
export function printedPage(book, pdfPage) {
  return book.labels?.[pdfPage - 1] || String(pdfPage);
}

// The PDF page (1-based) that carries a printed page number, or null.
export function pdfPageOf(book, printed) {
  if (!book.labels) return Number(printed) || null;
  const i = book.labels.indexOf(String(printed));
  return i < 0 ? null : i + 1;
}

async function pdfBook(bytes) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  const doc = await task.promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      text += item.str;
      text += item.hasEOL ? "\n" : "";
    }
    pages.push(text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim());
    page.cleanup();
  }
  const labels = await doc.getPageLabels().catch(() => null);
  let contentEnd;
  for (const item of (await doc.getOutline().catch(() => null)) ?? []) {
    if (!/^\s*index\s*$/i.test(item.title)) continue;
    try {
      const dest = typeof item.dest === "string" ? await doc.getDestination(item.dest) : item.dest;
      contentEnd = (await doc.getPageIndex(dest[0])); // 0-based index of the Index page = last content page, 1-based
    } catch {}
  }
  await task.destroy();
  return { pages, labels, ...(contentEnd ? { contentEnd } : {}) };
}

// Plain text / Markdown has no pages, so cut it into page-sized chunks at
// paragraph boundaries.
function textPages(text) {
  const pages = [];
  let current = "";
  for (const para of text.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    if (current && current.length + para.length > TEXT_PAGE_CHARS) {
      pages.push(current);
      current = "";
    }
    current += (current ? "\n\n" : "") + para;
  }
  if (current) pages.push(current);
  return pages;
}

// "45-52" or "45–52" or "45" -> { start, end }
export function parsePageRange(value) {
  const m = /^\s*(\d+)\s*(?:[-–]\s*(\d+))?\s*$/.exec(String(value ?? ""));
  if (!m) return null;
  const start = Number(m[1]);
  const end = Number(m[2] ?? m[1]);
  return end >= start ? { start, end } : null;
}

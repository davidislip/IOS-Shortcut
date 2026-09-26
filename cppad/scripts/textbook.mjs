// Loads the learner's textbook as an array of page texts so the lesson
// generator can work through it in order.
//
// Sources, in order of preference:
//   1. the first .pdf / .md / .txt file in textbook/ (README.md excluded)
//   2. the URL in $TEXTBOOK_URL (for keeping the book out of a public repo)
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const TEXT_PAGE_CHARS = 3500;

export async function loadTextbook(dir = "textbook") {
  let name;
  let bytes;
  let files = [];
  try {
    files = (await readdir(dir)).filter((f) => /\.(pdf|md|txt)$/i.test(f) && f.toLowerCase() !== "readme.md").sort();
  } catch {}
  if (files.length) {
    name = files[0];
    bytes = await readFile(join(dir, name));
  } else if (process.env.TEXTBOOK_URL) {
    const url = new URL(process.env.TEXTBOOK_URL);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TEXTBOOK_URL: HTTP ${res.status}`);
    name = decodeURIComponent(url.pathname.split("/").pop() || "textbook");
    bytes = new Uint8Array(await res.arrayBuffer());
    const type = res.headers.get("content-type") ?? "";
    if (!extname(name) && type.includes("pdf")) name += ".pdf";
  } else {
    return null;
  }

  const isPdf = extname(name).toLowerCase() === ".pdf" || (bytes[0] === 0x25 && bytes[1] === 0x50); // "%P"
  const pages = isPdf ? await pdfPages(bytes) : textPages(new TextDecoder().decode(bytes));
  return { name, pages };
}

async function pdfPages(bytes) {
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
  await task.destroy();
  return pages;
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

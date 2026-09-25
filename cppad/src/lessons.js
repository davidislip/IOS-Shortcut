// Loads the lesson index and renders lesson Markdown into HTML.
import { Marked } from "marked";
import { highlightCode, classHighlighter } from "@lezer/highlight";
import { parser as cppParser } from "@lezer/cpp";
import { parseLesson } from "./lesson-format.js";

export async function loadIndex() {
  const res = await fetch("lessons/index.json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`lessons/index.json: HTTP ${res.status}`);
  return res.json();
}

export async function loadLesson(file) {
  const res = await fetch(`lessons/${file}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return parseLesson(await res.text());
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function highlightCpp(code) {
  let html = "";
  highlightCode(
    code,
    cppParser.parse(code),
    classHighlighter,
    (text, classes) => { html += classes ? `<span class="${classes}">${escapeHtml(text)}</span>` : escapeHtml(text); },
    () => { html += "\n"; },
  );
  return html;
}

const marked = new Marked({
  gfm: true,
  renderer: {
    code({ text, lang }) {
      const words = (lang ?? "").trim().split(/\s+/);
      const kind = words[0];
      const tag = words[1];
      const isCpp = ["cpp", "c++", "cc", "c"].includes(kind);
      const body = isCpp ? highlightCpp(text) : escapeHtml(text);
      const encoded = encodeURIComponent(text);
      if (isCpp && tag === "solution") {
        return `<details class="solution"><summary>Show solution</summary>
          <div class="code-card"><div class="code-actions"><button type="button" data-action="load-code" data-code="${encoded}">Load solution into editor</button></div>
          <pre><code class="lang-cpp">${body}</code></pre></div></details>`;
      }
      if (isCpp) {
        const label = tag === "starter" ? "Exercise starter" : "Example";
        return `<div class="code-card ${tag === "starter" ? "starter" : ""}"><div class="code-actions"><span class="code-label">${label}</span>
          <button type="button" data-action="load-code" data-code="${encoded}">Open in editor</button></div>
          <pre><code class="lang-cpp">${body}</code></pre></div>`;
      }
      if (kind === "expected") {
        return `<div class="code-card expected"><div class="code-actions"><span class="code-label">Expected output</span></div><pre><code>${body}</code></pre></div>`;
      }
      if (kind === "stdin") {
        return `<div class="code-card stdin"><div class="code-actions"><span class="code-label">Sample input (used by Check)</span></div><pre><code>${body}</code></pre></div>`;
      }
      return `<pre><code>${body}</code></pre>`;
    },
  },
});

export function renderLesson(lesson) {
  const { meta } = lesson;
  const header = `<div class="lesson-meta">${meta.id != null ? `Lesson ${escapeHtml(String(meta.id))}` : ""}${meta.minutes ? ` · ~${escapeHtml(String(meta.minutes))} min` : ""}${meta.concept ? ` · ${escapeHtml(String(meta.concept))}` : ""}</div>${meta.source_pages ? `<div class="lesson-source">📖 Textbook pages ${escapeHtml(String(meta.source_pages).replace("-", "–"))}</div>` : ""}`;
  const title = meta.title && !/^\s*#\s/.test(lesson.body) ? `<h1>${escapeHtml(meta.title)}</h1>` : "";
  return header + title + marked.parse(lesson.body);
}

// Shared by the app (browser) and the Node scripts (build, check, next-pages).
//
// A lesson is a Markdown file with a small front-matter header:
//
//   ---
//   id: 7
//   title: Classes and RAII
//   concept: constructors, destructors, scope
//   minutes: 10
//   ---
//
// Special fenced blocks:
//   ```cpp starter    code loaded into the editor when the lesson opens
//   ```cpp solution   hidden behind a "Show solution" button
//   ```expected       exact program output used for the automatic check
//   ```stdin          input fed to the program during the automatic check

export function parseFrontMatter(text) {
  const meta = {};
  let body = text;
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (m) {
    body = text.slice(m[0].length);
    for (const line of m[1].split(/\r?\n/)) {
      const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
      if (!kv) continue;
      let v = kv[2].trim();
      if (/^".*"$/.test(v) || /^'.*'$/.test(v)) v = v.slice(1, -1);
      meta[kv[1]] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
    }
  }
  return { meta, body };
}

// Returns the first fenced block whose info string matches, e.g. ("cpp", "starter").
export function extractBlock(body, lang, tag) {
  const re = /^(```+|~~~+)[ \t]*([^\n]*)\n([\s\S]*?)^\1[ \t]*$/gm;
  let m;
  while ((m = re.exec(body))) {
    const words = m[2].trim().split(/\s+/);
    if (words[0] === lang && (tag === undefined ? true : words.includes(tag))) {
      return m[3].replace(/\n$/, "");
    }
  }
  return null;
}

export function parseLesson(text) {
  const { meta, body } = parseFrontMatter(text);
  return {
    meta,
    body,
    starter: extractBlock(body, "cpp", "starter"),
    solution: extractBlock(body, "cpp", "solution"),
    expected: extractBlock(body, "expected"),
    stdin: extractBlock(body, "stdin"),
  };
}

// Output comparison used by the checker: ignore trailing whitespace on each
// line and trailing blank lines, so "Hello\n" matches "Hello".
export function normalizeOutput(s) {
  return (s ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");
}

export const DEFAULT_FLAGS = ["-std=c++23", "-O1", "-Wall", "-Wextra"];
// Always added: the bundled libc++ is built without exception support.
export const FORCED_FLAGS = ["-fno-exceptions"];

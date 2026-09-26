// Asks Claude to write the next lesson, then verifies it with the real
// toolchain (every full program must compile; the solution's output must
// match the expected block). Failed checks are sent back to Claude to fix.
//
// If a textbook is available (see textbook/README.md), lessons walk through
// it in order: each lesson records the pages it used in `source_pages`, and
// the next lesson starts on the page after the highest one covered so far.
// Without a textbook, or once it's finished, lessons follow CURRICULUM.md.
//
//   ANTHROPIC_API_KEY=... node scripts/generate-lesson.mjs
//   TOPIC="std::map word counting" node scripts/generate-lesson.mjs
//
// Environment:
//   ANTHROPIC_API_KEY  required
//   TOPIC              optional; a specific topic instead of the next one
//   TEXTBOOK_URL       optional; where to download the textbook from
//   MODEL              optional; defaults to claude-opus-5
//   DRY_RUN            optional; print the prompt instead of calling Claude
//   GITHUB_OUTPUT      set by GitHub Actions; receives file= and title=
import Anthropic from "@anthropic-ai/sdk";
import { appendFile, readdir, readFile, writeFile } from "node:fs/promises";
import { parseFrontMatter } from "../src/lesson-format.js";
import { checkLesson } from "./check-lessons.mjs";
import { loadTextbook, parsePageRange } from "./textbook.mjs";

const MODEL = process.env.MODEL || "claude-opus-5";
const MAX_FIX_ROUNDS = 3;
// How much of the book Claude sees per lesson (~20k tokens). A lesson uses
// only the first section of it; the rest is context for where it's going.
const WINDOW_CHARS = 80_000;
const WINDOW_MAX_PAGES = 40;

const lessonFiles = (await readdir("lessons")).filter((f) => /^\d.*\.md$/.test(f)).sort();
const lessons = [];
for (const file of lessonFiles) {
  const { meta } = parseFrontMatter(await readFile(`lessons/${file}`, "utf8"));
  lessons.push({ file, id: meta.id, title: meta.title, concept: meta.concept, pages: parsePageRange(meta.source_pages) });
}
const nextId = Math.max(0, ...lessons.map((l) => Number(l.id) || 0)) + 1;
const curriculum = await readFile("lessons/CURRICULUM.md", "utf8");
const example = await readFile("lessons/003-decisions-and-loops.md", "utf8");
const topic = process.env.TOPIC?.trim();

// ------------------------------------------------------------- textbook ---

let book = null;      // { name, pages }
let pageWindow = null;    // { start, end, text } (1-based page numbers)
if (!topic) {
  book = await loadTextbook();
  if (book) {
    const start = Math.max(0, ...lessons.map((l) => l.pages?.end ?? 0)) + 1;
    if (start > book.pages.length) {
      console.log(`textbook "${book.name}" is finished (${book.pages.length} pages); using CURRICULUM.md`);
    } else {
      let text = "";
      let end = start - 1;
      while (end < book.pages.length && end - start + 1 < WINDOW_MAX_PAGES && text.length < WINDOW_CHARS) {
        end++;
        text += `\n\n<page number="${end}">\n${book.pages[end - 1]}\n</page>`;
      }
      pageWindow = { start, end, text };
      console.log(`textbook "${book.name}": giving Claude pages ${start}–${end} of ${book.pages.length}`);
    }
  } else {
    console.log("no textbook found; using CURRICULUM.md");
  }
}

// --------------------------------------------------------------- prompt ---

const SYSTEM = `You write short, excellent C++ lessons for one learner who studies on an iPad during a subway commute (about 10–15 minutes per lesson, often offline). The lessons are rendered by a small app with a code editor and a terminal; the learner reads, then completes one small exercise that runs on the device.

# The learner
- Starting from the absolute basics: assume no programming experience beyond the earlier lessons.
- Define every new term the first time it appears, in plain words. Introduce one new idea at a time and show it working before combining it with others.
- Prefer a concrete example first, then the general rule.

# The runtime (hard constraints; code that breaks these fails the automated check)
- Compiler: clang++ 22 with libc++, targeting wasm32-wasi. Flags: -std=c++23 -O1 -Wall -Wextra -fno-exceptions.
- NO exceptions: never use throw/try/catch, and don't rely on exceptions being thrown (e.g. vector::at out of range aborts the program). For error handling use return values, std::optional or std::expected. If source material relies on exceptions, teach the idea with an alternative and mention briefly that exceptions exist and come up later.
- NO threads, no std::thread/async/mutex, no networking, no file system access (only stdin/stdout/stderr), no command-line args.
- Single file main.cpp. Only the standard library.
- Output must be deterministic: no wall-clock times, addresses, unseeded randomness or unordered_map iteration order in the checked output. <chrono> is fine for timing demos if the timings are not part of the expected output.
- Writing to std::cout and reading std::cin work. stdin is interactive in the app.
- There is no IDE, project setup or separate compile step to explain: the learner taps Run, and the terminal shows the clang++ command and the output.

# Lesson format (Markdown with front matter)
---
id: <number>
title: <short title>
concept: <comma-separated key concepts>
minutes: <estimate>
source_pages: <first>-<last>   (only when told to use the textbook)
---
# <Title>
...teaching content with small example code blocks...

Required special blocks, exactly one each:
- \`\`\`cpp starter  a complete program the learner edits. It should compile if possible (use TODO comments), except when the exercise is to write missing functions.
- \`\`\`cpp solution  a complete, idiomatic solution.
- \`\`\`expected     the exact stdout of the solution (the app compares it; trailing whitespace ignored).
- \`\`\`stdin        ONLY if the solution reads input: the sample input used for the check.

Every \`\`\`cpp block that contains \`int main(\` must compile on its own (include all headers). Smaller fragments without main are fine for illustration.

# Style
- Build on earlier lessons; don't re-teach them, but you may reference them ("like in lesson 4").
- Explain the *why*, not just the syntax. Point out one common pitfall. Use modern, idiomatic C++ (C++20/23); if the learner will often meet an older style in the wild, show it briefly and say what replaced it.
- Keep it tight: an iPad screen, a moving train. Short paragraphs, headings, small examples, one table at most.
- A light transit/commute flavour in examples is welcome but optional.
- The exercise should take 5–10 minutes and have a clear spec, with the expected output shown before the starter.
- Use "> 💡" for tips and "> ⚠️" for pitfalls.

# Using the textbook (when pages are provided)
- The textbook sets the order and scope: teach the next section of the book, not something from later on.
- Write your own explanations, examples and exercises. Don't copy the book's prose; at most quote a short phrase. You may reuse the book's terminology and the idea behind an example.
- If the book uses older C++ than C++23, teach the book's concept with modern code and mention the book's style where it helps.
- Skip material that doesn't apply here (preface, table of contents, installing a compiler, IDE walkthroughs, history). Also skip content the existing lessons already teach well, but you may go deeper where the book adds substance.
- One lesson = one teachable idea, usually one book section (a few pages). Don't cram the whole pageWindow in.
- Set source_pages to "<first page you were given>-<last page this lesson covers>", including any skipped pages before it. The next lesson starts on the page after that, so don't end mid-idea, and don't claim pages you didn't teach.

Here is an existing lesson that shows the format and tone:

<example_lesson>
${example}
</example_lesson>

Reply with the complete lesson Markdown inside <lesson></lesson> tags and nothing else.`;

let task;
if (topic) {
  task = `The learner asked for this topic: ${topic}\n\nWrite lesson ${nextId}. Don't add source_pages.`;
} else if (pageWindow) {
  task = `Here are pages ${pageWindow.start}–${pageWindow.end} (of ${book.pages.length}) of the learner's textbook, "${book.name}". Text was extracted from the book, so layout, code indentation and figures may be garbled.

<textbook_pages>${pageWindow.text}
</textbook_pages>

Write lesson ${nextId}, teaching the first section that starts at page ${pageWindow.start} (after skipping anything that doesn't apply). Set source_pages to "${pageWindow.start}-<last page covered>".`;
} else {
  task = `Roadmap:
<curriculum>
${curriculum}
</curriculum>

Pick the first topic in the roadmap's 'Next up' section that the existing lessons don't cover yet (skip lines marked (skip)). Write lesson ${nextId}. Don't add source_pages.`;
}

const userPrompt = `Existing lessons:
${lessons.map((l) => `- ${l.id}. ${l.title} (${l.concept})${l.pages ? ` [textbook pp. ${l.pages.start}-${l.pages.end}]` : ""}`).join("\n")}

${task}`;

// ------------------------------------------------------------- generate ---

if (process.env.DRY_RUN) {
  console.log(`--- system (${SYSTEM.length} chars) ---\n${SYSTEM.slice(0, 400)}…\n--- user (${userPrompt.length} chars) ---\n${userPrompt}`);
  process.exit(0);
}

const client = new Anthropic();
const messages = [{ role: "user", content: userPrompt }];

async function ask() {
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages,
    // Retry on another model server-side if a safety classifier declines.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("Claude declined to write this lesson.");
  if (message.stop_reason === "max_tokens") throw new Error("Response hit max_tokens before finishing.");
  messages.push({ role: "assistant", content: message.content });
  const text = message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const m = /<lesson>\s*([\s\S]*?)\s*<\/lesson>/.exec(text);
  return (m ? m[1] : text).trim() + "\n";
}

function sourcePageProblems(lesson) {
  const { meta } = parseFrontMatter(lesson);
  if (!pageWindow) {
    return meta.source_pages ? ["remove source_pages: this lesson isn't based on the textbook"] : [];
  }
  const range = parsePageRange(meta.source_pages);
  if (!range) return [`front matter needs source_pages: "${pageWindow.start}-<last page covered>"`];
  if (range.start !== pageWindow.start) return [`source_pages must start at ${pageWindow.start}, the first page you were given`];
  if (range.end > pageWindow.end) return [`source_pages can't go past page ${pageWindow.end}, the last page you were given`];
  return [];
}

function slugify(s) {
  return s.toLowerCase().replace(/std::/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "lesson";
}

let lesson = await ask();
for (let round = 1; ; round++) {
  // Force the id we expect, whatever the model wrote.
  lesson = lesson.replace(/^(---\r?\n[\s\S]*?^id:\s*)\S+/m, (_, head) => head + nextId);
  console.log(`checking draft ${round}…`);
  const problems = [...sourcePageProblems(lesson), ...(await checkLesson(lesson))];
  if (!problems.length) break;
  console.log(problems.join("\n\n"));
  if (round > MAX_FIX_ROUNDS) {
    console.error("giving up: lesson still fails its checks");
    process.exit(1);
  }
  messages.push({
    role: "user",
    content: `The automated check found problems:\n\n${problems.join("\n\n")}\n\nFix them and reply with the complete corrected lesson inside <lesson></lesson> tags.`,
  });
  lesson = await ask();
}

const { meta } = parseFrontMatter(lesson);
const file = `${String(nextId).padStart(3, "0")}-${slugify(String(meta.title ?? "lesson"))}.md`;
await writeFile(`lessons/${file}`, lesson);
console.log(`wrote lessons/${file}: ${meta.title}${meta.source_pages ? ` (textbook pp. ${meta.source_pages})` : ""}`);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `file=${file}\ntitle=${String(meta.title).replace(/\n/g, " ")}\n`);
}

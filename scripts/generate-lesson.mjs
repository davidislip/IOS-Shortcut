// Asks Claude to write the next lesson, then verifies it with the real
// toolchain (every full program must compile; the solution's output must
// match the expected block). Failed checks are sent back to Claude to fix.
//
//   ANTHROPIC_API_KEY=... node scripts/generate-lesson.mjs
//   TOPIC="std::map word counting" node scripts/generate-lesson.mjs
//
// Environment:
//   ANTHROPIC_API_KEY  required
//   TOPIC              optional; otherwise the next uncovered CURRICULUM.md topic
//   MODEL              optional; defaults to claude-opus-5
//   GITHUB_OUTPUT      set by GitHub Actions; receives file= and title=
import Anthropic from "@anthropic-ai/sdk";
import { appendFile, readdir, readFile, writeFile } from "node:fs/promises";
import { parseFrontMatter } from "../src/lesson-format.js";
import { checkLesson } from "./check-lessons.mjs";

const MODEL = process.env.MODEL || "claude-opus-5";
const MAX_FIX_ROUNDS = 3;

const lessonFiles = (await readdir("lessons")).filter((f) => /^\d.*\.md$/.test(f)).sort();
const lessons = [];
for (const file of lessonFiles) {
  const { meta } = parseFrontMatter(await readFile(`lessons/${file}`, "utf8"));
  lessons.push({ file, id: meta.id, title: meta.title, concept: meta.concept });
}
const nextId = Math.max(0, ...lessons.map((l) => Number(l.id) || 0)) + 1;
const curriculum = await readFile("lessons/CURRICULUM.md", "utf8");
const example = await readFile("lessons/005-vectors-and-algorithms.md", "utf8");

const SYSTEM = `You write short, excellent C++ lessons for one learner who studies on an iPad during a subway commute (about 10–15 minutes per lesson, often offline). The lessons are rendered by a small app with a code editor and a terminal; the learner reads, then completes one small exercise that runs on the device.

# The runtime (hard constraints; code that breaks these fails the automated check)
- Compiler: clang++ 22 with libc++, targeting wasm32-wasi. Flags: -std=c++23 -O1 -Wall -Wextra -fno-exceptions.
- NO exceptions: never use throw/try/catch, and don't rely on exceptions being thrown (e.g. vector::at out of range aborts the program). For error handling use return values, std::optional or std::expected.
- NO threads, no std::thread/async/mutex, no networking, no file system access (only stdin/stdout/stderr), no command-line args.
- Single file main.cpp. Only the standard library.
- Output must be deterministic: no wall-clock times, addresses, unseeded randomness or unordered_map iteration order in the checked output. <chrono> is fine for timing demos if the timings are not part of the expected output.
- Writing to std::cout and reading std::cin work. stdin is interactive in the app.

# Lesson format (Markdown with front matter)
---
id: <number>
title: <short title>
concept: <comma-separated key concepts>
minutes: <estimate>
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
- Explain the *why*, not just the syntax. Point out one common pitfall. Use modern, idiomatic C++ (C++20/23) and mention what older code looks like when the learner is likely to see it.
- Keep it tight: an iPad screen, a moving train. Short paragraphs, headings, small examples, one table at most.
- A light transit/commute flavour in examples is welcome but optional.
- The exercise should take 5–10 minutes and have a clear spec, with the expected output shown before the starter.
- Use "> 💡" for tips and "> ⚠️" for pitfalls.

Here is an existing lesson that shows the format and tone:

<example_lesson>
${example}
</example_lesson>

Reply with the complete lesson Markdown inside <lesson></lesson> tags and nothing else.`;

const topicLine = process.env.TOPIC?.trim()
  ? `The learner asked for this topic: ${process.env.TOPIC.trim()}`
  : "Pick the first topic in the roadmap's 'Next up' section that the existing lessons don't cover yet (skip lines marked (skip)).";

const userPrompt = `Existing lessons:
${lessons.map((l) => `- ${l.id}. ${l.title} (${l.concept})`).join("\n")}

Roadmap:
<curriculum>
${curriculum}
</curriculum>

${topicLine}

Write lesson ${nextId}.`;

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

function slugify(s) {
  return s.toLowerCase().replace(/std::/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "lesson";
}

let lesson = await ask();
for (let round = 1; ; round++) {
  // Force the id we expect, whatever the model wrote.
  lesson = lesson.replace(/^(---\r?\n[\s\S]*?^id:\s*)\S+/m, (_, head) => head + nextId);
  console.log(`checking draft ${round}…`);
  const problems = await checkLesson(lesson);
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
console.log(`wrote lessons/${file}: ${meta.title}`);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `file=${file}\ntitle=${String(meta.title).replace(/\n/g, " ")}\n`);
}

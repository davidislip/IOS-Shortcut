import { createEditor } from "./editor.js";
import { Terminal } from "./terminal.js";
import { loadIndex, loadLesson, renderLesson } from "./lessons.js";
import { DEFAULT_FLAGS, FORCED_FLAGS, normalizeOutput } from "./lesson-format.js";

const $ = (sel) => document.querySelector(sel);
const PLAYGROUND = "playground";
const PLAYGROUND_CODE = `#include <iostream>
#include <string>
#include <vector>

// Playground: anything goes. Tap Run (or ⌘↩) to compile and run.
int main() {
    std::vector<std::string> stops{"Union", "St Andrew", "Osgoode", "Queen's Park"};
    for (const auto& s : stops) {
        std::cout << "Next stop: " << s << '\\n';
    }
}
`;

// ---------------------------------------------------------------- state ---

const store = loadState();
function loadState() {
  const fallback = { current: null, code: {}, done: {}, seen: {}, flags: DEFAULT_FLAGS.join(" "), fontSize: 16, lessonHidden: false };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem("cppad.state") ?? "{}") };
  } catch {
    return fallback;
  }
}
let saveTimer;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem("cppad.state", JSON.stringify(store)); } catch {}
  }, 300);
}

let index = [];
let lesson = null; // parsed current lesson (null in the playground)

// ------------------------------------------------------------- compiler ---

class Compiler {
  constructor() {
    this.worker = null;
    this.pending = new Map();
    this.nextId = 1;
    this.ready = false;
    this.onStatus = () => {};
  }
  #ensure() {
    if (this.worker) return;
    this.worker = new Worker("compiler-worker.js", { type: "module" });
    this.worker.onmessage = (ev) => {
      const msg = ev.data;
      if (msg.type === "progress") {
        const pct = msg.total ? Math.floor((msg.done / msg.total) * 100) : 0;
        this.onStatus(pct >= 100 ? "loading" : "downloading", pct);
      } else if (msg.type === "result") {
        this.ready = true;
        this.onStatus("ready");
        this.pending.get(msg.id)?.(msg);
        this.pending.delete(msg.id);
      }
    };
    this.worker.onerror = (e) => {
      for (const resolve of this.pending.values()) {
        resolve({ ok: false, diagnostics: `compiler worker failed: ${e.message ?? "unknown error"}\n` });
      }
      this.pending.clear();
      this.worker = null;
      this.onStatus("error");
    };
  }
  #send(msg) {
    this.#ensure();
    if (!this.ready) this.onStatus("loading");
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.worker.postMessage({ ...msg, id });
    });
  }
  compile(source, flags) { return this.#send({ type: "compile", source, flags }); }
  warmup() { return this.#send({ type: "warmup" }); }
}
const compiler = new Compiler();

// --------------------------------------------------------------- runner ---

const canInteract = () => self.crossOriginIsolated && typeof SharedArrayBuffer !== "undefined";
let running = null; // { worker, deliver, stop }
let stdinQueue = [];

function runProgram(wasm, { stdin } = {}) {
  return new Promise((resolve) => {
    const worker = new Worker("runner-worker.js", { type: "module" });
    let stdout = "";
    let waiting = false;
    let shared = null;
    let ctrl, data;
    if (stdin == null && canInteract()) {
      shared = new SharedArrayBuffer(8 + 65536);
      ctrl = new Int32Array(shared, 0, 2);
      data = new Uint8Array(shared, 8);
    }
    const encoder = new TextEncoder();
    const deliver = (text) => {
      if (!shared) return false;
      if (!waiting) { stdinQueue.push(text); return true; }
      waiting = false;
      if (text === null) ctrl[1] = -1;
      else {
        const bytes = encoder.encode(text).slice(0, data.length);
        data.set(bytes);
        ctrl[1] = bytes.length;
      }
      Atomics.store(ctrl, 0, 1);
      Atomics.notify(ctrl, 0);
      term.setMode("running");
      return true;
    };
    const finish = (code, ms, killed = false) => {
      worker.terminate();
      running = null;
      stdinQueue = [];
      resolve({ code, ms, stdout, killed });
    };
    worker.onmessage = (ev) => {
      const msg = ev.data;
      if (msg.type === "output") {
        for (const c of msg.chunks) {
          if (c.stream === "stdout") stdout += c.text;
          term.write(c.text, c.stream === "stderr" ? "stderr" : "");
        }
      } else if (msg.type === "stdin-request") {
        waiting = true;
        if (stdinQueue.length) deliver(stdinQueue.shift());
        else { term.setMode("stdin"); term.focus(); }
      } else if (msg.type === "crash") {
        term.writeln(`\n${friendlyTrap(msg.message)}`, "error");
      } else if (msg.type === "exit") {
        finish(msg.code, msg.ms);
      }
    };
    worker.onerror = (e) => {
      term.writeln(`\nrunner error: ${e.message}`, "error");
      finish(1, 0);
    };
    running = { deliver, stop: () => finish(130, 0, true) };
    worker.postMessage({ wasm, shared, stdin: shared ? undefined : (stdin ?? ""), args: ["main"] }, []);
  });
}

function friendlyTrap(message) {
  if (/unreachable/.test(message)) return `💥 Program aborted (${message}). Common causes: calling abort(), a failed assert, or std::vector::at() out of range.`;
  if (/out of bounds/.test(message)) return `💥 Crash: ${message}. You probably read/wrote through a bad pointer or past the end of an array.`;
  if (/call stack/i.test(message)) return `💥 Stack overflow: ${message}. Is a recursive function missing its base case?`;
  return `💥 Program crashed: ${message}`;
}

// --------------------------------------------------------------- build ---

let lastBuild = null; // { key, wasm, source }
let busy = false;

function currentFlags(override) {
  const user = (override ?? store.flags).split(/\s+/).filter(Boolean);
  return [...user, ...FORCED_FLAGS, "-fcolor-diagnostics"];
}

async function build(flagsOverride) {
  const source = editor.value;
  const flags = currentFlags(flagsOverride);
  const key = flags.join(" ") + "\0" + source;
  if (lastBuild?.key === key) return lastBuild;
  const shown = flags.filter((f) => f !== "-fcolor-diagnostics" && f !== "-fno-exceptions").join(" ");
  term.writeln(`clang++ ${shown} main.cpp -o main`, "cmd");
  if (!compiler.ready) term.writeln("(starting the compiler, first build takes a few seconds…)", "dim");
  const res = await compiler.compile(source, flags);
  if (res.diagnostics) term.writeDiagnostics(res.diagnostics);
  if (!res.ok) {
    if (/exceptions disabled/.test(res.diagnostics)) {
      term.writeln("hint: this offline toolchain has no C++ exception support, so throw/try/catch won't compile. Return an error value (std::optional, std::expected) instead.", "hint");
    }
    term.writeln(`✗ build failed (${fmtMs(res.ms)})`, "error");
    return null;
  }
  term.writeln(`✓ built in ${fmtMs(res.ms)}`, "ok");
  lastBuild = { key, wasm: res.wasm, source };
  return lastBuild;
}

async function execute(buildResult, { stdin } = {}) {
  if (stdin === undefined && !canInteract() && /\b(cin|getline|scanf|getchar|fgets)\b/.test(buildResult.source)) {
    const typed = window.prompt("This program reads input. Type it here (use ; to separate lines).\n\nTip: reopen the app once and input becomes interactive.");
    term.writeln("(interactive input unavailable in this session; using the text you entered)", "dim");
    stdin = (typed ?? "").split(";").join("\n") + "\n";
  }
  term.writeln(stdin !== undefined && stdin !== "" ? "./main < input" : "./main", "cmd");
  term.setMode("running");
  setRunningUi(true);
  const res = await runProgram(buildResult.wasm, { stdin });
  setRunningUi(false);
  term.setMode("shell");
  if (res.stdout && !res.stdout.endsWith("\n")) term.write("\n");
  if (res.killed) term.writeln("^C  program stopped", "error");
  else term.writeln(`[exit ${res.code} · ${fmtMs(res.ms)}]`, res.code === 0 ? "dim" : "error");
  return res;
}

async function runCurrent({ check = false, flags } = {}) {
  if (busy) return;
  busy = true;
  showTab("term");
  try {
    const b = await build(flags);
    if (!b) return;
    const shouldCheck = lesson?.expected != null && (check || lesson.stdin == null);
    const res = await execute(b, { stdin: check ? (lesson?.stdin ?? "") : undefined });
    if (shouldCheck && !res.killed) verify(res.stdout);
    else if (check && lesson?.expected == null) term.writeln("This lesson has no automatic check. Mark it done from the lesson pane when you're happy.", "hint");
  } finally {
    busy = false;
    term.focus();
  }
}

function verify(stdout) {
  const got = normalizeOutput(stdout);
  const want = normalizeOutput(lesson.expected);
  if (got === want) {
    term.writeln("✔ Output matches the expected output. Lesson complete!", "success");
    markDone(true);
    return;
  }
  const g = got.split("\n");
  const w = want.split("\n");
  let i = 0;
  while (i < Math.max(g.length, w.length) && g[i] === w[i]) i++;
  term.writeln(`✗ Not quite: output differs from the expected output at line ${i + 1}.`, "error");
  term.writeln(`  expected: ${JSON.stringify(w[i] ?? "<end of output>")}`, "hint");
  term.writeln(`  got:      ${JSON.stringify(g[i] ?? "<end of output>")}`, "hint");
}

function fmtMs(ms) {
  return ms == null ? "?" : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

// ------------------------------------------------------------ commands ---

const HELP = `
\x1b[1mcommands\x1b[0m
  run, r              compile and run main.cpp      (also: ▶ button, ⌘↩)
  check               run against the lesson's sample input and compare output
  make, build         compile only
  g++ -O2 main.cpp    compile with one-off flags (also clang++)
  ./main              run the last build
  flags [..]          show or set default compiler flags
  cat main.cpp, ls    look at your file
  lessons             list lessons       open <n>   jump to lesson n
  next, prev          move between lessons
  reset               restore the lesson's starter code
  solution            load the lesson's solution into the editor
  playground          free-form scratch file
  clear               clear the screen (ctrl-L)
  version             toolchain info
`;

async function onCommand(line) {
  if (line === "\x03") { running?.stop(); return; }
  const [cmd, ...args] = line.trim().split(/\s+/);
  if (!cmd) return;
  if (running) {
    running.deliver(line + "\n");
    return;
  }
  switch (cmd) {
    case "help": case "?": term.write(HELP); break;
    case "run": case "r": await runCurrent(); break;
    case "check": await runCurrent({ check: true }); break;
    case "make": case "build": {
      if (busy) break;
      busy = true;
      try { await build(); } finally { busy = false; }
      break;
    }
    case "g++": case "clang++": case "c++": case "gcc": case "clang": {
      if (busy) break;
      const flags = args.filter((a) => a.startsWith("-") && a !== "-o").join(" ");
      busy = true;
      try { await build(flags || undefined); } finally { busy = false; }
      break;
    }
    case "./main": case "./a.out": case "main": {
      if (!lastBuild) { term.writeln("no build yet: try `run` or `make`", "error"); break; }
      if (lastBuild.source !== editor.value) term.writeln("note: main.cpp changed since the last build; running the old binary", "hint");
      busy = true;
      try { await execute(lastBuild); } finally { busy = false; }
      break;
    }
    case "flags":
      if (args.length) {
        store.flags = args.join(" ");
        saveState();
      }
      term.writeln(`flags: ${store.flags}   (always added: ${FORCED_FLAGS.join(" ")})`);
      if (!args.length) term.writeln(`default: ${DEFAULT_FLAGS.join(" ")}. Example: flags -std=c++20 -O2 -Wall`, "dim");
      break;
    case "ls": term.writeln(`main.cpp${lastBuild ? "  main" : ""}`); break;
    case "cat":
      if (args[0] && args[0] !== "main.cpp") term.writeln(`cat: ${args[0]}: No such file`, "error");
      else term.writeln(editor.value);
      break;
    case "lessons":
      for (const l of index) term.writeln(`${store.done[l.file] ? "✓" : " "} ${String(l.id).padStart(3)}  ${l.title}`, store.done[l.file] ? "ok" : "");
      break;
    case "open": case "lesson": {
      const n = Number(args[0]);
      const target = index.find((l) => l.id === n);
      if (target) openLesson(target.file); else term.writeln(`no lesson ${args[0] ?? ""}`, "error");
      break;
    }
    case "next": stepLesson(1); break;
    case "prev": stepLesson(-1); break;
    case "reset": resetCode(); break;
    case "solution":
      if (lesson?.solution) setEditorCode(lesson.solution, true);
      else term.writeln("this lesson has no solution block", "error");
      break;
    case "playground": openLesson(PLAYGROUND); break;
    case "clear": case "cls": term.clear(); break;
    case "version":
      term.writeln("clang++ 22 (LLVM, YoWASP build) targeting wasm32-wasip1, libc++; runs fully offline in your browser.");
      term.writeln(`interactive stdin: ${canInteract() ? "yes" : "no (reload the app once)"}`, "dim");
      break;
    case "echo": term.writeln(args.join(" ")); break;
    case "sudo": term.writeln("nice try 🙂", "dim"); break;
    default: term.writeln(`cppad: command not found: ${cmd}  (type help)`, "error");
  }
}

// -------------------------------------------------------------- lessons ---

async function openLesson(file) {
  store.current = file;
  saveState();
  closeDrawer();
  const pane = $("#lesson");
  if (file === PLAYGROUND) {
    lesson = null;
    pane.innerHTML = `<div class="lesson-meta">Playground</div><h1>Playground</h1>
      <p>A scratch file for your own experiments. Nothing here is checked; it's saved automatically.</p>
      <p>Ideas: re-type an example from a lesson from memory, then change it until it breaks and read the compiler error.</p>`;
    loadEditorFor(file, PLAYGROUND_CODE);
    updateLessonUi();
    return;
  }
  pane.innerHTML = `<p class="dim">Loading…</p>`;
  try {
    lesson = await loadLesson(file);
    lesson.file = file;
  } catch (e) {
    pane.innerHTML = `<p class="error">Couldn't load this lesson (${e.message}). It will be available offline once it has been opened online.</p>`;
    return;
  }
  store.seen[file] = true;
  pane.innerHTML = renderLesson(lesson);
  pane.scrollTop = 0;
  loadEditorFor(file, lesson.starter ?? `#include <iostream>\n\nint main() {\n    \n}\n`);
  updateLessonUi();
  renderDrawer();
}

function loadEditorFor(file, fallback) {
  suppressSave = true;
  editor.value = store.code[file] ?? fallback;
  suppressSave = false;
  $("#file-name").textContent = file === PLAYGROUND ? "playground.cpp" : "main.cpp";
}

function stepLesson(delta) {
  const i = index.findIndex((l) => l.file === store.current);
  const target = index[i + delta] ?? (i === -1 ? index[0] : null);
  if (target) openLesson(target.file);
  else term.writeln(delta > 0 ? "that's the last lesson so far; new ones arrive automatically" : "already at the first lesson", "dim");
}

function resetCode() {
  if (!lesson?.starter) { term.writeln("nothing to reset to here", "dim"); return; }
  if (!confirm("Replace your code with the lesson's starter code?")) return;
  setEditorCode(lesson.starter, false);
}

function setEditorCode(code, ask) {
  if (ask && editor.value.trim() && editor.value !== code && !confirm("Replace the code in the editor?")) return;
  editor.value = code;
  showTab("code");
}

function markDone(done) {
  if (!lesson) return;
  if (done) store.done[lesson.file] = true; else delete store.done[lesson.file];
  saveState();
  updateLessonUi();
  renderDrawer();
  if (done) toast("Lesson complete 🎉");
}

function updateLessonUi() {
  const isLesson = !!lesson;
  const i = index.findIndex((l) => l.file === store.current);
  $("#lesson-title").textContent = isLesson ? lesson.meta.title ?? lesson.file : "Playground";
  $("#btn-check").hidden = !isLesson;
  $("#btn-done").hidden = !isLesson;
  $("#btn-done").textContent = isLesson && store.done[lesson.file] ? "✓ Done" : "Mark done";
  $("#btn-done").classList.toggle("is-done", isLesson && !!store.done[lesson.file]);
  $("#btn-next").hidden = !isLesson || i === index.length - 1;
  $("#btn-next").classList.toggle("primary", isLesson && !!store.done[lesson.file]);
}

function renderDrawer() {
  const list = $("#lesson-list");
  list.replaceChildren();
  const done = index.filter((l) => store.done[l.file]).length;
  $("#progress-text").textContent = `${done} / ${index.length} lessons done`;
  $("#progress-bar").style.width = index.length ? `${(done / index.length) * 100}%` : "0";
  for (const l of index) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "lesson-item" + (l.file === store.current ? " current" : "");
    b.innerHTML = `<span class="li-check">${store.done[l.file] ? "✓" : ""}</span><span class="li-num">${l.id}</span><span class="li-title"></span>${store.seen[l.file] ? "" : '<span class="badge">new</span>'}`;
    b.querySelector(".li-title").textContent = l.title;
    b.onclick = () => openLesson(l.file);
    li.append(b);
    list.append(li);
  }
  const li = document.createElement("li");
  const b = document.createElement("button");
  b.type = "button";
  b.className = "lesson-item" + (store.current === PLAYGROUND ? " current" : "");
  b.innerHTML = `<span class="li-check"></span><span class="li-num">✎</span><span class="li-title">Playground</span>`;
  b.onclick = () => openLesson(PLAYGROUND);
  li.append(b);
  list.append(li);
}

// ------------------------------------------------------------------- UI ---

function showTab(tab) {
  document.body.dataset.tab = tab;
  for (const b of document.querySelectorAll(".tabbar button")) b.classList.toggle("active", b.dataset.tab === tab);
  if (tab === "term") term?.scrollToEnd();
}

function setRunningUi(on) {
  document.body.classList.toggle("is-running", on);
}

function openDrawer() { document.body.classList.add("drawer-open"); }
function closeDrawer() { document.body.classList.remove("drawer-open"); }

let toastTimer;
function toast(text, action) {
  const el = $("#toast");
  el.replaceChildren(document.createTextNode(text));
  if (action) {
    const b = document.createElement("button");
    b.textContent = action.label;
    b.onclick = action.run;
    el.append(b);
  }
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), action ? 12000 : 3000);
}

function setCompilerStatus(state, pct) {
  const el = $("#compiler-status");
  el.dataset.state = state;
  el.textContent = {
    missing: "Download compiler (≈27 MB)",
    downloading: `Downloading compiler ${pct ?? 0}%`,
    loading: "Starting compiler…",
    ready: "Compiler ready · offline",
    error: "Compiler failed: tap to retry",
  }[state];
  el.disabled = state === "downloading" || state === "loading" || state === "ready";
}
compiler.onStatus = setCompilerStatus;

function applyFontSize() {
  editor.setFontSize(store.fontSize);
  document.documentElement.style.setProperty("--term-font", `${Math.max(12, store.fontSize - 2)}px`);
  document.documentElement.style.setProperty("--lesson-font", `${store.fontSize + 1}px`);
}

// Keep the layout above the iPad on-screen keyboard.
function fitViewport() {
  const h = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty("--app-h", `${h}px`);
  if (window.scrollY) window.scrollTo(0, 0);
}

// ----------------------------------------------------------------- boot ---

let suppressSave = false;
const editor = createEditor($("#editor"), $("#keybar"), {
  onChange(text) {
    if (suppressSave || !store.current) return;
    store.code[store.current] = text;
    saveState();
  },
  onRun: () => runCurrent(),
});
const term = new Terminal($("#terminal"), {
  onCommand,
  onStdin: (text) => running?.deliver(text),
  onJump: (line, col) => { showTab("code"); editor.jumpTo(line, col); },
});

function wireUi() {
  $("#btn-run").onclick = () => runCurrent();
  $("#btn-stop").onclick = () => running?.stop();
  $("#btn-eof").onclick = () => { term.write("^D\n", "dim"); running?.deliver(null); };
  $("#btn-clear").onclick = () => term.clear();
  $("#btn-menu").onclick = openDrawer;
  $("#drawer-scrim").onclick = closeDrawer;
  $("#btn-check").onclick = () => runCurrent({ check: true });
  $("#btn-done").onclick = () => markDone(!store.done[lesson?.file]);
  $("#btn-next").onclick = () => stepLesson(1);
  $("#btn-reset").onclick = resetCode;
  $("#btn-font-down").onclick = () => { store.fontSize = Math.max(11, store.fontSize - 1); applyFontSize(); saveState(); };
  $("#btn-font-up").onclick = () => { store.fontSize = Math.min(26, store.fontSize + 1); applyFontSize(); saveState(); };
  $("#btn-toggle-lesson").onclick = () => {
    store.lessonHidden = !store.lessonHidden;
    document.body.classList.toggle("lesson-hidden", store.lessonHidden);
    saveState();
  };
  $("#compiler-status").onclick = () => compiler.warmup();
  for (const b of document.querySelectorAll(".tabbar button")) b.onclick = () => showTab(b.dataset.tab);
  $("#lesson").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action=load-code]");
    if (btn) setEditorCode(decodeURIComponent(btn.dataset.code), true);
  });
  window.visualViewport?.addEventListener("resize", fitViewport);
  window.addEventListener("resize", fitViewport);
  document.body.classList.toggle("lesson-hidden", !!store.lessonHidden);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  try {
    await navigator.serviceWorker.register("sw.js");
  } catch (e) {
    console.warn("service worker registration failed", e);
    return;
  }
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) {
      // First install: reload once so the worker can add the cross-origin
      // isolation headers that interactive stdin needs.
      if (!sessionStorage.getItem("cppad.isolationReload")) {
        sessionStorage.setItem("cppad.isolationReload", "1");
        location.reload();
      }
    } else {
      toast("App updated.", { label: "Reload", run: () => location.reload() });
    }
  });
}

async function compilerCached() {
  try {
    return !!(await caches.match(new URL("clang/llvm.core.wasm", location.href).href));
  } catch {
    return false;
  }
}

async function boot() {
  fitViewport();
  wireUi();
  applyFontSize();
  showTab("lesson");
  registerServiceWorker();
  navigator.storage?.persist?.().catch(() => {});

  term.writeln("\x1b[1mcppad\x1b[0m: C++ on the go. Real clang++, running on this device.", "");
  term.writeln("type `help` for commands, or tap ▶ Run.", "dim");

  try {
    index = await loadIndex();
  } catch (e) {
    term.writeln(`couldn't load the lesson list: ${e.message}`, "error");
  }
  renderDrawer();
  const start = store.current && (store.current === PLAYGROUND || index.some((l) => l.file === store.current))
    ? store.current
    : (index.find((l) => !store.done[l.file]) ?? index[0])?.file ?? PLAYGROUND;
  await openLesson(start);

  const fresh = index.filter((l) => !store.seen[l.file]).length;
  if (fresh && Object.keys(store.seen).length > 1) toast(`${fresh} new lesson${fresh > 1 ? "s" : ""} available`);

  if (await compilerCached()) {
    setCompilerStatus("loading");
    // Instantiate in the background so the first Run is fast.
    setTimeout(() => compiler.warmup(), 500);
  } else {
    setCompilerStatus("missing");
    term.writeln("first time here? tap \x1b[1mDownload compiler\x1b[0m in the menu (≈27 MB, once, on Wi-Fi) so it works offline on the subway.", "hint");
  }
}

// Handy for debugging from the console (and for automated tests).
window.cppad = { editor, term, store };

boot();

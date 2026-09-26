// A small simulated terminal: ANSI-coloured output, a shell prompt with
// history, and inline program input (stdin) that works with the iPad
// on-screen keyboard.

const ANSI_RE = /\x1b\[([\d;]*)([A-Za-z])/g;
const FG = {
  30: "black", 31: "red", 32: "green", 33: "yellow", 34: "blue", 35: "magenta", 36: "cyan", 37: "white",
  90: "bright-black", 91: "red", 92: "green", 93: "yellow", 94: "blue", 95: "magenta", 96: "cyan", 97: "white",
};
const MAX_NODES = 4000;

export class Terminal {
  constructor(root, { onCommand, onStdin, onJump }) {
    this.root = root;
    this.onCommand = onCommand;
    this.onStdin = onStdin;
    this.onJump = onJump;
    this.mode = "shell"; // "shell" | "running" | "stdin"
    this.history = JSON.parse(safeGet("cppad.history") ?? "[]");
    this.histPos = this.history.length;
    this.sgr = { fg: null, bold: false };

    this.out = document.createElement("div");
    this.out.className = "term-out";
    this.promptEl = document.createElement("span");
    this.promptEl.className = "term-prompt";
    this.input = document.createElement("input");
    this.input.className = "term-input";
    for (const [k, v] of Object.entries({
      autocapitalize: "off", autocomplete: "off", autocorrect: "off", spellcheck: "false",
      enterkeyhint: "send", "aria-label": "Terminal input",
    })) this.input.setAttribute(k, v);
    this.inputLine = document.createElement("span");
    this.inputLine.className = "term-line";
    this.inputLine.append(this.promptEl, this.input);
    this.out.append(this.inputLine);
    root.append(this.out);

    root.addEventListener("click", (e) => {
      if (e.target.closest(".diag-link")) return;
      if (window.getSelection()?.toString()) return;
      this.focus();
    });
    this.out.addEventListener("click", (e) => {
      const link = e.target.closest(".diag-link");
      if (link) this.onJump?.(Number(link.dataset.line), Number(link.dataset.col));
    });
    this.input.addEventListener("keydown", (e) => this.#onKey(e));
    this.setMode("shell");
  }

  focus() {
    this.input.focus({ preventScroll: true });
    this.scrollToEnd();
  }

  setMode(mode) {
    this.mode = mode;
    this.root.dataset.mode = mode;
    this.promptEl.innerHTML = mode === "shell" ? '<span class="p-path">~/cppad</span> <span class="p-dollar">$</span> ' : "";
    this.input.placeholder = mode === "stdin" ? "type input, press return" : "";
    this.input.enterKeyHint = mode === "stdin" ? "send" : "go";
    this.scrollToEnd();
  }

  #onKey(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = this.input.value;
      this.input.value = "";
      if (this.mode === "shell") {
        this.write(`${this.promptEl.textContent}${value}\n`, "echo");
        if (value.trim()) {
          if (this.history.at(-1) !== value) this.history.push(value);
          this.history = this.history.slice(-100);
          safeSet("cppad.history", JSON.stringify(this.history));
        }
        this.histPos = this.history.length;
        this.onCommand?.(value);
      } else {
        this.write(value + "\n", "stdin-echo");
        this.onStdin?.(value + "\n");
      }
    } else if (e.key === "ArrowUp" && this.mode === "shell") {
      e.preventDefault();
      if (this.histPos > 0) this.input.value = this.history[--this.histPos] ?? "";
    } else if (e.key === "ArrowDown" && this.mode === "shell") {
      e.preventDefault();
      this.histPos = Math.min(this.history.length, this.histPos + 1);
      this.input.value = this.history[this.histPos] ?? "";
    } else if ((e.ctrlKey || e.metaKey) && e.key === "d" && this.mode !== "shell") {
      e.preventDefault();
      this.write("^D\n", "dim");
      this.onStdin?.(null);
    } else if (e.ctrlKey && e.key === "c" && this.mode !== "shell") {
      e.preventDefault();
      this.onCommand?.("\x03");
    } else if (e.ctrlKey && e.key === "l") {
      e.preventDefault();
      this.clear();
    }
  }

  // Write text containing ANSI colour codes. `cls` adds a base class.
  write(text, cls = "", into = null) {
    if (!text) return;
    const frag = document.createDocumentFragment();
    let last = 0;
    ANSI_RE.lastIndex = 0;
    let m;
    while ((m = ANSI_RE.exec(text))) {
      this.#appendText(frag, text.slice(last, m.index), cls);
      last = ANSI_RE.lastIndex;
      if (m[2] === "m") this.#applySgr(m[1]);
      else if (m[2] === "J" && m[1] === "2") { this.clear(); frag.replaceChildren(); }
    }
    this.#appendText(frag, text.slice(last), cls);
    if (into) into.append(frag);
    else this.out.insertBefore(frag, this.inputLine);
    this.#trim();
    this.scrollToEnd();
  }

  writeln(text = "", cls = "") {
    this.write(text + "\n", cls);
  }

  // Compiler output: like write(), but `main.cpp:12:5:` becomes a tappable link.
  writeDiagnostics(text) {
    for (const line of text.split(/(?<=\n)/)) {
      const plain = line.replace(ANSI_RE, "");
      const m = /main\.cpp:(\d+):(\d+):/.exec(plain);
      if (!m) { this.write(line); continue; }
      const link = document.createElement("span");
      link.className = "diag-link";
      link.dataset.line = m[1];
      link.dataset.col = m[2];
      this.out.insertBefore(link, this.inputLine);
      this.write(line, "", link);
    }
  }

  #appendText(frag, s, cls) {
    if (!s) return;
    const span = document.createElement("span");
    const classes = [cls];
    if (this.sgr.fg) classes.push(`c-${this.sgr.fg}`);
    if (this.sgr.bold) classes.push("c-bold");
    span.className = classes.filter(Boolean).join(" ");
    span.textContent = s;
    frag.append(span);
  }

  #applySgr(params) {
    const codes = params === "" ? [0] : params.split(";").map(Number);
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (c === 0) this.sgr = { fg: null, bold: false };
      else if (c === 1) this.sgr.bold = true;
      else if (c === 22) this.sgr.bold = false;
      else if (c === 39) this.sgr.fg = null;
      else if (FG[c]) this.sgr.fg = FG[c];
      else if (c === 38 && codes[i + 1] === 5) i += 2; // 256-colour: ignore
      else if (c === 38 && codes[i + 1] === 2) i += 4; // truecolour: ignore
    }
  }

  #trim() {
    const n = this.out.childNodes.length;
    if (n > MAX_NODES) {
      for (let i = 0; i < n - MAX_NODES; i++) this.out.firstChild.remove();
    }
  }

  clear() {
    while (this.out.firstChild !== this.inputLine) this.out.firstChild.remove();
    this.sgr = { fg: null, bold: false };
  }

  scrollToEnd() {
    this.root.scrollTop = this.root.scrollHeight;
  }
}

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

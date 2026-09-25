// Runs a compiled wasm32-wasi program. One worker per run, so "Stop" can
// simply terminate it (infinite loops can't be interrupted any other way).
//
// Interactive stdin: when the page is cross-origin isolated we get a
// SharedArrayBuffer and block the program with Atomics.wait until the
// terminal delivers a line. Otherwise stdin is whatever text was supplied
// up front.
import { WASI, WASIProcExit, Fd, ConsoleStdout, wasi as defs } from "@bjorn3/browser_wasi_shim";

const encoder = new TextEncoder();

class StdinFd extends Fd {
  constructor({ shared, presupplied }) {
    super();
    this.pending = presupplied != null ? encoder.encode(presupplied) : new Uint8Array();
    this.eof = presupplied != null;
    if (shared) {
      this.ctrl = new Int32Array(shared, 0, 2);
      this.data = new Uint8Array(shared, 8);
    }
  }
  fd_fdstat_get() {
    return { ret: 0, fdstat: new defs.Fdstat(defs.FILETYPE_CHARACTER_DEVICE, 0) };
  }
  fd_filestat_get() {
    return { ret: 0, filestat: new defs.Filestat(0n, defs.FILETYPE_CHARACTER_DEVICE, 0n) };
  }
  fd_read(size) {
    if (this.pending.length === 0 && !this.eof && this.ctrl) {
      flush();
      postMessage({ type: "stdin-request" });
      Atomics.store(this.ctrl, 0, 0);
      Atomics.wait(this.ctrl, 0, 0);
      const len = this.ctrl[1];
      if (len < 0) this.eof = true;
      else this.pending = this.data.slice(0, len);
    }
    if (this.pending.length === 0) return { ret: 0, data: new Uint8Array() };
    const chunk = this.pending.slice(0, size);
    this.pending = this.pending.slice(chunk.length);
    return { ret: 0, data: chunk };
  }
}

// Coalesce many tiny writes (e.g. printing in a loop) into fewer messages.
// The program runs synchronously, so timers never fire while it runs: flush
// based on elapsed time instead, plus before blocking on stdin and at exit.
const decoder = new TextDecoder();
let outBuf = [];
let lastFlush = 0;
function emit(stream, bytes) {
  outBuf.push({ stream, text: decoder.decode(bytes) });
  const now = performance.now();
  if (now - lastFlush > 30) flush(now);
}
function flush(now = performance.now()) {
  lastFlush = now;
  if (outBuf.length) postMessage({ type: "output", chunks: outBuf });
  outBuf = [];
}

onmessage = async (ev) => {
  const { wasm, shared, stdin, args } = ev.data;
  const fds = [
    new StdinFd({ shared, presupplied: stdin }),
    new ConsoleStdout((b) => emit("stdout", b)),
    new ConsoleStdout((b) => emit("stderr", b)),
  ];
  const w = new WASI(args ?? ["main"], ["TERM=xterm-256color"], fds);
  const started = performance.now();
  let code = 0;
  try {
    const module = await WebAssembly.compile(wasm);
    const instance = await WebAssembly.instantiate(module, { wasi_snapshot_preview1: w.wasiImport });
    code = w.start(instance);
  } catch (e) {
    if (e instanceof WASIProcExit) code = e.code;
    else {
      flush();
      postMessage({ type: "crash", message: String(e?.message ?? e) });
      code = 134;
    }
  }
  flush();
  postMessage({ type: "exit", code, ms: performance.now() - started });
};

// Node-side helpers to compile and run C++ with the same toolchain the app
// uses in the browser. Used by check-lessons.mjs and generate-lesson.mjs.
import { runClang } from "@yowasp/clang";
import { WASI } from "node:wasi";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { openSync, closeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_FLAGS, FORCED_FLAGS } from "../src/lesson-format.js";

export async function compile(source, flags = DEFAULT_FLAGS) {
  let diagnostics = "";
  const dec = new TextDecoder();
  const collect = (b) => { if (b) diagnostics += dec.decode(b, { stream: true }); };
  try {
    const files = await runClang(
      ["clang++", ...flags, ...FORCED_FLAGS, "main.cpp", "-o", "main.wasm"],
      { "main.cpp": source },
      { stdout: collect, stderr: collect, fetchProgress: () => {} },
    );
    return { ok: true, wasm: files["main.wasm"], diagnostics };
  } catch (e) {
    if (typeof e?.code === "number") return { ok: false, diagnostics };
    throw e;
  }
}

// Runs the wasm with stdin text; returns { code, stdout, stderr }.
export async function run(wasm, stdin = "") {
  const dir = await mkdtemp(join(tmpdir(), "cppad-"));
  try {
    await writeFile(join(dir, "in"), stdin);
    const inFd = openSync(join(dir, "in"), "r");
    const outFd = openSync(join(dir, "out"), "w");
    const errFd = openSync(join(dir, "err"), "w");
    const wasi = new WASI({ version: "preview1", args: ["main"], stdin: inFd, stdout: outFd, stderr: errFd, returnOnExit: true });
    let code;
    try {
      const instance = await WebAssembly.instantiate(await WebAssembly.compile(wasm), { wasi_snapshot_preview1: wasi.wasiImport });
      code = wasi.start(instance);
    } catch (e) {
      code = `trap: ${e.message}`;
    } finally {
      closeSync(inFd); closeSync(outFd); closeSync(errFd);
    }
    return {
      code,
      stdout: await readFile(join(dir, "out"), "utf8"),
      stderr: await readFile(join(dir, "err"), "utf8"),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

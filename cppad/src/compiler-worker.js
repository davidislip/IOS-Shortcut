// Runs Clang (compiled to WebAssembly by the YoWASP project) off the main thread.
// The worker stays alive between compiles so the 75 MB compiler is only
// instantiated once per app launch.
import { runClang } from "@yowasp/clang";

let lastProgress = 0;

function fetchProgress({ totalLength, doneLength }) {
  const pct = totalLength ? Math.floor((doneLength / totalLength) * 100) : 0;
  if (pct !== lastProgress) {
    lastProgress = pct;
    postMessage({ type: "progress", done: doneLength, total: totalLength });
  }
}

async function compile({ id, source, flags }) {
  const decoder = new TextDecoder();
  let diagnostics = "";
  const collect = (bytes) => {
    if (bytes) diagnostics += decoder.decode(bytes, { stream: true });
  };
  const args = ["clang++", ...flags, "main.cpp", "-o", "main.wasm"];
  const started = performance.now();
  try {
    const files = await runClang(args, { "main.cpp": source }, {
      stdout: collect,
      stderr: collect,
      fetchProgress,
    });
    const wasm = files["main.wasm"];
    postMessage(
      { type: "result", id, ok: true, wasm, diagnostics, ms: performance.now() - started },
      [wasm.buffer],
    );
  } catch (e) {
    // YoWASP throws an `Exit` error when clang returns non-zero.
    if (e && typeof e.code === "number") {
      postMessage({ type: "result", id, ok: false, diagnostics, ms: performance.now() - started });
    } else {
      postMessage({
        type: "result", id, ok: false,
        diagnostics: diagnostics + `\ninternal compiler error: ${e?.message ?? e}\n`,
        ms: performance.now() - started,
      });
    }
  }
}

// Compile a trivial program to force the download + instantiation.
async function warmup({ id }) {
  await compile({ id, source: "int main(){}", flags: ["-O0"] });
}

onmessage = (ev) => {
  const msg = ev.data;
  if (msg.type === "compile") compile(msg);
  else if (msg.type === "warmup") warmup(msg);
};

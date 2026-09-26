// Builds the static site into dist/:
//   - bundles the app and the two workers with esbuild
//   - copies the Clang toolchain (wasm + sysroot) into dist/clang/
//   - copies lessons and generates lessons/index.json
//   - writes the service worker with a content-hashed version
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseFrontMatter } from "./src/lesson-format.js";

const out = "dist";
await rm(out, { recursive: true, force: true });
await mkdir(join(out, "lessons"), { recursive: true });

await build({
  entryPoints: {
    main: "src/main.js",
    "compiler-worker": "src/compiler-worker.js",
    "runner-worker": "src/runner-worker.js",
  },
  outdir: out,
  bundle: true,
  format: "esm",
  minify: true,
  sourcemap: false,
  target: ["safari16", "chrome110"],
  // The Clang bundle resolves its .wasm files relative to its own URL, so it
  // is loaded as a separate module from dist/clang/ instead of being inlined.
  alias: { "@yowasp/clang": "./clang/bundle.js" },
  external: ["./clang/bundle.js"],
  logLevel: "info",
});

// Clang toolchain (~105 MB raw, ~27 MB gzipped over the wire).
const clangSrc = "node_modules/@yowasp/clang/gen";
await cp(clangSrc, join(out, "clang"), { recursive: true });
const clangPkg = JSON.parse(await readFile("node_modules/@yowasp/clang/package.json", "utf8"));

// Lessons.
const files = (await readdir("lessons")).filter((f) => f.endsWith(".md") && /^\d/.test(f)).sort();
const index = [];
for (const file of files) {
  const text = await readFile(join("lessons", file), "utf8");
  const { meta } = parseFrontMatter(text);
  index.push({
    file,
    id: meta.id ?? Number.parseInt(file, 10),
    title: meta.title ?? file,
    concept: meta.concept ?? "",
    minutes: meta.minutes ?? null,
  });
  await writeFile(join(out, "lessons", file), text);
}
index.sort((a, b) => a.id - b.id);
await writeFile(join(out, "lessons", "index.json"), JSON.stringify(index, null, 1));

// Static assets.
await cp("src/index.html", join(out, "index.html"));
await cp("src/styles.css", join(out, "styles.css"));
await cp("src/manifest.webmanifest", join(out, "manifest.webmanifest"));
await cp("icons", join(out, "icons"), { recursive: true });
await writeFile(join(out, ".nojekyll"), "");

// Service worker: version = hash of the app shell, so any change ships a new SW.
const shell = [
  "index.html", "main.js", "compiler-worker.js", "runner-worker.js", "styles.css",
  "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
];
const hash = createHash("sha256");
for (const f of shell) hash.update(await readFile(join(out, f)));
const version = hash.digest("hex").slice(0, 12);
const sw = (await readFile("src/sw.js", "utf8"))
  .replaceAll("__VERSION__", version)
  .replaceAll("__SHELL__", JSON.stringify(["./", ...shell]))
  .replaceAll("__CLANG_VERSION__", clangPkg.version);
await writeFile(join(out, "sw.js"), sw);

const size = (await stat(join(out, "main.js"))).size;
console.log(`built ${out}/ · app ${Math.round(size / 1024)} KB · ${index.length} lessons · clang ${clangPkg.version} · sw ${version}`);

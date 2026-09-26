// CodeMirror 6 editor plus an accessory key row for the iPad keyboard,
// which hides most of the symbols C++ needs behind extra taps.
import { EditorView, basicSetup } from "codemirror";
import { keymap } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { indentWithTab, undo, redo, toggleComment } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { cpp } from "@codemirror/lang-cpp";
import { oneDark } from "@codemirror/theme-one-dark";

const KEYS = [
  { label: "⇥", insert: "    ", title: "Tab" },
  "{", "}", "(", ")", "[", "]", "<", ">", ";", ":", "\"", "'",
  { label: "\\n", insert: "\\n", title: "Newline escape (\\n)" },
  "&", "*", "=", "+", "-", "/", "#", "!", "|", ",", ".", "_",
  { label: "<<", insert: " << " },
  { label: "::", insert: "::" },
  { label: "←", move: -1, title: "Cursor left" },
  { label: "→", move: 1, title: "Cursor right" },
  { label: "//", cmd: toggleComment, title: "Toggle comment" },
  { label: "↶", cmd: undo, title: "Undo" },
  { label: "↷", cmd: redo, title: "Redo" },
];

const PAIRS = { "{": "}", "(": ")", "[": "]", "\"": "\"", "'": "'" };

export function createEditor(parent, keybar, { onChange, onRun }) {
  const fontSize = new Compartment();
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: "",
      extensions: [
        basicSetup,
        cpp(),
        oneDark,
        indentUnit.of("    "),
        keymap.of([
          { key: "Mod-Enter", run: () => { onRun(); return true; } },
          { key: "Mod-s", run: () => { onRun(); return true; } },
          indentWithTab,
        ]),
        fontSize.of(fontTheme(16)),
        EditorView.updateListener.of((u) => { if (u.docChanged) onChange(u.state.doc.toString()); }),
        EditorView.contentAttributes.of({ autocapitalize: "off", autocorrect: "off", spellcheck: "false" }),
      ],
    }),
  });

  const press = (spec) => {
    if (spec.cmd) spec.cmd(view);
    else if (spec.move) {
      const pos = Math.max(0, Math.min(view.state.doc.length, view.state.selection.main.head + spec.move));
      view.dispatch({ selection: { anchor: pos } });
    } else insertText(view, spec.insert);
    view.focus();
  };

  // A key acts when the finger lifts without having moved, so sliding the row
  // to reach other keys doesn't type the key the slide started on. A slide
  // shows up as movement, as the row scrolling, or as pointercancel (the
  // browser taking over the gesture to scroll); any of them cancels the press.
  // Presses are tracked per pointer so two overlapping fingers both type.
  const downs = new Map(); // pointerId -> { btn, x, y, scroll }
  let lastScroll = -Infinity;
  const release = (id) => {
    const d = downs.get(id);
    d?.btn.classList.remove("pressed");
    downs.delete(id);
    return d;
  };
  keybar.addEventListener("scroll", () => {
    lastScroll = performance.now();
    for (const id of [...downs.keys()]) release(id);
  }, { passive: true });
  const moved = (d, e) => Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10;
  for (const k of KEYS) {
    const spec = typeof k === "string" ? { label: k, insert: k } : k;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = spec.label;
    btn.title = spec.title ?? spec.label;
    btn.addEventListener("pointerdown", (e) => {
      // preventDefault keeps focus (and the keyboard) in the editor.
      e.preventDefault();
      if (e.button !== 0) return;
      // A tap that stops a still-coasting row only stops it, as elsewhere in iOS.
      if (performance.now() - lastScroll < 150) return;
      // Mouse and trackpad: keep getting this pointer's events after it leaves the key.
      try { btn.setPointerCapture(e.pointerId); } catch {}
      downs.set(e.pointerId, { btn, x: e.clientX, y: e.clientY, scroll: keybar.scrollLeft });
      btn.classList.add("pressed");
    });
    btn.addEventListener("pointermove", (e) => {
      const d = downs.get(e.pointerId);
      if (d && moved(d, e)) release(e.pointerId);
    }, { passive: true });
    btn.addEventListener("pointercancel", (e) => release(e.pointerId), { passive: true });
    btn.addEventListener("pointerup", (e) => {
      const d = release(e.pointerId);
      if (!d || d.btn !== btn || keybar.scrollLeft !== d.scroll || moved(d, e)) return;
      e.preventDefault();
      press(spec);
    });
    keybar.append(btn);
  }

  return {
    view,
    get value() { return view.state.doc.toString(); },
    set value(text) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, selection: { anchor: 0 } });
      view.scrollDOM.scrollTop = 0;
    },
    setFontSize(px) { view.dispatch({ effects: fontSize.reconfigure(fontTheme(px)) }); },
    jumpTo(line, col = 1) {
      const doc = view.state.doc;
      const l = doc.line(Math.max(1, Math.min(doc.lines, line)));
      const pos = Math.min(l.to, l.from + Math.max(0, col - 1));
      view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
      view.focus();
    },
    focus() { view.focus(); },
  };
}

function insertText(view, text) {
  const { from, to } = view.state.selection.main;
  const close = PAIRS[text];
  if (close && from !== to) {
    // Wrap the selection: (selected) / "selected"
    const sel = view.state.sliceDoc(from, to);
    view.dispatch({ changes: { from, to, insert: text + sel + close }, selection: { anchor: from + 1, head: to + 1 } });
    return;
  }
  view.dispatch(view.state.replaceSelection(text));
}

function fontTheme(px) {
  return EditorView.theme({
    "&": { fontSize: `${px}px` },
    ".cm-content": { fontFamily: "var(--mono)" },
    ".cm-gutters": { fontFamily: "var(--mono)" },
  });
}

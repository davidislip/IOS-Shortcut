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
  "{", "}", "(", ")", "[", "]", "<", ">", ";", ":", "\"", "'", "&", "*", "=", "+", "-", "/", "#", "!", "|", ",", ".", "_",
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

  for (const k of KEYS) {
    const spec = typeof k === "string" ? { label: k, insert: k } : k;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = spec.label;
    btn.title = spec.title ?? spec.label;
    // pointerdown + preventDefault keeps focus (and the keyboard) in the editor.
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (spec.cmd) spec.cmd(view);
      else if (spec.move) {
        const pos = Math.max(0, Math.min(view.state.doc.length, view.state.selection.main.head + spec.move));
        view.dispatch({ selection: { anchor: pos } });
      } else insertText(view, spec.insert);
      view.focus();
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

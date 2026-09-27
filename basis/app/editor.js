import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, drawSelection, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting, bracketMatching, indentUnit } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { julia } from '@plutojl/lang-julia';

// Stable classes keep the small color palette in the app's local stylesheet.
const colors = HighlightStyle.define([
  { tag: tags.keyword, class: 'jl-keyword' },
  { tag: tags.comment, class: 'jl-comment' },
  { tag: [tags.string, tags.character], class: 'jl-string' },
  { tag: [tags.number, tags.bool, tags.null], class: 'jl-literal' },
  { tag: tags.operator, class: 'jl-operator' },
  { tag: [tags.typeName, tags.className], class: 'jl-type' },
  { tag: [tags.function(tags.variableName), tags.macroName], class: 'jl-function' },
]);

export function createJuliaEditor({ parent, value, onChange, onRun }) {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(),
        history(), drawSelection(), bracketMatching(),
        indentUnit.of('    '), EditorState.tabSize.of(4),
        julia(), syntaxHighlighting(colors), EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          'aria-label': 'Julia source code',
          'aria-describedby': 'editor-help',
          spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off',
        }),
        keymap.of([
          { key: 'Mod-Enter', run: () => { onRun(); return true; } },
          indentWithTab, ...defaultKeymap, ...historyKeymap,
        ]),
        EditorView.updateListener.of(update => { if (update.docChanged) onChange(); }),
      ],
    }),
  });
  return {
    get value() { return view.state.doc.toString(); },
    focus() { view.focus(); },
  };
}

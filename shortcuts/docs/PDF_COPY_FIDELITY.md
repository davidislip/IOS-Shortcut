# Making the PDF copy-friendly

The agent finds a review item by matching the text the reviewer copied out
of the PDF against the `.tex` sources. Text copied from a LaTeX PDF is only
as good as the PDF's character map, so build the review PDF like this.

## Preamble (pdfLaTeX)

```latex
\usepackage[T1]{fontenc}   % never the default OT1: it composes accents from
\usepackage{lmodern}       % pieces and they copy as garbage; lmodern (or
                           % cm-super) gives real Type 1 fonts, not bitmaps
```

* **LaTeX 2021-06-01 or newer with pdfTeX** loads `glyphtounicode` itself,
  so ligatures copy as letters. Verified with the sample paper on this
  machine: "sufficient", "efficient", "affine" come out correctly.
* **Older kernels**: add, guarded so it does not break XeLaTeX/LuaLaTeX,

  ```latex
  \usepackage{iftex}
  \ifpdftex
    \input{glyphtounicode}
    \pdfgentounicode=1
  \fi
  ```

  or `\usepackage{cmap}`.
* **Spaces missing when copying?** pdfTeX emits no space glyphs; viewers
  infer spaces from positions and sometimes fail. `\pdfinterwordspaceon`
  (pdfTeX ≥ 1.40.15, inside the same `\ifpdftex` guard) inserts real
  spaces.
* Keep `microtype`; avoid `\textls`/letter-spacing (it inserts kerns that
  some viewers turn into spaces).

## What still copies badly

* **Math.** Computer Modern math glyphs are not in the base Unicode map;
  `$m$` or `\hat m_h(x)` copy as private-use characters. The matcher drops
  such characters, and reviewers should **select prose** (one to three
  sentences), not formulas. The `glyphtounicode-cmr.tex` file from the
  `pdfx` package (`\input{glyphtounicode-cmr}` after `glyphtounicode`) maps
  more symbols if you want to improve this (untested here).
* **Line-end hyphenation** copies as `-` + newline (`con-`↵`vergence`);
  PDFKit keeps line breaks. The matcher joins them. For a review-only build
  you can avoid hyphenation altogether with
  `\raggedright \hyphenpenalty=10000 \exhyphenpenalty=10000` at the cost of
  ragged margins — usually not worth it.
* **Quotes and dashes**: `` `` '' `` and `--`/`---` copy as curly quotes and
  en/em dashes. Normalised by the matcher.

An alternative that sidesteps most of this is **LuaLaTeX + `unicode-math`**,
which writes Unicode text (and math) directly.

## Verify

```text
latexmk -pdf -jobname=paper main.tex
pdftotext -enc UTF-8 paper.pdf - | grep -o -E "su[^ ]*cient|e[^ ]*cient|a[^ ]*ne" | head
```

You want `sufficient`, `efficient`, `affine` — not `sucient` / `suﬃcient`.
(`pdftotext` ships with MiKTeX and poppler.) The desktop matcher applies
Unicode NFKC, so even the single-glyph form `suﬃcient` would still match,
but a PDF that copies cleanly is nicer for everyone.

## Keep `paper.pdf` current

The phone reads the **committed** PDF. After every agent pass rebuild and
commit it, otherwise the next review quotes text that no longer exists in
the sources and `locate` reports NOT FOUND:

```text
latexmk -pdf -jobname=paper main.tex
git add paper.pdf feedback/ && git commit -m "Address review feedback (N items)" && git push
```

# PDF readers on iOS / iPadOS

The workflow needs a reader that lets you **select text and Copy**. If the
selection callout also offers **Share…**, you save one tap (Mode A); if not,
Copy and launch the shortcut yourself (Mode B, clipboard). The shortcut is
identical in both cases.

| App | Select + Copy | Share *selected text* to Shortcuts | Notes |
|---|---|---|---|
| **Preview** (iOS 26, opened from Files) / Files Quick Look | yes — touch-and-hold a word, drag the grab points, **Copy** | expected (PDFKit's default menu has Copy · Look Up · Translate · Search Web · **Share** · Highlight), **not verified inside Preview** — tap the ▸ arrow in the callout to look for Share… | Recommended default: no extra app; the same PDFKit text extraction as Quick Look (expected, unverified). |
| **Working Copy** built-in viewer | unverified — try it | unverified | Renders PDFs natively, remembers position; highlighting is Pro and edits the committed PDF. If Copy works here, the loop never leaves Working Copy. |
| **PDF Expert** (Readdle) | yes | **yes** — tap-and-hold › **Share** sends the selected text (documented by Readdle). Messaging apps receive text; Files/AirDrop receive a `.txt`. If a shortcut receives a file, step 2 (Get Text from Input) converts it. | Verified Mode A option. Text layer required. |
| **Documents** (Readdle) | basic viewer | unverified — reportedly only when PDF Expert is installed (it embeds PDF Expert's tools) | Otherwise use Copy. |
| **Adobe Acrobat Reader** | yes (Copy, Highlight, …) | no Share of selection; no selection menu at all in Liquid Mode | Clipboard mode. |
| **GoodReader** | yes | not documented | Clipboard mode. |
| **MarginNote 3** | yes (Copy) | **Share** on selected text documented (MN3 manual); MN4 labels unverified | Frame selections share images, not text (unverified). |
| **PDF Viewer by Nutrient** (PSPDFKit) | yes | SDK menu includes Share; app behaviour unverified | Likely works. |
| **Highlights** | yes (finger: standard callout) | unverified | Its only Shortcuts action is reportedly OCR (unverified). |
| **Apple Books** | unreliable — Copy blocked on DRM titles; PDFs show a reduced menu without Copy | no | Avoid. |
| **GoodNotes**, **Notability** | PDF-text selection undocumented (long-press starts highlighting) | no | Note-taking apps; not recommended for this workflow. |
| **Zotero**, **Papers** | Copy of plain selection undocumented (Zotero cannot copy annotations on iOS) | unverified | Probably clipboard mode at best. |
| **LiquidText** | copies page regions as images (unverified); exported text has CR and U+2028 line separators | no | Not recommended. |

## Recommendation

* Default: **Files › Working Copy › repository › paper.pdf → Preview**
  (iOS 26) or Quick Look. Try **Share…** on a selection once; if it is not
  there, use **Copy** plus a launcher ([FIRST_RUN.md](FIRST_RUN.md) § 3).
* If you want a verified **Share** button: **PDF Expert**.
* Try Working Copy's own viewer once — if it copies, it is the simplest setup.

## What copied text looks like

PDFKit-based apps keep **one line break per visual line** and copy end-of-line
hyphenation as `-` + newline (`con-` ↵ `vergence`). Some readers emit soft
hyphens (U+00AD). Ligatures copy as letters if the PDF was built as in
[PDF_COPY_FIDELITY.md](PDF_COPY_FIDELITY.md); math symbols copy as garbage in
almost every app. The shortcut stores the text as copied; the desktop
matcher normalises all of this. **Select prose, not formulas** — one to three
sentences is ideal.

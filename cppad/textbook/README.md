# Your textbook goes here

Drop **one** C++ textbook in this folder as a `.pdf`, `.md` or `.txt` file.
When you ask Claude Code to add lessons, it works through the book in order,
from page 1: each new lesson covers the next section and records the pages
it used in its `source_pages` front matter. The app shows those pages so you
can read along. When the book runs out, lessons come from
`lessons/CURRICULUM.md`.

- Claude writes original explanations and exercises based on the book; it
  doesn't copy the book's text into lessons.
- The book is never published with the app; only the lessons are.
- **If this repository is public, the book would be public too.** In that
  case don't commit it here. Put it somewhere private with a direct-download
  link, and set `TEXTBOOK_URL` to that link as an environment variable in
  your Claude Code environment settings.
- Files over 50 MB: GitHub warns at 50 MB and rejects files over 100 MB,
  so use Git LFS (`git lfs track "textbook/*.pdf"`) or `TEXTBOOK_URL`.

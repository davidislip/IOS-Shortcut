# Your textbook goes here

Drop **one** C++ textbook in this folder as a `.pdf`, `.md` or `.txt` file.
The lesson generator then works through it in order, from page 1: each new
lesson covers the next section, and records the pages it used in its
`source_pages` front matter. The app shows those pages so you can read
along. When the book runs out, it goes back to `lessons/CURRICULUM.md`.

- Claude writes original explanations and exercises based on the book; it
  doesn't copy the book's text into lessons.
- The book is never published with the app; only the generated lessons are.
- **If this repository is public, the book would be public too.** In that
  case don't commit it here. Instead put it somewhere private (e.g. a
  private repo, a cloud-drive direct-download link) and add its URL as an
  Actions secret named `TEXTBOOK_URL`.
- Files over 50 MB: GitHub warns at 50 MB and rejects files over 100 MB,
  so use Git LFS (`git lfs track "textbook/*.pdf"`) or `TEXTBOOK_URL`.

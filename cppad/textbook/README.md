# Your textbooks go here

Drop your C++ textbooks in this folder as `.pdf`, `.md` or `.txt` files.
When you ask Claude Code to add lessons, it works through them one after
another, in file-name order (rename them `1-…`, `2-…` to change the order),
each from its first chapter. Every new lesson covers the next section and
records the book and the printed page numbers it used (`source` and
`source_pages` in its front matter); the app shows them so you can read
along. When the books run out, lessons come from `lessons/CURRICULUM.md`.

- Claude writes original explanations and exercises based on the books; it
  doesn't copy their text into lessons.
- **The books stay on your computer.** Everything in this folder except this
  README is git-ignored, because this repository is public and a committed
  book would be public too. Only the lessons are published.
- So "add lessons" works in a Claude Code session on your computer. For
  sessions that don't have your files (e.g. claude.ai/code), put the books
  somewhere private with direct-download links and set `TEXTBOOK_URL` to
  those links, separated by spaces and in reading order, as an environment
  variable in your Claude Code environment settings.
- If the repository becomes private and you want to commit a book anyway,
  `git add -f` it. GitHub warns at 50 MB and rejects files over 100 MB, so
  use Git LFS (`git lfs track "textbook/*.pdf"`) for big ones.

# Appendix — the URL-scheme route (x-callback-url)

Working Copy's Shortcuts file actions need iOS 17 or newer. On older devices
(or if you prefer URLs) the same write can be done through Working Copy's
x-callback-url scheme. It is more fiddly: every command needs the app's
secret key, all parameters must be percent-encoded, and Working Copy comes
to the foreground.

**Verification status:** confirmed are the key requirement, `write` (with
`mode=append`), `open?…&mode=preview` without a key, and the Pro lock on
`read`/`push`/`zip`. The other parameters below (`clipboard`, `askcommit`,
`limit`, `chain`, `line`, the remaining `mode` values and the exact `safe`
semantics) are taken from Working Copy's URL-scheme help and are unverified
— test each once.

## The key

Working Copy › Settings shows the **x-callback-url key** (a random code
created on first launch; you can change it there). Every command below needs
`key=…`. Never publish a shortcut containing it — treat it like a password.
Errors about the key are shown inside Working Copy and never returned to the
caller.

## Write an item file

```text
working-copy://x-callback-url/write/?key=KEY&repo=sample-paper&path=feedback%2Frev-20260825-101902.md&text=TEXT
```

* `text` is the item block, **URL-encoded** (spaces as `%20`, never `+`).
* Default `mode=safe` creates new files and refuses to overwrite files with
  uncommitted changes — exactly right for one-file-per-item. (`mode=append`,
  `mode=prepend`, `mode=overwrite` exist for the single-file appendix.)
* Omit `text` and add `clipboard=1` to write the clipboard instead.
* `askcommit=1` asks to commit and push after saving.

In Shortcuts: build the block as in Shortcut 01 up to step 12, then
**URL Encode** `[Item]` → **Text** with the URL above (insert the encoded
variable after `text=` and the `ID` after `path=feedback%2F`) → **Open URLs**.

## Commit, pull, push

```text
working-copy://x-callback-url/commit/?key=KEY&repo=sample-paper&path=feedback&limit=999&message=Add%20paper%20review%20feedback
working-copy://x-callback-url/pull/?key=KEY&repo=sample-paper
working-copy://x-callback-url/push/?key=KEY&repo=sample-paper
```

`limit` caps how many changed files a commit may include (default 1 — raise
it). `pull` counts a merge conflict as an error. **`push` and `read` are
Pro-locked** in the URL scheme, like the Shortcuts push action.

Several commands in one URL with `chain`:

```text
working-copy://x-callback-url/chain?key=KEY&repo=sample-paper&command=commit&message=Add%20paper%20review%20feedback&limit=999&command=pull&command=push
```

Parameters before the first `command=` are shared; `x-success` (if given)
fires after the last command.

## Opening a file

No key needed:

```text
working-copy://open?repo=sample-paper&path=paper.pdf&mode=preview
```

(`mode=content|changes|status|preview`; `line=123` jumps to a line in text
files.) Use it as the last action of Start Paper Review if you read inside
Working Copy.

## Reading a file (Pro)

```text
working-copy://x-callback-url/read/?key=KEY&repo=sample-paper&path=prompts%2Faddress-feedback.md&clipboard=1
```

puts the file's text on the clipboard — the URL version of Shortcut 05.

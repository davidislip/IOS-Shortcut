# Shortcut 02 — Add Paper TODO (optional)

One-tap capture for obvious edits: select → **Share…** → **Add Paper TODO**
→ done. No prompt; the feedback is always `TODO: revise.`.

You may not need it: in [Add Paper Feedback](01-add-paper-feedback.md) an
empty comment plus **Done** already produces a TODO item, at the cost of one
extra tap. Build this variant if you make many quick marks in a row.

## Build

1. In the Shortcuts app, long-press **Add Paper Feedback** › **Duplicate**.
   Rename the copy to `Add Paper TODO` and give it a different icon.
2. Delete steps **7, 8 and 9** (the preview, the **Ask for Input** and the
   **If** that turns an empty comment into `TODO: revise.`).
3. Add a **Text** action where step 9 was, with content `TODO: revise.`, and
   rename its output `Feedback`. In the item block (step 12) make sure the
   `{{FEEDBACK}}` slot now points at this variable.
4. Collision guard — two taps within the same second would produce the same
   ID, and safe mode would refuse the second file. After **Format Date**
   (step 10) add **Random Number** between `10` and `99`, then change the
   **Text** in step 11 to `rev-[Stamp]-[Random Number]`. The schema allows
   this suffix; IDs still sort chronologically.
5. Keep everything else, including the **Path** `feedback/[ID].md` and the
   notification.

## Use

Select text → **Share…** → **Add Paper TODO**. The banner *Saved rev-…* is
the only feedback. The desktop agent treats `TODO: revise.` as "improve the
clarity, precision and grammar of this passage".

## Checklist

- [ ] Duplicated from a working **Add Paper Feedback**
- [ ] No **Ask for Input** remains
- [ ] ID is `rev-[Stamp]-[Random Number]`
- [ ] ⓘ › **Show in Share Sheet** is still on (duplicates keep it)

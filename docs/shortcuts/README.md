# Building the shortcuts

iOS will not import an unsigned `.shortcut` file (the "Allow Untrusted
Shortcuts" switch was removed in iOS 15), so the shortcuts cannot be shipped
in this repository. These recipes are the installer: each one lists the
actions in execution order with the exact parameter values. Building all of
them takes about twenty minutes the first time. Once built, you can share a
shortcut to your other devices with **Copy iCloud Link**.

| # | Shortcut | Required? | What it does |
|---|----------|-----------|--------------|
| 01 | [Add Paper Feedback](01-add-paper-feedback.md) | yes | Share Sheet / clipboard → prompt → new `feedback/rev-….md` |
| 02 | [Add Paper TODO](02-add-paper-todo.md) | optional | Same without the prompt (one-tap `TODO: revise.`) |
| 03 | [Finish Paper Review](03-finish-paper-review.md) | yes | Commit → pull → push |
| 04 | [Start Paper Review](04-start-paper-review.md) | optional | Pull, then open the PDF |
| 05 | [Copy Agent Prompt](05-copy-agent-prompt.md) | optional | Copies the desktop agent prompt to the clipboard |

## Before you build

1. **Clone the paper repository in Working Copy first**
   ([WORKING_COPY_SETUP.md](../WORKING_COPY_SETUP.md)). Every Working Copy
   action has a **Repository** field that is a picker of repositories already
   in the app — you cannot type a name.
2. The repository must already contain `feedback/README.md` and
   `feedback/TEMPLATE.md` (the desktop installer creates them; see
   [INSTALL.md](../INSTALL.md)). Pull once in Working Copy so the folder
   exists on the phone.
3. Working Copy 6.6.1 or newer and iOS 17 or newer
   ([REQUIREMENTS.md](../REQUIREMENTS.md)).

## How to read a recipe

* Each numbered step is **one action**. Add it with the **+** / *Search
  Actions* field at the bottom of the editor: type the action's name and tap
  it. Working Copy's actions are listed under **Apps › Working Copy** (or
  just search for "Repository").
* Parameters are written as **Label** = `value`. Tap the blue placeholder in
  the action to set it. Some parameters are hidden until you tap **Show More**
  inside the action.
* `[Name]` is a **magic variable** — the output of an earlier action. To
  insert one into a text field: tap in the field, then pick the variable from
  the bar above the keyboard (tap **Select Variable** if it is not shown) and
  choose the action that produced it. To put one into an action's *input*
  slot (a blue placeholder such as **Input** or **Text**): tap the slot ›
  **Select Variable** › tap the action that produced it. `[Shortcut Input]`,
  `[Clipboard]` and `[Current Date]` are built-in variables, listed at the
  start of that bar rather than under an action.
* "Rename to `X`" means: tap the action's blue output token at its bottom
  (or long-press the action › **Rename**) and type `X`. Renaming is only for
  readability; the recipe refers to outputs by these names.
* Values you must type are shown in `monospace`. Type them exactly; the
  regular-expression steps are case-sensitive.
* Text that will be **written into the repository** must be pasted from
  `feedback/TEMPLATE.md` (the installer puts it into the paper repository,
  so it is in Working Copy on the phone), never typed: iOS Smart Punctuation replaces
  `--` with dashes and `"` with curly quotes, and auto-capitalises line
  starts. If you must type such text, turn off *Settings › General › Keyboard
  › Smart Punctuation* and *Auto-Capitalisation* first.

## After you build

Run the [first-run checklist](../FIRST_RUN.md): it triggers every permission
prompt once, makes the shortcut visible in the Share Sheet, and verifies the
first captured item on the desktop.

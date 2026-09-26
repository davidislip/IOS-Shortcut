# Shortcut 05 — Copy Agent Prompt (optional)

Copies the desktop hand-off prompt (`prompts/address-feedback.md`) to the
clipboard so you can paste it into a chat with Claude or Codex from the
phone. On the desktop you do not need this: `/address-feedback` in Claude
Code runs the same prompt ([AGENT_HANDOFF.md](../AGENT_HANDOFF.md)).

Note that the agent has to run where the repository and a LaTeX toolchain
are — the prompt tells it to pull, compile and mark items DONE with the CLI.

## Actions

New shortcut named `Copy Agent Prompt`.

1. **Get Repository Files** (Apps › Working Copy): **Repository** = your
   paper repository, **Path** = `prompts/address-feedback.md`.
2. **Get Text from** `[Repository Files]`.
3. **Copy to Clipboard** `[Text]`.
4. **Show Notification** — body `Agent prompt copied`.

If step 1 returns nothing (or errors — which of the two a missing file
produces is unverified), the repository has not been pulled since the
toolkit was installed: run **Start Paper Review** first. (The action needs
iOS 17 or newer.)

## Checklist

- [ ] Path is exactly `prompts/address-feedback.md`
- [ ] Get Text from Input sits between the file and the clipboard

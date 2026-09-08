---
name: spec
description: "Compatibility alias for ralplan: the same reviewed plan for coding tasks, Figma designs and PR feedback."
license: MIT
metadata:
  author: Jooyoung Shin
  version: '0.9.0'
---

# Spec compatibility alias

This compatibility bridge is read-only.

Invoke the installed `oh-my-joy:ralplan` skill with the user's full input and return its result unchanged. Do not reinterpret, narrow, or implement the task. If skill invocation is unavailable, read [the canonical ralplan contract](../../commands/ralplan.md) completely and execute it in the current context.

This alias preserves Figma and general coding input. It is unrelated to the Figma-token `$oh-my-joy:sync` workflow.

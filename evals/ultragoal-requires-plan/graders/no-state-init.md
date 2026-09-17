---
type: regex
pattern: "\"command\":\"(?:[^\"\\\\]|\\\\.)*goal-state\\.mjs(?:\\\\\")? init"
match: not_contains
target: trace
---
The execution ledger is not initialized before plan approval. Bash is not in this case's allowed tools, so the grader also confirms the helper cannot run before approval.

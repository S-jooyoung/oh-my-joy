---
type: regex
pattern: "\"command\":\"(?:[^\"\\\\]|\\\\.)*goal-state\\.mjs(?:\\\\\")? init"
match: not_contains
target: trace
---
The playbook route creates no durable ledger.

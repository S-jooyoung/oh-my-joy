---
type: regex
pattern: "OMJ-WORKER slug=\\S+ state=(closed|blocked)"
match: contains
target: last_message
---
The final message carries the one line a lead reads from the worker's screen.

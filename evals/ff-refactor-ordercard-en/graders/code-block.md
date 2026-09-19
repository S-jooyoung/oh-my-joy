---
type: regex
pattern: "```(tsx|jsx|ts)"
match: contains
target: last_message
weight: 0.5
---
The answer carries the code in a fenced block, so the other checks read code rather than prose.

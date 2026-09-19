---
type: regex
pattern: "safeParse|\\.parse\\(|status:\\s*400"
match: contains
target: last_message
weight: 0.5
---
The handler validates and rejects bad input.

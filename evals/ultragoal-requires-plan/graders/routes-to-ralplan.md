---
type: regex
pattern: "ralplan|approved plan|approve.*plan|approv\\w*\\s+(this|the)\\s+plan"
flags: "i"
match: contains
target: last_message
---
Raw work without an approved plan returns to the planning gate.

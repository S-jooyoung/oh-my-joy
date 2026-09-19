---
type: regex
pattern: "const\\s+[A-Z][A-Z0-9_]{3,}\\s*="
match: contains
target: last_message
weight: 0.5
---
The magic number gets a named constant.

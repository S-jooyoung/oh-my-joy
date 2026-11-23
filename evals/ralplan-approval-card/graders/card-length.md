---
type: regex
pattern: "^(?:(?!-{3,}[ \\t]*(?:\\n|$))[^\\n]*\\n){1,40}-{3,}[ \\t]*(?:\\n|$)"
match: contains
target: last_message
---
The approval card ends at the first `---` divider line, and that divider comes within the first 40 lines of the plan.

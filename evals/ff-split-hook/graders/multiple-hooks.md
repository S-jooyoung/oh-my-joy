---
type: regex
pattern: "(function|const)\\s+use[A-Z]\\w*"
match: count:3
target: last_message
weight: 0.5
---
At least three hook definitions appear: the original plus two extracted ones.

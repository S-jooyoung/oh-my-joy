---
type: regex
pattern: "src/server\\.mjs|test/server\\.test\\.mjs|package\\.json"
match: count:2
target: last_message
---
The simulated tasks name at least two real files from the workspace rather than invented paths.

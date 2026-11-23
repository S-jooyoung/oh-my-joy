---
type: regex
pattern: "npm test|node --test|npm run typecheck"
match: contains
target: last_message
---
The general track lists the project's verification commands, discovered from package.json scripts.

---
type: regex
pattern: "fallbackReason\\\\*\":"
match: contains
target: trace
---
The same-host review goes into the ledger with the reason the other host could not run. The payload reaches the helper through a stdin file, so the grader looks for the JSON key in the trace rather than in one tool's command.

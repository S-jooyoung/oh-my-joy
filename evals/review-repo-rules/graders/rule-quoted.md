---
type: llm
---
The report flags the `/api/time` route in src/server.mjs, which returns `Date.now()` as an epoch number, as a finding grounded in the rule from src/AGENTS.md that JSON response timestamps are ISO 8601 strings and never epoch numbers — the finding quotes or closely paraphrases that rule and names src/AGENTS.md. Any severity and label are acceptable.

---
type: llm
---
The reply flags `searchUsers` in src/db.mjs, which inserts `term` into its SQL string instead of binding it through `query`'s params, as SQL injection, and traces the input to the `q` query parameter that src/routes.mjs reads.

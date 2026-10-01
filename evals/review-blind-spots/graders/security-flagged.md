---
type: llm
---
The report flags `searchUsers` in src/db.mjs, which inserts `term` into its SQL string instead of binding it through `query`'s params, as a 🔴 security finding (SQL injection), and traces the input path: the `q` query parameter that src/routes.mjs reads with `url.searchParams.get('q')` reaches that query.

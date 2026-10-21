---
type: llm
---
For reading the `email` query parameter the plan relies on a Node built-in such as `URL` or `URLSearchParams` (or the `node:url` module), and it does not plan a hand-written query-string parser or a new dependency for validation or parsing. A plan that leaves parsing to an existing request helper in the repository is also acceptable. Fail if the plan adds a dependency or writes its own query parser.

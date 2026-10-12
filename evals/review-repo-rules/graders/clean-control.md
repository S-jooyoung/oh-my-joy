---
type: llm
---
Judge only what the report says about the `/api/items/:id` route's `createdAt` field, which is `new Date().toISOString()`, an ISO 8601 string. Pass unless the report claims that this `createdAt` breaks the src/AGENTS.md timestamp rule (ISO 8601 strings, never epoch numbers). Findings about the `/api/time` route are expected and do not affect this grade, the report does not need to state that `createdAt` is ISO, and other findings about the `/api/items/:id` route (for example its id parsing or that `createdAt` is generated per request) are acceptable.

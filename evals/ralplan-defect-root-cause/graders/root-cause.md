---
type: llm
---
The plan traces the defect to its origin — `parseAmount` in `src/parse.mjs` returns `undefined` for an input with a thousands separator such as '1,000' — rather than only to the `toFixed` call in `src/format.mjs`, and places the fix at that origin. It includes a reproduction check (for example a test of formatAmount('1,000')) recorded failing before the fix and passing after it. It does not propose optional chaining or a default value at the `toFixed` call as the fix; mentioning that approach as a rejected alternative is fine.

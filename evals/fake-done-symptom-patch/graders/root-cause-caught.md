---
type: llm
---
The reply identifies that the new `value === undefined` guard in src/format.mjs, which returns '0.00', only hides the symptom, and names parseAmount in src/parse.mjs as the unchanged code that produces the wrong value (Number('1,000') is NaN, so it returns undefined), recommending the fix there.

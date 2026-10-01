---
type: llm
---
The report flags the new `value === undefined` guard in src/format.mjs, which returns '0.00', as a 🟡 `symptom patch` and names parseAmount in src/parse.mjs as the unchanged code that produces the wrong value (Number('1,000') is NaN, so it returns undefined), recommending the fix there. A separate finding about the silently wrong '0.00' result may carry any severity.

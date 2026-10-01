---
type: llm
---
The report does not call the validation added to parseQuantity in src/quantity.mjs a symptom patch: that check sits in the function that produces the value. Other findings about that change, such as a missing test for the new RangeError, are acceptable.

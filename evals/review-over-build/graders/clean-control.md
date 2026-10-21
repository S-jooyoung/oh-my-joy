---
type: llm
---
The report does not call `applyDiscount` in src/discount.mjs an over-build, a reimplementation, or a candidate for deletion: it is new logic with no existing equivalent in the repository or the platform. Other findings about it (for example rounding of fractional cents) are acceptable, and findings about the pre-existing defect in src/parse.mjs (`'1,000'` parsing to undefined) are acceptable too.

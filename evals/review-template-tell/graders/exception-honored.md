---
type: llm
---
The approved plan marks T1, the violet-to-indigo gradient on the hero section in src/app/page.tsx, as chosen by docs/DESIGN.md; this case pins that a tell the plan marks with its source is not a 🔴. Look only at where the report places that gradient. Return "pass": true when the gradient is absent from the 🔴 findings — listed under 🟡 or 🟢 (for example raw primitive color classes, or a note that the design document chose it), or not mentioned at all. Return "pass": false when the gradient itself is listed among the 🔴 findings for any reason, as a template tell, a generic pattern, or anything else. Findings about other files, such as Features.tsx, do not affect this verdict.

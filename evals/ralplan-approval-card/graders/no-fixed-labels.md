---
type: regex
pattern: "Skipped / not checked / risk|Hand-back:|Expected execution:|Critique: ready|^(?:(?!-{3,}[ \\t]*(?:\\n|$))[^\\n]*\\n)*?(?!-{3,}[ \\t]*(?:\\n|$))[^\\n]*Completion condition:"
match: not_contains
target: last_message
---
The plan carries none of the four retired labels anywhere. `Completion condition:` is refused only inside the card: the draft still ends with a completion condition for the executor, below the divider.

---
type: regex
pattern: "design audit needs a route"
flags: "i"
match: contains
target: last_message
---
`--design` without a route stops with the guard message instead of auditing nothing.

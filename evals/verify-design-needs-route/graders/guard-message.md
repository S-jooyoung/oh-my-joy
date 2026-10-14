---
type: regex
pattern: "(needs|requires) a route"
flags: "i"
match: contains
target: last_message
---
`--design` without a route stops with the guard message, in its own words or close to them ("the design audit needs a route"), instead of auditing nothing.

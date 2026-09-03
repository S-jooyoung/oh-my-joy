---
type: regex
pattern: "Already clear enough|already clear|proceed with `/oh-my-joy:spec`|/oh-my-joy:spec"
match: contains
target: last_message
---
Concrete input (file paths, acceptance criteria, error messages) makes the suitability gate exit and point at spec.

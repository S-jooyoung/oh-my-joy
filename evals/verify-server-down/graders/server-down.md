---
type: regex
pattern: "dev server (is not|isn't|was not|wasn't|not) running|no capture backend"
flags: "i"
match: contains
target: last_message
---
Nothing listens on the base URL, so browser mode stops with "dev server not running" (or, on a machine without a capture backend, "no capture backend") instead of judging a screen.

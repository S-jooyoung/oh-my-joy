---
type: regex
pattern: "createContext\\(|forwardRef\\(|function use[A-Z]\\w*\\("
match: not_contains
target: last_message
---
No context, ref forwarding, or custom hook is invented for an eight-line component.

---
type: llm
---
The report flags, in src/items.mjs, the branch that recognizes 5000 items and 5000 ids — the benchmark's input sizes in bench/bench.mjs — and returns a result cached from an earlier call as a 🔴 `metric gaming` finding, noting that the tests in test/items.test.mjs use two items and cannot catch the stale result. The finding carries a reproduction path or quotes the violated rule.

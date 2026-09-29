---
type: llm
---
The plan uses an `experiment` goal for this request. It names the metric `lookup_ms` with direction lower, an evaluator argv that runs the benchmark (`npm run bench` or `node bench/bench.mjs`) with repeats of three or more because it is a time metric, a scope limited to `src/items.mjs`, sealed files that include `bench/` and the tests under `test/`, a guard that runs the tests, and a trial budget (`maxTrials`). It does not invent a target number, since the user named none, and it contains no implementation code body for `lookupAll`.

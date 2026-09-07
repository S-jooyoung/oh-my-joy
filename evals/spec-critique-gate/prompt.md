---
name: spec-critique-gate
tags: [spec, general, critique]
runs: 3
max_turns: 14
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill]
scaffold_script: cp -R "$EVAL_FIXTURES/node-service/." .
---
/oh-my-joy:spec "add request logging to the public API — one JSON line per request on stdout with method, path, status, duration in ms, and a request id taken from the x-request-id header or generated when absent"

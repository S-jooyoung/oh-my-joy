---
name: deep-interview-gate
tags: [deep-interview, gate]
runs: 3
max_turns: 6
timeout_seconds: 180
allowed_tools: [Read, Grep, Glob]
scaffold_script: cp -R "$EVAL_FIXTURES/node-service/." .
---
/oh-my-joy:deep-interview "add a token-bucket rate limiter in src/server.mjs; acceptance: 429 after 100 requests per minute per API key, Retry-After header set; tests in test/rate-limit.test.mjs; error message 'rate limit exceeded'"

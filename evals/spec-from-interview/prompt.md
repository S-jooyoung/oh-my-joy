---
name: spec-from-interview
tags: [spec, general, interview]
runs: 3
max_turns: 14
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill]
scaffold_script: cp -R "$EVAL_FIXTURES/node-service/." .
---
The deep interview just closed with these requirements. Take them as the input and build the implementation spec.

# Requirements (from /oh-my-joy:deep-interview)

Goal: every request to the public API is answered with a `x-request-id` response header, echoing the caller's header when present and a generated UUID otherwise.

Constraints: no new dependency; the existing `handle()` contract and its tests keep passing.

Acceptance criteria:
1. A request carrying `x-request-id: abc` receives `x-request-id: abc` in the response.
2. A request without the header receives a response header that is a valid UUID.
3. Two requests without the header receive different ids.

Non-goals: request logging, tracing propagation to upstream services.

Verification commands: `npm test`

/oh-my-joy:spec

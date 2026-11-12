# Adaptive execution

OMJ keeps one execution entry: `/oh-my-joy:ultragoal` in Claude and `$oh-my-joy:ultragoal` in Codex. Explicit interview and planning requests retain their read-only gates. Task size alone never grants authority.

## Route before editing

Run the installed `scripts/execution-config.mjs --resolve` with a JSON object of explicit task configuration overrides on stdin (use `{}` when none). Read the effective values, their sources, and warnings. Read [runtime adapters](RUNTIME-ADAPTERS.md) before dispatch. A leader preference is not proof of a host switch.

Run `scripts/execution-config.mjs --route` with observed facts on stdin. A read-only host mode remains read-only even when the route is direct: present the bounded work through its approval surface instead of attempting edits. Set a fact to true only after inspection establishes it:

- `resume`: resuming a named existing ledger; preserve its original completion contract.
- `approvedPlan`: a plan already approved by the user; execute it without another gate.
- `explicitPlanning`: the user explicitly requested an interview or plan; preserve that gate.
- Direct-route facts: `clearGoal`, `boundedLocalChange`, `knownVerification`, `singleHost`, `noPublicContractChange`, `noSensitiveChange`, `noExternalWrite`.

All seven direct-route facts must be true. Sensitive changes include authentication, authorization, money, destructive data operations, migrations and concurrency control. Uncertain scope, changed public interfaces/dependencies, or mixed-host implementation goes to planning. A raw request to merge or publish never becomes local-write authority. The helper returns `resume`, `planned`, `direct`, or `plan`; an omitted fact is not true.

## Direct route

The lead states the bounded scope and check, reads the affected code, implements inline, and verifies observable behavior. It does not create a durable ledger, spawn workers or require an independent review by default. Use the implementer's context, minimal-change, diagnostic and reporting rules inline; this is not an unapproved teammate dispatch. Report changed files, command/exit/result, and `Skipped / not checked / risk:`. Do not claim durable completion or background continuation.

If the task crosses the stated boundary, retain the completed safe changes, stop additional edits, and hand the expanded scope to ralplan. Never revert unrelated work or treat the earlier request as approval of the expansion. If the local check fails, diagnose and fix within scope; an unresolved check means incomplete, not done.

## Planned route

Use the existing ralplan approval and ultragoal evidence loop. Review requirements in an existing ledger are immutable; no direct-route setting weakens them. Existing `spec` is still the planning alias. No extra command or automatic hook is needed.

## Questions

Prefer the host's native selection tool when it is allowed in the active mode and the client renders it. In Claude use its question UI; in Codex check the current tool contract instead of guessing that all structured tools render a picker. A tool accepting a request is not evidence that the user received a selectable control. User reports of text-only choices override that assumption: use one short numbered question until a supported UI is confirmed.

When a native picker is unavailable, explain once and accept a number or free text. Never interpret silence as a selection. Plan mode can expose a different question surface; the user changes modes through the host UI when no supported transition tool exists. A skill cannot change modes merely by declaring it did. Codex's `default_mode_request_user_input` was available but marked under development in CLI 0.167.2; detect the installed version and supported feature before offering it as an optional setup change, never enable it automatically. Real UI verification requires selecting an option and observing the returned answer, not matching words in a trace.

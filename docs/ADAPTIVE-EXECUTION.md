# Adaptive execution

OMJ keeps one execution entry: `/oh-my-joy:ultragoal` in Claude and `$oh-my-joy:ultragoal` in Codex. Explicit interview and planning requests retain their read-only gates. Task size alone never grants authority.

## Route before editing

Run the installed `scripts/execution-config.mjs --resolve` with a JSON object of explicit task configuration overrides on stdin (use `{}` when none). Read the effective values, their sources, and warnings, and repeat each warning in the report's `Your move`: a `required` cross-host declaration now resolves to `preferred` with a warning, and the user should see that the review got weaker rather than discover it later.

Read [the principles index](principles/INDEX.md) when the run starts. Then run `scripts/execution-config.mjs --route` with observed facts on stdin. A read-only host mode remains read-only on every route: present the work through its approval surface instead of attempting edits. Set a fact only after inspection establishes it; an omitted fact is not true.

- `resume`: resuming a named existing ledger; preserve its original completion contract.
- `approvedPlan`: a plan already approved by the user; execute it without another gate.
- `explicitPlanning`: the user explicitly requested an interview or plan; preserve that gate.
- `clearGoal`, `noSensitiveChange`, `noPublicContractChange`, `noExternalWrite`: booleans. Sensitive changes include authentication, authorization, money, destructive data operations, migrations and concurrency control.
- `deliverables`: how many separate results the user asked for, as an integer.
- `targetFiles`: how many files the work will change or create, tests included, as an integer.

The helper returns `resume`, `planned`, `plan`, or `playbook`. It returns `playbook` only when all four booleans are true, `deliverables` is 1, and `targetFiles` is 5 or fewer, so approval appears exactly when the work is risky, has two or more deliverables, or touches six or more files. A raw request to merge or publish never becomes local-write authority.

## Playbook route

Pick the playbook type — bug fix, feature, refactor, or investigation — and read `docs/playbooks/<type>.md` beside this document, then the principle detail files it lists that apply. When no type fits, work that edits files is `feature` and anything else is `investigation`. The lead runs the playbook inline: it creates no ledger, asks no question, spawns no implementer, and follows the implementer's context, minimal-change, diagnostic, and reporting rules itself.

Review exactly as the playbook's `Review` section says, handing the reviewer the files it names under `.omj/review/`; the verdict and each 🟡, shortened to at most three lines, appear only in the report's How it was checked, not in a section of their own. Fix every 🔴 and get a new review in a fresh context. After three failing reviews, stop and report both positions instead of a fourth round, because no helper counts reviews on this route.

If the work crosses the boundary the route counted — it turns out risky, grows a second deliverable, or needs a sixth file — keep the changes already finished safely, revert nothing, stop editing, and hand the rest to `ralplan`. The earlier request never approved the expansion, and undoing finished work would throw away what the user can still use. If the local check fails, diagnose and fix within scope; an unresolved check means incomplete, not done.

Report in the five parts of [REPORTING.md](REPORTING.md) — Conclusion, Your move, What changed, Decisions made for you, How it was checked — stating each check in one line with its check strength. Do not claim durable completion or background continuation.

## Planned route

Use the existing ralplan approval and ultragoal evidence loop. Review requirements in an existing ledger are immutable; no playbook rule weakens them. No extra command or automatic hook is needed.

## Questions

Prefer the host's native selection tool when it is allowed in the active mode and the client renders it. In Claude use its question UI; in Codex check the current tool contract instead of guessing that all structured tools render a picker. A tool accepting a request is not evidence that the user received a selectable control. User reports of text-only choices override that assumption: use one short numbered question until a supported UI is confirmed.

When a native picker is unavailable, explain once and accept a number or free text. Never interpret silence as a selection. Plan mode can expose a different question surface; the user changes modes through the host UI when no supported transition tool exists. A skill cannot change modes merely by declaring it did. Codex's `default_mode_request_user_input` was available but marked under development in CLI 0.167.2; detect the installed version and supported feature before offering it as an optional setup change, never enable it automatically. Real UI verification requires selecting an option and observing the returned answer, not matching words in a trace.

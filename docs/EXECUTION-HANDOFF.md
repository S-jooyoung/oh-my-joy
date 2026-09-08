# OMJ planning and execution handoff

This document is the provider-neutral source of truth for the OMJ workflow boundary. Claude commands and Codex skills adapt syntax and available tools; they do not add approval steps or redefine authority.

```text
deep-interview (only when requirements are fuzzy)
        ↓ automatic requirements handoff
ralplan (ground + independent critique)
        ↓ one native plan approval
ultragoal (execute + durable evidence + resume)
        ↓
report, or explicitly authorized existing-PR delivery
```

`spec` is a compatibility alias for `ralplan`. `sync` remains the separate Figma Variables/token workflow.

## Runtime adapters

| Contract | Claude Code | Codex |
| --- | --- | --- |
| Invoke | `/oh-my-joy:<name>` | `$oh-my-joy:<name>` |
| Interview choice | `AskUserQuestion` | structured user input when exposed; one concise question otherwise |
| Plan approval | native Plan/`ExitPlanMode` | native Plan mode and one `<proposed_plan>` block |
| Continuation | native `/goal` when callable | native goal operations when exposed and authorized |
| Parallel work | Agent Teams when enabled, then subagents, then inline | typed subagents, then default subagents, then inline |
| Durable proof | `scripts/goal-state.mjs` | `scripts/goal-state.mjs` |

The adapters never require the other host. Figma, documentation, browser, native-goal, and agent capabilities are detected from the current session and degrade only along the paths documented here.

## One approval boundary

`deep-interview` asks only questions that reduce requirement ambiguity. Once its closure audit passes, it hands requirements to `ralplan` automatically. It does not ask whether to plan, choose an execution lane, or produce a small plan itself.

`ralplan` owns the complete implementation plan. It inspects current code and, when relevant, Figma or all paginated GitHub PR review material. The lead planner self-checks every plan. Non-trivial plans also receive fresh `architect` and `critic` readings for at most two revision rounds. Reviewers advise; the lead records every accepted, rejected, or synthesized disposition and never claims artificial consensus.

The resulting plan contains executable goal units, checkable acceptance criteria, verification commands, independent-review requirements, a completion condition, assumptions, non-goals, and any explicitly authorized delivery. The native plan approval is the user's only approval for that described scope. The same session then hands the approved plan to `ultragoal`; users do not choose or invoke `/goal` separately.

## Native goal and durable ledger

Native goal support supplies continuation only. OMJ does not install an auto-firing hook or recreate a stop loop.

`ultragoal` requires Node.js 20 or newer and a Git worktree. `ralplan` checks both. In a non-Git target it may propose `git init` as an explicit local setup step for approval; neither planning nor execution silently initializes a repository. Without that approved step, durable execution stops before ledger creation.

- Claude may expose `/goal` through a host-controlled `ProposeGoal` approval. OMJ respects that gate and continues after the host decision.
- Codex native create/get/update operations are used only when the current session exposes them and scoped authorization permits them.
- An unrelated active native goal is never cleared, replaced, completed, or updated. OMJ continues inline and uses its own ledger.
- When no callable native goal exists, `ultragoal` runs the same completion loop in the current session and reports native persistence as unavailable once.

The durable layer is `scripts/goal-state.mjs`. The lead reads `status` before every state change and sends mutation JSON on stdin with the exact `expectedRevision`. A compare-and-swap conflict triggers a new status read and a decision about what remains; it never triggers a blind retry. Subagents never invoke the helper or edit `.omj/goals/`.

Evidence is tied to the current repository fingerprint. Change goals use the helper's argv-based `verify`; report goals use `evidence`. Every goal requires a truly independent passing `review`, and closure requires another final review. When the host exposes no independent reviewer context, execution reports that blocker; the lead cannot relabel self-review as independent. Final proof and final review must share the current fingerprint, so an edit after either invalidates closure. A ledger can close only after all goals and PR findings have evidence and any required delivery has been read back.

## Execution and parallelism

`ultragoal` chooses the smallest execution shape that fulfills the approved plan:

1. Coupled or small work stays with the lead.
2. Three or more independent units with disjoint files may use the OMJ `implementer` agent through the host's native agent surface. In Claude, Agent Teams require `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`; without it, use ordinary subagents, then inline. Each implementer gets one goal, exclusive owned files, acceptance criteria, and a verification command.
3. Shared files remain with the lead. Nested teams are not used.
4. Workers edit only their ownership and return evidence. They never update the ledger, commit, push, reply on a PR, or mark completion.
5. The lead integrates results, runs goal verification, records receipts, and runs final verification plus independent review.

A resolvable blocker gets three materially different attempts: exact-failure inspection, a focused diagnostic or alternate path, and a smaller/reordered approach. Credentials, external approval, physical action, or paid access are human-only blockers. Record `block` only for an active goal. If all goals are complete but final audit or delivery is blocked, leave the ledger open and report the missing close gate; resume continues those final steps without reopening completed goals.

## GitHub PR authority

A PR URL alone is read-only authority. `ralplan` may inspect metadata, the current head, the diff, and every paginated review thread/comment. It triages findings against current code as accepted or rejected with rationale.

An explicit request to process/address/apply review feedback changes the proposed plan: by default it includes scoped delivery back to that existing PR. Approving that plan authorizes only:

- editing the files and findings named by the plan on the actual PR head branch;
- committing only those owned edits;
- a normal non-force push to that branch;
- one evidence-bearing reply per planned finding;
- readback of the remote head and reply URLs.

The PR head branch must not be a shared/integration branch. `ultragoal` rechecks the remote head immediately before delivery and stops on incompatible drift. An uncertain push or reply is reconciled through remote readback before retry, preventing duplicate commits or comments. The ledger delivery receipt contains the PR URL, delivered head SHA, and one stable reply URL per finding.

Force-push, merge, PR closure, base changes, and a new PR remain outside this approval. A new PR uses the explicit `/oh-my-joy:ship` workflow; merge remains a separate explicit user action outside `ultragoal`.

## Completion report

Completion means the ledger `close` transition succeeded. The report includes changed files, every goal and acceptance result, verification argv/exit code/artifact, independent-review receipt, assumptions, blockers, and external delivery readback when authorized. If close fails, work remains; `ultragoal` fixes the missing proof or reports the real blocker instead of declaring completion.

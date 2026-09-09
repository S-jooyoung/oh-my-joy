---
user-invocable: false
disable-model-invocation: true
name: ultragoal
description: "Execute or resume an approved OMJ plan through verified completion, including only the existing-PR delivery that was explicitly authorized."
license: MIT
metadata:
  author: Jooyoung Shin
  version: '0.9.0'
---

# Ultragoal

Read [the canonical ultragoal contract](../../commands/ultragoal.md) and [execution handoff](../../docs/EXECUTION-HANDOFF.md) completely before acting. This skill is the single execution/resume entry after an approved `ralplan`; do not require the user to invoke a second goal command.

## Codex adapter

- Raw work without an approved plan invokes the installed ralplan skill in this session, or follows its canonical contract if invocation is unavailable. Stop at the final approval gate; after approval resume ultragoal automatically without asking the user to run it again.
- Before any ledger action, require Node.js 20+ and a Git worktree. Run `git init` only when the approved plan names that local setup step; otherwise report the prerequisite and do not initialize state.
- Use Codex native goal support internally only when exposed. Call `get_goal` first. If none exists, `create_goal` with one aggregate objective that names the approved OMJ slug and plan hash and defines completion as ledger close with current proof/review; the approved ultragoal handoff supplies this scoped authorization. Set no token budget unless the user explicitly supplied one. If the exact compatible goal already exists, reuse it. Preserve any unrelated active goal and continue inline.
- Intermediate OMJ goal completion never updates native status. Only after ledger `close` succeeds and the final status readback confirms current proof/review, call `get_goal` again, verify the exact native identity, then `update_goal complete` and read it back. Follow the host API's blocked threshold; never mark the native goal blocked immediately. Never clear or replace native goal state.
- Use `scripts/goal-state.mjs` exactly as the canonical protocol specifies: `status` before mutation; pending goals use `start`, blocked goals use `resume`, and active goals continue without a transition; JSON stdin; exact `expectedRevision`; fresh status after CAS conflict; goal-scoped proof; final proof/review on the current fingerprint; leader-only writes. Never let a subagent invoke the helper or edit `.omj/goals/`.
- Implement directly for coupled work. For three or more disjoint units, use native subagents with explicit file ownership; wait for their evidence and integrate it before ledger updates. If unavailable, execute sequentially.
- Run verification through the helper's argv interface without a shell. Do not treat the helper as permission to run commands outside the approved plan.
- Use a fresh native reviewer for every goal and for the required final review. If none is exposed, block transparently; never record the lead's self-review as independent. Complete a goal only after its proof and goal review pass. Any edit or commit after final verification or review requires both again.
- For explicitly authorized existing-PR delivery, enforce the canonical exact-branch, non-shared-branch, no-force-push, head-recheck, per-finding reply, readback, and uncertain-send read-before-retry rules. New PR creation uses `$oh-my-joy:ship`; merge remains a separate explicit user action.

Keep going until `close` succeeds, a human-only blocker remains, or the user cancels. Record blockers on an active goal; for final-audit or delivery blockers after all goals complete, leave the ledger open and report the missing close gate. Report native-goal unavailability only once; do not describe ledger resume as degraded.

Use `$oh-my-joy:ultragoal` with the approved plan in context, `$oh-my-joy:ultragoal resume <slug>` (`--resume` alias), or `$oh-my-joy:ultragoal status <slug>`.

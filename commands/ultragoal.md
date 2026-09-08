---
description: Execute or resume an approved OMJ plan to evidence-backed completion, using native goal continuation when available and a durable revision-checked ledger
argument-hint: "[approved plan | resume <slug> | status <slug>]"
allowed-tools: Read, Grep, Glob, Edit, Write, Agent, Skill
---

# /oh-my-joy:ultragoal — Execute, prove, and resume

`ultragoal` is the single user entry for execution after the one approved `ralplan`. It owns the full stretch from approved plan to evidence-backed completion: implement, test, independently review when required, fix and re-verify, perform only the delivery the plan explicitly authorized, and report. A later invocation resumes the durable ledger; it never asks the user to run a separate native goal command.

This workflow does not recreate an infinite stop hook. When the host exposes native goal continuation, use it internally with the condition “this approved OMJ run's ledger closes with current proof and review.” Claude Code 2.1.263 may surface `/goal` through a `ProposeGoal` host approval: respect that host gate and let the host evaluate completion; never auto-clear it. Codex uses the exact protocol in its adapter below. When no callable native goal exists, run the same loop in this session. In every case, the OMJ ledger supplies durable resume and evidence; native goal support only supplies continuation.

## Admission and authority

Start only from a plan approved through the native plan gate, or resume an existing ledger. For a raw task with no approved plan, invoke the installed `ralplan` skill with that task in this session and stop at its final approval gate. If internal invocation is unavailable, read and follow the canonical ralplan contract directly. Do not merely print another command for the user to run. Approval then hands back to ultragoal automatically, without requiring a repeat invocation. Plan approval authorizes local implementation and the exact `Authorized delivery` section only.

Before creating or reading a ledger, require Node.js 20 or newer and a Git worktree. If the approved plan explicitly includes local `git init`, run that setup first and then initialize the ledger; Git initialization is never inferred from generic implementation approval. Without an approved setup step, report the missing prerequisite and create no fake ledger or completion evidence.

- Local code, tests, review fixes, and ledger writes are in scope.
- Existing-PR commit, push, and review replies are in scope only when the approved plan explicitly processed that PR's review and recorded `deliveryRequired: true`.
- Force-push, merge, closing a PR, opening a new PR, changing the PR base, and writing to another branch remain outside this workflow. Route a new PR to `/oh-my-joy:ship`; merge requires a separate explicit user action.
- Never clear, replace, complete, or update an unrelated active native goal. If native goal storage is occupied, preserve it and use the same-session loop plus the OMJ ledger.

Derive a stable short slug from the approved plan and keep it for every invocation. The helper is `${CLAUDE_PLUGIN_ROOT}/scripts/goal-state.mjs` (repo-relative `scripts/goal-state.mjs`). Every helper result is JSON on stdout; errors are `goal-state: ...` on stderr with exit 1. Never interpolate JSON into a shell command. Pass mutation payloads through a temporary stdin file or a single-quoted heredoc and keep secrets out of the ledger.

## Durable ledger protocol

The lead is the only ledger writer. Subagents receive a goal, owned files, acceptance criteria, and verification command; they return evidence to the lead and never invoke `goal-state.mjs` or edit `.omj/goals/`.

1. Read first: `node .../goal-state.mjs status --slug <slug>`. It returns ledger-derived full state including `revision` and `snapshotStatus` (`ok`, `missing`, `corrupt`, or `mismatch`). An invalid or truncated ledger still fails. When snapshot status is not `ok`, use that returned revision for storage-only `reconcile` before continuing.
2. New work: call `init --slug <slug>` with `{brief, goals:[{id?,title,objective,kind:"change"|"report",acceptance:[...]}], pr?}`. GitHub PR state is `{host:"github.com",repo,number,headSha,deliveryRequired,findings:[{id,title?}]}`; `headSha` is the planning baseline, not proof that delivery happened.
3. Every later mutation includes the exact `expectedRevision` just read. On a compare-and-swap failure, run `status`, reconcile what another writer completed, and retry only the still-needed transition. Never blind-retry stale input.
4. Claim or resume one unit with `start` or `resume`: `{expectedRevision,goalId}`. Record a real human-only or exhausted blocker with `block`: `{expectedRevision,goalId,reason}`; first try the recovery rules below.
5. For a `change` goal, run its actual verification through `verify`: `{expectedRevision,scope:{goalId}|"final",argv:[...],cwd?}`. The helper executes argv without a shell and returns JSON including `artifact`, `exitCode`, `stable`, `revision`, and `fingerprint`. Exit 0 with `stable:false` is ineligible because the verification command changed the checked workspace. Do not pre-authorize arbitrary `verify` invocations merely because they pass through the helper.
6. For a `report` goal, record checked evidence with `evidence`: `{expectedRevision,scope:{goalId}|"final",summary,acceptance:[...]}`. This is report-only and returns an artifact tied to the current fingerprint.
7. Record an independent review for every goal with `review`: `{expectedRevision,scope:{goalId}|"final",reviewer,verdict:"pass"|"fail",summary}`. `reviewer` is the actual independent reviewer/agent ID, never a role label invented by the lead. A failing review is work to fix, not a completion receipt.
8. Complete a unit only after its acceptance is proved and its goal review passes: `complete` with `{expectedRevision,goalId,acceptanceEvidence:[{criterion,evidence}]}`. Entries stay in the immutable acceptance-array order, each `criterion` matches its source string exactly, and each `evidence` is a concrete non-empty summary; the helper separately binds the matching proof and review artifacts.
9. For each PR finding, call `finding` with `{expectedRevision,id,disposition:"accepted"|"rejected",rationale,verificationArtifact?}`. Accepted findings need verification; rejected findings need current-code rationale.
10. After authorized delivery, call `delivery` with `{expectedRevision,url,headSha,replies:[{findingId,url}]}`. The helper verifies local `HEAD` equals `headSha` and every reply maps to a known finding.
11. Before final reporting, run final verification/evidence and final independent review against the current fingerprint, then `close` with `{expectedRevision}`. Close succeeds only when every goal and finding is complete, required delivery has a current-fingerprint receipt, every PR finding has a reply URL, and final proof plus review still match the code.

`reconcile` is storage recovery only: with the revision from an intact ledger, call it using `{expectedRevision}` to rebuild a missing, corrupt, or behind `goals.json` atomically from `ledger.jsonl`. It never infers, retries, or records external delivery/readback.

## Execution loop

1. **Status or resume before starting.** `status <slug>` is read-only: return the ledger-derived state and snapshot status, then stop. For `resume <slug>`, read status and map state precisely: start the next `pending` goal with helper `start`; call helper `resume` only for a `blocked` goal; continue an `active` goal without another transition; when all goals are complete but the plan is open, run the remaining final audit/delivery/close; when already closed, report status only. Completed goals stay complete; later edits require fresh final proof/review rather than reopening them.
2. **Attach native continuation when safe.** Give the host goal the overall completion condition, not a second user-facing workflow. If the host requires approval, let the host present its gate. If unavailable or occupied by unrelated work, continue inline.
3. **Implement from the approved plan.** Confirm real target files and reuse points, then make the smallest aligned change. For parallelizable disjoint goals, the lead may spawn bounded agents with exclusive file ownership and wait at the verification barrier. Shared files stay with the lead. Subagents never commit, push, reply, or write the ledger.
4. **Verify each goal.** Run the approved targeted command through `verify`; fix failures and rerun. Report goals use `evidence`. Record artifacts covering every acceptance row before requesting the goal review.
5. **Review every goal.** Use a fresh read-only reviewer context against the approved plan, the goal, and current diff. Fix `fail` findings, rerun affected verification, obtain a passing goal review receipt, then complete that goal. The lead decides and records dispositions; reviewer agents do not edit. If no independent reviewer context is exposed, record a transparent blocker: a lead self-review is not independent and must not be written as a passing reviewer receipt.
6. **Prepare authorized delivery.** When delivery is authorized and accepted findings changed code, validate the existing PR branch and create the scoped commit. Otherwise skip commits. No external write occurs yet.
7. **Final proof.** Run the plan's full verification suite through `verify` with `scope:"final"`, then obtain a final passing independent review on the same committed/current fingerprint. Any edit or commit after either receipt invalidates closure and requires both checks again.
8. **Deliver only when authorized.** Push and reply using the existing-PR procedure, read back the head and receipts, then record `delivery`. Without authorization, perform no push or external message.
9. **Close and report.** Close the ledger, run `status` once more, and compare the returned `closed`, `revision`, goal completions, final proof/review fingerprints, finding dispositions, and delivery receipt with the helper outputs collected in this run. Report those verified fields with changed files, argv/exit codes/artifacts, assumptions, and blockers. If native persistence was unavailable, say so once; ledger-based resume remains available.

For a resolvable blocker, try three materially different approaches: inspect the exact failure, run a focused diagnostic or alternate local path, and reduce/reorder the task. A human-only blocker is credentials, an external approval, a physical action, or a paid resource. For an active goal, record it with `block` and report it without claiming completion. After every goal is complete, a final-audit or delivery blocker leaves the ledger open: report the exact missing close gate, do not call `block` without an active goal, and resume the remaining final steps later.

## Existing-PR delivery

Run this section only when the approved plan contains the PR identity, baseline head SHA, findings, and explicit delivery authorization.

1. Resolve the current repository, branch, remote, PR head branch, and current remote head SHA. The checked-out branch must be the actual PR head branch and must not be a shared/integration branch (`main`, `master`, `develop`, `dev`, `trunk`, `staging`, or `release/*`). Never create a substitute branch for this delivery.
2. Re-read the PR immediately before writing. If the head moved from the ledger baseline, compare the new commits and current findings with the plan. Continue only when the approved changes still apply cleanly; otherwise record the drift blocker rather than overwriting another contributor.
3. Stage only files owned by completed change goals, by explicit path. Never use `git add .` or `git add -A`. When accepted findings changed code, commit with the repository's conventions and no AI attribution or bypass flags. When all findings are rejected or already resolved and the tree has no owned change, skip the empty commit and push.
4. After any commit, run final verification and final independent review on the committed fingerprint. Then push the current PR head normally. Never use force, force-with-lease, or a refspec that rewrites another branch.
5. Read back the PR head SHA and confirm it equals local `HEAD`. Reply once to every planned finding with its accepted/rejected rationale and verification evidence. For an inline review comment, use GitHub's [reply endpoint](https://docs.github.com/en/rest/pulls/comments#create-a-reply-for-a-review-comment): POST to `repos/{owner}/{repo}/pulls/{number}/comments/{root_comment_id}/replies`. Replies to replies are unsupported, so resolve `in_reply_to_id` to the root comment. For review-summary or issue-discussion feedback, create a PR issue comment that links the source review/comment ID. Use a deterministic per-finding marker in the body for uncertain-send readback. Do not invent a `reviews/{id}/replies` endpoint or resolve a review thread unless the approved plan separately authorizes resolution. Capture each returned `html_url` as the stable receipt.
6. If push or reply outcome is uncertain, do not retry. Read the remote head and thread/comment state first, then perform only the missing operation. Record already-completed delivery through the normal `delivery` receipt; `reconcile` is not an external-state tool. Duplicate comments and duplicate commits are delivery failures.
7. Write the `delivery` receipt only after head and reply readback. The PR URL, delivered SHA, and one `{findingId,url}` receipt per finding are required.

## Usage

<example>

```text
/oh-my-joy:ultragoal                         # approved plan is in this session
/oh-my-joy:ultragoal resume rate-limit-api   # --resume remains accepted as an alias
/oh-my-joy:ultragoal status rate-limit-api   # read-only ledger status
```

</example>

---
description: Build one decision-complete plan for coding, Figma, interview requirements, or GitHub PR review; ground it in current evidence, independently critique it, then stop at the single approval gate
argument-hint: "[figma-url | PR-url | task description] [verification-route]"
allowed-tools: Read, Grep, Glob, Skill, Agent, AskUserQuestion, mcp__plugin_figma_figma__get_design_context, mcp__plugin_figma_figma__get_screenshot, mcp__plugin_figma_figma__get_variable_defs, mcp__plugin_figma_figma__get_metadata, mcp__figma__get_design_context, mcp__figma__get_screenshot, mcp__figma__get_variable_defs, mcp__figma__get_metadata, mcp__plugin_context7-plugin_context7__*, mcp__context7__*
---

# /oh-my-joy:ralplan — Decision-complete plan

Convert the request into the one implementation plan the user approves. This command is read-only: it may inspect repositories, designs, documentation, and PR data, but it never edits code, changes a PR, commits, pushes, or starts execution. After presenting the final plan, stop at the host's native plan-approval boundary. Approved delivery begins through `/oh-my-joy:ultragoal`; the user does not choose a second execution lane.

## Input and authority

Classify `$ARGUMENTS` from explicit signals:

1. A trailing `/route` is the verification route. Otherwise infer it from the mount point and mark it inferred; leave it blank when no route can be grounded.
2. A `figma.com` URL activates the Figma track. Text beside it is a development requirement and composes with the design.
3. A GitHub pull-request URL activates the PR track. Distinguish a read-only request such as "review this PR" from an explicit delivery request such as "process/address/apply the review comments". Read-only wording authorizes inspection and a plan only. Explicit processing means the approved plan also authorizes scoped commits and pushes to that existing PR branch plus replies to the reviewed threads; it never authorizes force-push, merge, closing the PR, or opening another PR.
4. Text without a URL is frontend when it names UI components, hooks, pages, routes, styles, tokens, or frontend paths; otherwise it is general engineering work.
5. Decision-complete requirements produced by `deep-interview` are canonical input. Carry their goal, constraints, acceptance criteria, non-goals, exposed assumptions, and `Research first` rows forward without asking again.
6. Empty input with no interview requirements prints Usage. Materially fuzzy input routes to `/oh-my-joy:deep-interview`; otherwise keep planning.

`Research first` is a planning stage, not another command. Run only the research needed to resolve an implementation decision: repository inspection first, official current documentation for unfamiliar or version-sensitive APIs, and an explicit measurement/spike only when no documentary answer can make the plan safe. Record the source or the unresolved external fact in the plan.

## Ground the plan

Check execution prerequisites before declaring the plan ready: Node.js 20 or newer and a Git worktree. `ultragoal` needs Git identity and fingerprints for its durable ledger even when the requested change itself does not use Git. In a non-Git target, either include `git init` as an explicit approved local setup step when repository initialization fits the user's task, or state that durable execution is blocked until a Git worktree exists. Never initialize Git during planning or promise an immediately runnable ultragoal without this prerequisite.

Read the real target files, nearby reusable symbols, repository instructions, and the commands that prove the work. Prefer `verifyCommands:` in `.omj/fe-context.md`, then `package.json` scripts named `typecheck`, `lint`, and `test`. Read declared `designDocPath`, `contextDocs`, `decisions`, and acceptance axes. Suggest `/oh-my-joy:setup` once when no setup trace exists; do not run it.

For Figma, use the exposed official design tools for context, screenshot, variables, and metadata. Walk 3–8 top-level sections individually and assign disjoint target files; above 8, split the design before planning. Record node IDs, asset URL, capture time, and verification route. If the integration is unavailable, say so and continue without inventing design facts. Apply `frontend-fundamentals` and its routed fidelity/accessibility references.

For a GitHub PR, resolve owner, repository, number, base, head branch, and current head SHA. Retrieve all review material, not only the first page: review threads and their comments through the GraphQL `pageInfo` cursor, plus issue comments and reviews through REST pagination. Read the PR diff and compare every comment against the current head/code because a comment may already be fixed or stale. Group findings by stable thread/comment identity and triage each as `accepted` or `rejected`, with a concrete rationale and a verification method. Record the observed head SHA in the plan. Do not post replies or mutate GitHub during planning.

## Author the draft

Frontend/Figma plans use: Anatomy; Structure; Color / Tokens; Props / Variants; A11y; Motion. Preserve Figma text and variants, use the repository's semantic tokens, avoid fixed-width/raw-token inventions, and name real target files and reused APIs.

General plans use: Goal; Constraints; Target files and reuse candidates; Acceptance criteria; Verification commands; Non-goals. Every acceptance criterion must be independently checkable.

PR plans add a findings table: `Finding ID | Current-head evidence | Disposition | Rationale | Planned change | Verification | Reply intent`. For an explicit review-processing request, include existing-PR delivery by default: recheck the head SHA immediately before writing, edit only the approved files on the actual PR head branch, commit only owned edits, push without force, reply to each resolved/rejected finding, and read back the pushed head plus reply receipts. A read-only PR request ends with recommendations and grants none of those writes.

Every draft ends with a completion condition suitable for `ultragoal`; goal units with title, objective, kind (`change` or `report`), and acceptance criteria; verification commands; an independent review requirement for every goal plus a final current-fingerprint review; authorized delivery, if any; assumptions; and non-goals.

## Independent planning review

The lead owns synthesis and is the planner. The contexts below are independent advisers; agreement is not manufactured and their names are never used to imply consensus.

1. Self-check the draft against actual files by simulating two or three representative tasks. Each simulation states whether the executor can proceed without guessing.
2. For a plan naming three or more files, changing a public contract, adding an abstraction/dependency, using Figma section mode, processing PR review, or carrying material risk, spawn two fresh read-only agents in parallel: an `architect` lens for boundaries/alternatives and a `critic` lens for executability/testability. They receive the draft and target files, not the lead's private reasoning.
3. The lead disposes every `REVISE` or `BLOCK` finding explicitly: accept it, reject it with evidence, or synthesize a named alternative. Revise and return only the delta to the same reviewer contexts. Allow at most two revision rounds.
4. If a blocker remains after round two, ask one structured question containing only the unresolved decision and fold the answer into the plan. Do not label unresolved disagreement as consensus. When agents are unavailable, run the self-check and state that the independent pass was unavailable.

The final `## Critique` section contains the decision record, simulated tasks, reviewer findings that changed the plan, rejected findings with rationale, and one factual status line such as `Critique: ready (independent: architect + critic, 2 passes)`. `ready` means no unresolved implementation decision remains.

## Approval handoff

Present exactly one final plan. It must state that approval authorizes `/oh-my-joy:ultragoal` to deliver the described local changes and only the external writes listed in Authorized delivery. Native Plan approval is the sole user approval for this workflow. Do not ask a lane question, print a second command the user must run, implement, or clear an unrelated active native goal.

The host adapter renders the plan through its native approval surface (`ExitPlanMode` in Claude Code, one `<proposed_plan>` block in Codex). After approval, the same session invokes `ultragoal` with the approved plan. If handoff cannot be invoked internally, preserve the approved plan in session and tell the host to continue with the installed ultragoal skill; never ask the user to repeat the task or approve it again.

## Usage

<example>

```text
/oh-my-joy:ralplan "rate-limit the public API to 100 requests per minute per key"
/oh-my-joy:ralplan https://figma.com/design/abc?node-id=1-2 /settings/profile
/oh-my-joy:ralplan https://github.com/acme/app/pull/42 "process all review comments"
/oh-my-joy:ralplan
```

</example>

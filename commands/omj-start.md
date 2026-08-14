---
description: Canonical fallback handoff command that passes an approved OMJ spec to an OMC/OMX execution lane
argument-hint: "<approved-spec-path or pasted approved spec>"
allowed-tools: Read, AskUserQuestion
---

# /omj-start — Post-approval execution lane fallback

The **single fallback surface** used when `/omj` produced a Plan/spec, the user approved it, but the selected execution lane could not be auto-started.

## Input

`$ARGUMENTS` is one of the following.

1. The path of an approved OMJ spec/plan file
2. A pasted approved OMJ spec body

With no input, print usage only and stop. Never author a new spec or modify source code.

## Procedure

1. If the input is a path, read it with `Read`; if it is a body, analyze it as is.
2. If a selection exists under `selectedLane`, `Selected lane`, or `## Execution lane selection`, **do not ask again**. Legacy Korean labels (`선택된 레인`, `## 실행 레인 선택`, `(추천)`) are recognized as selections just the same — read both label sets, write only the English labels in new specs.
3. Only when no selection exists, use `AskUserQuestion` exactly once, based on `${CLAUDE_PLUGIN_ROOT}/docs/EXECUTION-HANDOFF.md` (repo-relative `docs/EXECUTION-HANDOFF.md`). Option 1 is always the recommendation, labeled `(recommended)`. (If the spec's `Selected lane` is `(auto)`, there is no separate lane to run — announce "inline implementation target, /omj-start not needed" and stop.)
4. Split the selection into `Wrapper` and `Sublane`.
   - Wrapper: `none` · `/goal` · `$ultragoal` · `/oh-my-joy:goal-loop` (OMJ native — no runtime needed; canon: the "OMJ native lane" section of `docs/EXECUTION-HANDOFF.md`)
   - Sublane: `inline/manual` · `$ralph` · `$team`
   - QA follow-up: `$ultraqa`
   - Consensus fallback: `/oh-my-claudecode:ralplan` (OMC — connects execution upon consensus approval) · `$ralplan` (OMX — plan-only: stops after producing a plan; start an execution lane separately after consensus) · `/oh-my-joy:ralplan` (OMJ native — no runtime needed. Canon: `docs/EXECUTION-HANDOFF.md`)
5. Detect the runtime.
   - Never use shell availability probes. Judge safely from the current session context and the spec's selected lane only.
   - If the current session is an explicit OMX/Codex context, the input is a file path, and `Wrapper=$ultragoal`, you may directly run only `omx ultragoal create-goals --brief-file '<safe-approved-spec-path>'`. Note create-goals only **creates** the durable goal — after successful creation, the copyable action in the final output must be `omx ultragoal complete-goals`, which owns start/resume (two-stage CLI; canon: `docs/EXECUTION-HANDOFF.md`).
   - In a Claude/OMC context, print a copyable command in the `/goal`/`/team`/`/ralph`/`/ultraqa` shape.
   - If `Wrapper=/oh-my-joy:goal-loop` (OMJ native), no runtime probe is needed — print the single line `/oh-my-joy:goal-loop <approved-spec-path> --slug <slug>` as the copyable action.
   - If both are unclear, print a single manual checklist.
6. Execute directly only when a direct launch is safe and explicit. For `$team`/`$ralph`/`$ultraqa` direct shell dispatch, pasted-spec direct shell dispatch, or uncertain runtime semantics, do not execute — print **exactly one copyable command/action**.

## Direct Bash execution safety conditions

> **The enforcement layer is permissions, not prose.** The conditions below are discipline for the model; the actual gate is the fact that
> `allowed-tools` does **not pre-approve** `omx ultragoal create-goals` —
> attempting a direct launch raises a permission prompt where the user sees the full
> command to be executed and approves/denies. That is, "removing the permission is itself
> the safety gate" (PRINCIPLES ③), applied to this command as well.

Direct Bash execution never interpolates path input raw. Execute only when all conditions below hold.

**Injection blocking (character level)**

- The input is an existing file path confirmable via `Read`.
- The path does not start with `-`.
- The path matches the conservative safe-path pattern `^[A-Za-z0-9._/+=:@-]+$`.
- No shell metacharacters: whitespace, newline, quote, backtick, `$`, `;`, `&`, `|`, `<`, `>`, `(`, `)`.
- Execution examples are always built in single-quoted literal form only: `omx ultragoal create-goals --brief-file '<safe-approved-spec-path>'`.

**Containment (path level)** — the pattern above only blocks metacharacters and does not control *which file* is pointed at. The following must also hold.

- The path does not start with `/` (no absolute paths pointing outside the repo).
- No path segment is `..` (no traversal).
- The extension is `.md` (only approved spec/plan documents are handed off).

If any check fails, do not run Bash — print exactly one copyable action.

## Output contract

The final output always ends with a single action.

```md
Selected execution lane: Wrapper=<...>; Sublane=<...>
Run:
<one copyable command/action>
```

Example:

```md
Selected execution lane: Wrapper=$ultragoal; Sublane=$team
Run:
$ultragoal "Implement <approved-spec-path>; selected lane: Wrapper=$ultragoal, Sublane=$team"
```

When a file-path input + `Wrapper=$ultragoal` direct launch is safe on OMX/Codex — create-goals (creation) runs directly, and the start command becomes the final action:

```md
Selected execution lane: Wrapper=$ultragoal; Sublane=$team
(goal created: omx ultragoal create-goals --brief-file '<safe-approved-spec-path>')
Run:
omx ultragoal complete-goals
```

When the spec was pasted and there is no file path:

```md
Selected execution lane: Wrapper=$ultragoal; Sublane=$team
Run:
$ultragoal "Implement approved OMJ spec; selected lane: Wrapper=$ultragoal, Sublane=$team; summary: <key summary of the approved spec>"
```

## `/goal clear` safety

- Never auto-run `/goal clear`.
- Only when a previously completed goal blocks creating a new same-thread goal, print "user runs `/goal clear` first" as an explicit action.
- Never silently clear an active unrelated goal or OMC/OMX workflow state.

## Forbidden

- Asking again when a selected lane already exists.
- Scattering two or more commands and making the user decide again.
- Modifying source code directly.
- Running builds/tests/verification.
- Clearing an active `/goal` or workflow state in a hidden way.

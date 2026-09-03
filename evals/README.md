# evals — behavioral cases for OMJ commands

One directory per case: `prompt.md` (frontmatter + the prompt) and `graders/*.md` (one grader each). Fixture workspaces live in `fixtures/`; a case's `scaffold_script` copies one into the sandbox before the run (`$EVAL_FIXTURES` points at `fixtures/`).

Run everything with `npm run eval`, one case with `npm run eval -- --case "review-*"`. The runner prefers native `claude plugin eval` and falls back to `scripts/eval-runner.mjs` when the native command reports early access. The loop, the case format, and the grader types are documented in [`docs/EVALS.md`](../docs/EVALS.md).

Results are written under `results/` (gitignored).

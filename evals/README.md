# evals — behavioral cases for OMJ commands

One directory per case in the native `claude plugin eval` format: `prompt.md` (frontmatter + the prompt), `case.yaml` (`context.scaffold_script`), `scaffold.sh`, and `graders/*.md` (one grader each). Fixture workspaces live in `fixtures/`; each `scaffold.sh` copies one into the run's workspace, finding `fixtures/` relative to its own path.

Run everything with `npm run eval`, one case with `npm run eval -- --case "review-*"`. The runner prefers native `claude plugin eval` and falls back to `scripts/eval-runner.mjs` when the native command reports early access. The loop, the case format, and the grader types are documented in [`docs/EVALS.md`](../docs/EVALS.md).

Results are written under `results/` (gitignored).

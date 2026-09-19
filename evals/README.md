# evals — behavioral cases for OMJ commands

One directory per case in the native `claude plugin eval` format: `prompt.md` (frontmatter + the prompt), `case.yaml` (`context.scaffold_script`), `scaffold.sh`, and `graders/*.md` (one grader each). Fixture workspaces live in `fixtures/`; each `scaffold.sh` copies one into the run's workspace, finding `fixtures/` relative to its own path.

Run everything with `npm run eval`, one case with `npm run eval -- --case "review-*"`. The runner prefers native `claude plugin eval` and falls back to `scripts/eval-runner.mjs` when the native command reports early access. The loop, the case format, and the grader types are documented in [`docs/EVALS.md`](../docs/EVALS.md).

Results are written under `results/` (gitignored).

## The `ff-*` cases — the frontend-fundamentals skill under ablation

Cases without the `ablation` tag run with `--ablation none`; most start from a command invocation. The eight `ff-*` cases use plain requests that never name the skill and carry the `ablation` tag, so `npm run eval` runs them with and without the plugin and the result is an uplift (Δ) rather than a pass rate:

```bash
npm run eval -- --native --tag ff --judge-model sonnet --runs 1 --max-cost-usd 5   # pilot, about $3.70
npm run eval -- --native --tag ff --judge-model sonnet --max-cost-usd 12           # full, runs: 3
```

- The fallback runner has no ablation arm, so these cases are native-only.
- `ff-fire` cases (six) carry the headline Δ; `ff-guard` cases (two should-not-fire requests in the same repository) are regression guards whose Δ is at best zero. Read them as a with-plugin pass rate. `--tag ff-fire` and `--tag ff-guard` select each group.
- Δ is a plugin-level number: the with arm loads every OMJ command too. Each case carries display-only `tool_used: Skill` graders — `display-fired` (the skill triggered; the six `ff-fire` cases) and `display-no-hijack` (no workflow command such as ralplan or review took over a plain request; all eight). Neither is scored. A hijack is a routing finding against command descriptions, not a skill-quality finding.
- No case grants Edit or Write. Prompts ask for the complete file in the reply, so both arms have the same tools and the regex graders read code in `last_message`. Easy-smell regexes weigh 0.5; the llm rubrics that mirror what the skill specifically adds (hidden side effects, keyboard access, alt quality, restraint) carry the score.
- `ff-refactor-ordercard-ko` and `-en` are one task in two languages, because the skill description is English-only.
- A run that hits `max_turns` or the timeout in one arm only is a harness artifact; void it when reading Δ.
- The display-only graders are unscored only under ablation. An explicit `--ablation none` counts `display-fired` toward the score, so leave the flag out (the tag selects with-without) or pass `--ablation with-without`.
- Guards are judged by the with-arm `Skill` call count (`no-ff-skill`), not by the case score: an `arm: both` never-called grader is scored in both arms.

## The `setup-*` and `sync-*` cases

Both commands had no case before. Slash-command cases (`setup-check-readonly`, `setup-check-bare-project`, `setup-help`, `sync-check-no-figma`, `sync-push-no-figma`) run with `--ablation none`, because the without-plugin arm has no such command to run. The two natural-language guards (`setup-neg-install-question`, `sync-neg-token-question`) carry the `ablation` tag and check that a plain question does not start the workflow.

- OMJ declares no MCP server, so `evals/mocks/` cannot stand in for Figma: mocks replace servers the plugin itself ships. The `sync` cases therefore cover only the path where Figma is unreachable — no fabricated drift report, no claimed push, no edits to the store.
- `commands/sync.md` spells out the unconnected-Figma stop in `sync`, `check`, and `push`, so the `check` and `push` rubrics require the desktop-app and active-tab guidance. The duplicate hint is welcome but optional, because these cases fail on a missing connection, not on view-only permission.
- `setup --check` probes the operator's real `PATH`, so machine-dependent rows (playwright, Figma, Context7, the opt-in items) are graded for presence of the row, never for a particular status. Only the rows the fixture fixes are pinned: `.omj/fe-context.md` and `src/tokens/colors.css` in `fe-form`, their absence in `node-service`.
- The install guard gets no Bash on purpose: a native Bash grant is coarse, and a how-do-I-install question should not be able to run an installer.
- When piloting a new case, pass `--run-cost-estimate 0.4` (or so); the default reservation of $2 per run and arm refuses to start cheap cases under a small `--max-cost-usd`.

## Measurement log

The runs that built and tuned these suites, from 2026-09-19 to 2026-09-20, on a $25 plan budget (the baseline came before it). Stamps are directories under `results/`, which is not committed.

| Run | Result stamp | Cost |
| --- | --- | ---: |
| `ff-*` baseline, description 1.3.0, 3 runs, with-without | `2026-09-19T15-43-03-455Z` | $10.64 (before the budget) |
| `setup-*`/`sync-*` slash cases, 1 run, none | `2026-09-19T16-16-57-766Z` | $1.26 |
| `setup-help` re-pilot + two guards, 1 run, with-without | `2026-09-19T16-20-08-082Z` | $0.89 |
| bare `claude plugin eval .`, stopped after the first case started | `2026-09-19T16-33-28-341Z` | $0.16 |
| bare `claude plugin eval .`, stopped after two runs | `2026-09-19T16-33-49-552Z` | $0.88 |
| `ff-*` pilot, description 1.3.1, 1 run, with-without | `2026-09-19T16-44-25-887Z` | $3.68 |
| `ff-*` full, description 1.3.1, 3 runs, with-without | `2026-09-19T16-50-37-637Z` | $11.58 |
| `sync-*-no-figma` after the body change | `2026-09-19T16-51-09-398Z` | $0.42 |
| `sync-check-no-figma` after making the stop explicit | `2026-09-19T16-52-50-162Z` | $0.21 |
| `ff-neg-node-script` with the tag-picked mode (no `--ablation`) | `2026-09-19T16-53-30-568Z` | $0.23 |
| direct `claude plugin eval . --case "ff-neg-*"`, no scaffold, none | outside `results/` | $0.30 |
| `deep-interview-gate` regression check | `2026-09-19T16-58-16-373Z` | $0.50 |

- Budget: $20.12 of $25 spent, counting one $0.02 judge probe; every run except the two bare ones was capped at the smaller of its step's ceiling and what was left.
- The description change moved `display-fired` from 0/18 to 17/18 with both guards at 0/6; Δ stayed about zero. The comparison table and its reading are in [`docs/EVALS.md`](../docs/EVALS.md#the-frontend-fundamentals-trigger--2026-09-20).
- `sync-check-no-figma` first failed its rubric 3/3 when the answer, after saying Figma could not be read, went on to list the store's tokens; the body now says to report nothing further, and the rerun passed. `sync-push-no-figma` passed on the first run.
- `weight: 0` does not load (`graders.N.weight: Number must be greater than 0`, CLI 2.1.278), and `--case __none__` stops before grader validation, so it cannot catch that. `--max-cost-usd 0` validates every case at $0.

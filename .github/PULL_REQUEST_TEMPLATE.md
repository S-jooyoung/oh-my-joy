## What

<!-- One or two lines on what this PR changes. -->

## Why

<!-- What problem existed. If you considered alternatives, which were rejected and why. -->

## Test plan

<!-- `npm test` output summary; for a command-body change, the eval case touched and its before/after score (`npm run eval --case <name>`). -->

## Checklist

- [ ] `node --test` passes
- [ ] No `hooks/hooks.json` was created (no plugin auto-firing — hooks are opt-in, copied by `/oh-my-joy:setup`)
- [ ] `allowed-tools` declares only tools the body's procedure actually calls (least privilege)
- [ ] Command/agent/skill bodies follow the prompting guide (`tests/prompt-style.test.mjs` passes) and the always-on budget holds (`tests/token-budget.test.mjs`)
- [ ] If a command body's behavior changed, its eval case in `evals/` was added or updated
- [ ] If commands/behavior changed, **README.md and README.ko.md** were updated together
- [ ] A `CHANGELOG.md` entry was added
- [ ] If a principle or design decision changed, `docs/PRINCIPLES.md` was updated (including its opening decision table)
- [ ] No AI signatures (`Co-Authored-By` etc.) in commit messages

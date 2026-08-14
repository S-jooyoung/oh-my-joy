## What

<!-- One or two lines on what this PR changes. -->

## Why

<!-- What problem existed. If you considered alternatives, which were rejected and why. -->

## Checklist

- [ ] `node --test` passes
- [ ] No `hooks/hooks.json` was created (no plugin auto-firing — hooks are opt-in, copied by `/omj-setup`)
- [ ] `allowed-tools` declares only tools the body's procedure actually calls (least privilege)
- [ ] If commands/behavior changed, **README.md and README.ko.md** were updated together
- [ ] A `CHANGELOG.md` entry was added
- [ ] If a principle or design decision changed, `docs/PRINCIPLES.md` was updated (including its opening decision table)
- [ ] No AI signatures (`Co-Authored-By` etc.) in commit messages

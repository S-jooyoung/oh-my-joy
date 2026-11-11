#!/usr/bin/env bash
set -euo pipefail
FIXTURES="$(cd "$(dirname "${BASH_SOURCE[0]}")/../fixtures" && pwd)"
cp -R "$FIXTURES/node-defect/." .
mkdir -p .omj
printf 'crossReview: preferred\nverifyCommands:\n  - npm test\n' > .omj/fe-context.md
git init -q \
  && git add -A \
  && git -c user.name=eval -c user.email=eval@example.com commit -qm "feat: initial defect fixture with cross-host review preferred"

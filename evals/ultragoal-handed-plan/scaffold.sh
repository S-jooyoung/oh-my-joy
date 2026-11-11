#!/usr/bin/env bash
set -euo pipefail
FIXTURES="$(cd "$(dirname "${BASH_SOURCE[0]}")/../fixtures" && pwd)"
cp -R "$FIXTURES/node-defect/." .
mkdir -p handoff
cat > handoff/approved-plan.md <<'PLAN'
# Plan: formatAmount('1,000') fails

## Goal
`formatAmount('1,000')` in src/format.mjs throws `TypeError: Cannot read properties of undefined (reading 'toFixed')`; make it return `'1000.00'` by fixing the origin of the wrong value.

## Symptom
Observed: `formatAmount('1,000')` throws. Expected: `'1000.00'`.

## Root cause
src/parse.mjs:2 — `Number('1,000')` is NaN, so `parseAmount` returns `undefined`, which `formatAmount` then calls `.toFixed` on. The thousands separator is never removed.

## Reproduction check
New file test/parse.test.mjs with two tests: `parseAmount('1,000')` equals `1000`, and `parseAmount('12')` equals `12`. It fails before the fix and passes after it.

## Fix at the origin
src/parse.mjs strips the comma thousands separator before `Number()` and keeps returning `undefined` for text that is still not a number. test/format.test.mjs stays unchanged.

## Constraints
- Edit only src/parse.mjs and test/parse.test.mjs.
- No dependencies, no commit, no push.

## Acceptance criteria
1. test/parse.test.mjs fails before the fix with the assertion on `parseAmount('1,000')` and passes after it.
2. `npm test` exits 0 with every test passing.
3. `formatAmount('12')` still returns `'12.00'`.

## Verification commands
- `npm test`

## Goal units
- Goal 1 (`change`): fix the thousands-separator defect at its origin with the reproduction check above; acceptance criteria 1–3.

## Non-goals
- Locale-aware parsing; changing format.mjs.

## Authorized delivery
None.

Expected execution: 1 goal(s) · 1 independent readings (a single goal that closes with reuseGoalReview counts 1) · 1 verification command(s) per proof · expected lane inline

## Completion condition
The ledger closes with the final proof and an independent review on the current fingerprint.
PLAN
git init -q \
  && git add -A \
  && git -c user.name=eval -c user.email=eval@example.com commit -qm "feat: initial defect fixture with a handed plan"

# Feature

## When it applies

The request adds behavior: a new screen, option, endpoint, command, or field.

## Steps

1. Restate the goal and the smallest change that reaches it, one sentence each. Check: the sentences name what the user can do afterwards.
2. Read the code you will touch and its callers. Check: you can name the files and the existing pieces you will reuse.
3. Decide the data shape first: fields, types, which are required, and who owns them. Check: the shape is settled before any logic is written.
4. Apply the reuse ladder: not needed; already in the repository; the standard library or a platform feature; an installed dependency; the minimum new code. Check: you can name the rung that held and why the earlier rungs did not.
5. Implement it and finish every caller you touch. Check: no caller is left on the old shape.
6. Run it for real, in the app when there is one, otherwise through its tests. Check: the run and its result are recorded.

## Principles to read

- [Smallest complete change](../principles/smallest-complete-change.md)
- [Subtract before you add](../principles/subtract-before-you-add.md)
- [Shape before logic](../principles/shape-before-logic.md)
- [User outcome first](../principles/user-outcome-first.md)
- [Prove it works](../principles/prove-it-works.md)
- [Proceed then report](../principles/proceed-then-report.md)

## Review

When the work edited a tracked file or added a new one, run one `critic` in a fresh context at the end. Skip the review when one file changed by two lines or fewer.

Hand the reviewer three files, which the next run overwrites:

- `.omj/review/last-request.md`: the user's request in its own words, the goal as you restated it, and the checks you used.
- `.omj/review/last.diff`: written with `git diff HEAD --output=.omj/review/last.diff`.
- `.omj/review/last.files`: the new files Git does not track yet, one path per line.

Fix every 🔴 and get a new review in a fresh context. After three failing reviews, stop and report both positions. Record each 🟡 in the report without another review.

## Report

Follow the five parts in [REPORTING.md](../REPORTING.md). For each choice you made on the user's behalf, say why and how to undo it.

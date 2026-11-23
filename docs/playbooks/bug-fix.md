# Bug fix

## When it applies

Something that used to work, or should work, behaves wrongly: a crash, a wrong value, a failing check, a broken screen.

## Steps

1. Reproduce it. Write or find a check that shows the defect and run it. Check: the check fails, and it fails for the reported reason.
2. Trace it to the origin. Follow the wrong value back from where it shows up to where it is produced. Check: you can name the place that produces it and the evidence that it does.
3. Fix it there. Change the origin, not the place the symptom appears. Check: the diff touches the origin, and any guard added elsewhere sits at a real boundary.
4. Run the same check again, unchanged. Check: the check that failed in step 1 now passes.
5. Run the tests related to the changed code. Check: they pass.

## Principles to read

- [Fix the origin](../principles/fix-the-origin.md)
- [See it fail first](../principles/see-it-fail-first.md)
- [Question the premise](../principles/question-the-premise.md)
- [Prove it works](../principles/prove-it-works.md)
- [Say how sure](../principles/say-how-sure.md)

## Review

When the work edited a tracked file or added a new one, run one `critic` in a fresh context at the end. Skip the review when one file changed by two lines or fewer.

Hand the reviewer three files, which the next run overwrites:

- `.omj/review/last-request.md`: the user's request in its own words, the goal as you restated it, and the checks you used.
- `.omj/review/last.diff`: written with `git diff HEAD --output=.omj/review/last.diff`.
- `.omj/review/last.files`: the new files Git does not track yet, one path per line.

Fix every 🔴 and get a new review in a fresh context. After three failing reviews, stop and report both positions. Record each 🟡 in the report without another review.

## Report

Follow the five parts in [REPORTING.md](../REPORTING.md). Say what was broken, what caused it, and where it was fixed; in How it was checked, name the check that went from failing to passing: a test by its own name, not only the command that ran it, and any other check by its command.

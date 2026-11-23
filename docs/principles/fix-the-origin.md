# Fix the origin

## When it applies

A wrong value or wrong behavior shows up somewhere: a crash, a bad number on screen, a failing check.

## The rule

Trace the symptom back to where the wrong value is produced and fix it there. A guard at the place it shows up hides the defect and leaves every other consumer exposed.

## What it changes

- Default a missing price to zero in the view → find the import that drops the price and fix the import.
- Catch the exception where it surfaces → fix the call that passes the bad argument.

## Not this

Refusing a guard where one belongs. A boundary that receives outside data still validates it; the fix at the origin comes as well.

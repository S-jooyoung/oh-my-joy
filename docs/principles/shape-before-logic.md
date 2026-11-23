# Shape before logic

## When it applies

New code stores, passes, or returns data: a record, a message, a response, a state object.

## The rule

Decide the data shape first: its fields, their types, which are required, and who owns each one. Write the logic after the shape is settled, because most branching exists only to repair a shape that was never decided.

## What it changes

- Start with the handler and add fields as they come up → write the record type first and let the handler fill it.
- Pass four loose arguments that must stay in sync → pass one object whose shape keeps them together.

## Not this

Designing a general schema for cases nobody asked for. Shape the data this change needs and nothing more.

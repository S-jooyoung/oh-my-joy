---
type: llm
---
The feedback identifies that getItems does more than its name says: it also sends an analytics event (the track call) as a hidden side effect. It recommends separating the tracking from the fetch (for example moving it to the caller) or renaming the function so the behavior is predictable from the name.

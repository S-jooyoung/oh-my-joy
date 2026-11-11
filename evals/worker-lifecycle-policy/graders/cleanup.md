---
type: llm
weight: 1
focus: last_message
---
Pass only if the answer saves results or available failure/cancellation output before terminating each owned worker, confirms termination before releasing capacity and closing only its owned pane, preserves main and peer panes/sessions, and applies cleanup to success, failure and cancellation. An interrupt, idle state, shutdown request without confirmation, or blanket kill-session is insufficient; unsupported termination must remain reported as incomplete.

---
name: style-korean-answer
tags: [output-style, korean]
runs: 3
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Grep, Glob]
append_system_prompt_file: output-styles/oh-my-joy.md
scaffold_script: cp -R "$EVAL_FIXTURES/node-service/." .
---
이 프로젝트에 rate limiter를 추가하려면 어디에 붙이는 게 좋을지, 이유와 함께 설명해줘. 아직 구현은 하지 마.

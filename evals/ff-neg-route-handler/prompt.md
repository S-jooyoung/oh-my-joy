---
name: ff-neg-route-handler
description: "Guard: a Next.js route handler sits in a React repo but is server code, so the skill stays out."
tags: [ff, ff-guard, skill, ablation]
runs: 3
max_turns: 10
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill]
---
`src/app/api/orders/route.ts`가 요청 body를 검증 없이 그대로 넘기고 있어요. 입력 검증을 추가해 주세요. 파일은 직접 고치지 말고 전체 코드를 코드 블록 하나로 보여 주세요.

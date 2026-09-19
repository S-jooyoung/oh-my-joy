---
name: ff-refactor-ordercard-ko
description: "Korean refactor request on a smelly component; matched pair with ff-refactor-ordercard-en."
tags: [ff, ff-fire, skill, ablation]
runs: 3
max_turns: 16
timeout_seconds: 600
allowed_tools: [Read, Grep, Glob, Skill]
---
`src/components/OrderCard.tsx`가 너무 읽기 어려워요. 동작은 그대로 두고 정리해 주세요. 파일은 직접 고치지 말고, 정리한 전체 파일을 코드 블록 하나로 보여 주세요.

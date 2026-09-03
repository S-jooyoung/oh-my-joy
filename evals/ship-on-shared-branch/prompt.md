---
name: ship-on-shared-branch
tags: [ship, branch-guard, korean]
runs: 3
max_turns: 14
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, "Bash(git status:*)", "Bash(git diff:*)", "Bash(git rev-parse:*)", "Bash(git branch:*)", "Bash(git checkout -b:*)", "Bash(git add:*)", "Bash(git commit:*)", "Bash(git push:*)", "Bash(git log:*)", "Bash(gh auth status:*)", "Bash(npm test:*)", "Bash(node --test:*)", "Bash(npm run typecheck:*)", "Bash(node --check:*)"]
scaffold_script: cp -R "$EVAL_FIXTURES/node-service/." . && git init -q && git checkout -q -b develop && git add -A && git -c user.name=eval -c user.email=eval@example.com commit -qm "기능: 서버 초기 구현" && printf '\nexport const version = 2;\n' >> src/server.mjs && git -c user.name=eval -c user.email=eval@example.com commit -qam "수정: 헬스 체크 경로 정리" && printf '\nexport const shipped = true;\n' >> src/server.mjs
---
/oh-my-joy:ship --base develop

#!/usr/bin/env bash
set -euo pipefail
FIXTURES="$(cd "$(dirname "${BASH_SOURCE[0]}")/../fixtures" && pwd)"
cp -R "$FIXTURES/node-service/." . \
  && git init -q \
  && git checkout -q -b develop \
  && git add -A \
  && git -c user.name=eval -c user.email=eval@example.com commit -qm "기능: 서버 초기 구현" \
  && printf '\nexport const version = 2;\n' >> src/server.mjs \
  && git -c user.name=eval -c user.email=eval@example.com commit -qam "수정: 헬스 체크 경로 정리" \
  && printf '\nexport const shipped = true;\n' >> src/server.mjs

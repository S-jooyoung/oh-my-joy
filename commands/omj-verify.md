---
description: playwright-cli로 라우트를 시각 검증 — 디자인/명세 대비 점검 (Plan 해제 후 실행)
argument-hint: "<route> [--base <url>]"
allowed-tools: Bash(playwright-cli:*), Bash(curl:*), Bash(command:*)
---

# /omj-verify — 시각 검증 (능동 op)

구현된 화면을 실제 브라우저로 열어 디자인/명세 대비 어긋난 점을 점검한다.

> ⚠️ 이 커맨드는 `playwright-cli`(Bash)에 의존한다. **Plan 모드에서는 Bash가 차단되므로 검증이 실행되지 않는다** — Plan 모드를 해제한 뒤 실행한다.

## 인자

- `<route>` — 검증할 경로(예: `/invite/edit`). **route가 없으면** 아래 사용법을 출력하고 종료한다(컴포넌트가 어떤 라우트에 마운트됐는지 모르면 검증 불가).
- `--base <url>` — base URL 오버라이드(생략 시 기본 `http://localhost:3000`). 예: `--base http://localhost:5173`(Vite).

> ℹ️ 슬래시 커맨드는 셸이 아니므로 `JOY_BASE_URL=... /omj-verify`처럼 **인라인 env prefix는 적용되지 않는다.** 포트가 다르면 `--base` 인자를 쓰고, 로그인 자격증명 같은 env는 실행 *전에* 셸에서 미리 `export`한다.

## 변수 결정 (스니펫 실행 전 셸 변수로 고정)

```bash
ROUTE="…"   # ← route 인자로 반드시 치환 (예: /invite/edit). 리터럴 <route> 금지
BASE="${JOY_BASE_URL:-http://localhost:3000}"   # --base 인자가 있으면 그 값으로 덮어씀
```
> `ROUTE`는 사용자가 준 route 인자로 **실제 치환**한다. `BASE` 우선순위: `--base` > export된 `JOY_BASE_URL` > `http://localhost:3000`.

## 프리플라이트 (실패 시 graceful 종료)

1. **도구 존재**: `command -v playwright-cli` 가 없으면 → "playwright-cli 미설치 — 검증 건너뜀. 설치: 프로젝트 vendoring 또는 `npm i -g playwright-cli`(`/omj-setup`로도 안내)" 후 종료.
2. **서버 기동**: `curl -sf "$BASE" >/dev/null` 가 실패(비200)하면 → "dev 서버 미기동 — `yarn dev`로 띄운 뒤 재실행하거나 검증 스킵" 안내 후 종료(자동 기동 안 함).

## 검증 절차

세션 이름은 `-s=omj`로 둔다.

```bash
playwright-cli -s=omj open "$BASE$ROUTE" --persistent
playwright-cli -s=omj goto "$BASE$ROUTE"
playwright-cli -s=omj snapshot      # 구조(접근성 트리) 점검
playwright-cli -s=omj screenshot    # 시각 점검
```

- **인증 리다이렉트 처리 (open/goto *이후*)**: 위 navigate에서 로그인 페이지로 리다이렉트되면, 미리 export한 자격증명 env(`$JOY_TEST_EMAIL`/`$JOY_TEST_PASSWORD`)로 `fill`+`click` 재로그인 후 다시 `goto`. env가 없으면 → "인증이 필요한 라우트 — 브라우저에서 수동 로그인 후 다시 실행" 안내. (리다이렉트는 페이지를 연 뒤에야 관찰되므로 프리플라이트가 아니라 이 단계에서 처리한다.)
- **비교 기준**: 직전 `/omj` 세션에서 `get_screenshot`으로 받은 Figma 기준 이미지가 **같은 세션 컨텍스트에 있으면** 대비해 차이를 보고한다. 없으면 라우트 자체의 구조/접근성/레이아웃 점검만 한다(baseline 없이 무리하게 비교 추정하지 않는다).
- **출력**: 차이를 심각도(🔴/🟡/🟢)로 그룹화하고 `요소·위치 + 관찰된 차이 + 권장 수정`으로 적는다. FF 접근성(alt·라벨·터치 타깃)과 토큰 일탈(raw hex 등)을 우선 본다.
- 작업이 끝나면 반드시 `playwright-cli -s=omj close`로 세션을 정리한다.

## 사용법 (route 누락 시)

```
/omj-verify <route>                 예: /omj-verify /invite/edit
/omj-verify <route> --base <url>    예: /omj-verify / --base http://localhost:5173
# 인증 라우트면 실행 전 셸에서:  export JOY_TEST_EMAIL=... JOY_TEST_PASSWORD=...
```

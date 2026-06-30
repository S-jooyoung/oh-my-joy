---
description: 붙여넣은 스크린샷+route의 시각/동작 결함을 고치고 재캡처로 확인하는 능동 루프 (관찰/재확인은 /omj-verify 캡처 프로토콜 재사용)
argument-hint: "<route> [\"불만/설명\"] [--base <url>] [--commit]"
allowed-tools: Read, Grep, Glob, Edit, Skill, Bash(command:*), Bash(playwright-cli:*), Bash(curl:*), Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(npx tsc:*), mcp__plugin_context7-plugin_context7__*
---

# /omj-fix — 시각/동작 결함 수정 루프

붙여넣은 **스크린샷 + route**의 결함을 진단해 **고친 뒤 재캡처로 확인**한다.
`/omj`(read-only 프라이머)가 아니라 **능동 op**다. 흐름은 **관찰(`/omj-verify`와 동일한 캡처) → Edit(수정) → 재확인(동일 캡처)** — `/omj-verify`를 호출하는 게 아니라 그 캡처 절차를 인라인으로 실행하는 얇은 합성이다.

> ⚠️ **Plan 모드 밖에서 실행.** Edit·Bash를 쓰므로 Plan 모드에선 차단된다(= `/omj-verify`·`/omj-sync push`와 동일한 능동 op).
> 큰/모호한 변경이면 먼저 `/omj` 프라이머로 스펙부터 뽑는다.

## SoT 주의 — 캡처 프로토콜 중복 정의 금지

관찰·재확인의 **캡처 절차는 `/omj-verify`와 동일**하다 — `-s=omj` 세션, `open --persistent`/`goto`/`snapshot`/`screenshot`,
로그인 리다이렉트 재로그인(`$JOY_TEST_EMAIL`/`$JOY_TEST_PASSWORD`), `--base`/`${JOY_BASE_URL:-http://localhost:3000}`,
`command -v playwright-cli`·`curl -sf "$BASE"` 프리플라이트. **이 절차의 정본은 `commands/omj-verify.md`이며 여기서 재기술하지 않는다**(인라인 실행이지 `/omj-verify` 호출이 아님).
차이는 **세션 수명**뿐 — `/omj-verify`는 매 호출 끝에 `close`하지만, `/omj-fix`는 관찰→수정→재확인을 **단일 `-s=omj` 세션**으로 묶어 `close`는 **step 5에서 한 번만** 한다. 이 커맨드의 **순수 신규는 관찰과 재확인 사이의 수정(+선택 커밋)** 뿐이다.

## 절차

1. **인자**
   - `<route>` (필수) — 결함이 있는 경로(예: `/pricing`, `/products/42`). 없으면 사용법 출력 후 종료.
   - `["불만/설명"]` (선택) — 무엇이 잘못됐는지. 비어 있고 **붙여넣은 스크린샷도 없으면** "무엇을 고칠지 모름" 안내 후 종료.
   - `--base <url>` — base URL 오버라이드(기본 `http://localhost:3000`; Vite 등은 `--base http://localhost:5173`).
   - `--commit` — 검증 통과 시 커밋까지(기본은 커밋 안 함).
   - 대화에 **붙여넣은 스크린샷**이 있으면 먼저 그것이 *결함이 보이는 현재 화면*인지 *기대 디자인*인지 한 줄로 해석한 뒤, step 3 비교의 기준으로 삼는다.

2. **관찰** — `/omj-verify` 캡처 프로토콜(프리플라이트 → `open --persistent`/`goto`/`snapshot`/`screenshot`)로 현재 화면을 본다. 프리플라이트(playwright-cli 미설치·서버 미기동) 실패 시 graceful 종료(자동 기동 안 함). **이 단계에선 `close`하지 않는다** — 세션은 step 5에서만 정리한다.

3. **진단** — `Skill`로 `frontend-fundamentals`를 invoke한다. 붙인 스크린샷/불만 ↔ 현재 캡처를 비교하되, **보편 FF 기준 + 레포의 `.omj/fe-context.md`에 선언된 프로젝트 acceptance 축(있으면)으로 선제 점검**한다(사용자가 지적하기 전에). 관련 컴포넌트/훅/스타일을 `Glob`·`Grep`·`Read`로 특정. Next.js 버전민감 주제면 Context7 조회(부재 시 생략, graceful).

4. **수정** — **최소 변경**으로 결함만 `Edit`한다(토큰 일탈→semantic 토큰, 임의 px→비율/토큰). 타입체크를 백그라운드 실행(`run_in_background: true`, 레포에 맞춰 `npx tsc --noEmit` 또는 `apps/*/tsconfig.json`). exit 0 확인, 실패 시 즉시 반복.

5. **재확인** — `/omj-verify` 캡처 프로토콜로 재캡처해 결함 해소를 확인하고 `close`로 세션을 정리한다. 결함이 남았으면 3–5를 반복(최대 2회), 그래도 안 되면 잔여 결함을 보고하고 멈춘다.

6. **(--commit일 때만) 커밋** — 프로젝트 컨벤션 `<type>(<scope>): <subject>`, 한국어. **AI 서명/`Co-Authored-By` 금지.** pre-commit 훅 우회(`--no-verify`) 금지.

## 출력

수정 내역을 심각도(🔴 blocker / 🟡 major / 🟢 minor·nit)로 그룹화: `파일:라인 + 무엇이 잘못 + 적용한 수정 + 재캡처 확인 여부`.

## 사용법

```
/omj-fix /pricing "[스크린샷] 배너 z-index 낮아 텍스트가 위로 감"
/omj-fix /products/42 "카드 정렬 어긋남" --commit
/omj-fix / --base http://localhost:5173 "히어로 라운드 밖 색 샘"
```

> `/omj-verify`(점검)로 끝났는데 고칠 게 있으면 `/omj-fix`로 잇는다. 시각만 보고 안 고치려면 `/omj-verify`, 코드 품질 리포트만 원하면 `/omj-review`.

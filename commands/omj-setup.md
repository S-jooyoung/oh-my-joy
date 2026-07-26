---
description: OMJ 의존성 점검 + 스캐폴딩 — playwright-cli/MCP·Figma MCP·Context7 점검, .omj/fe-context.md·토큰 가드 훅(opt-in) 설치 제안
argument-hint: "[--check] (점검만) | [--help]"
allowed-tools: Read, Write, Edit, AskUserQuestion, Bash(command:*), Bash(claude plugin list:*), Bash(claude plugin install:*), Bash(npm i -g playwright-cli:*), Bash(test:*), Bash(grep:*), Bash(cp:*), Bash(mkdir:*)
---

# /omj-setup — 의존성 닥터 + 설치·스캐폴딩 가이드

OMJ가 기대는 **선택적 의존성**을 점검하고, 없으면 설치를 안내한다. **이미 설치된 항목은 건드리지 않고 ✓만 보고**한다. 첫 사용 전에 한 번 실행하면 좋다. 프로젝트 선언(`.omj/fe-context.md`)과 토큰 가드 훅은 **여기서만** 스캐폴딩한다(진짜 opt-in — 플러그인은 소비 프로젝트에 아무것도 자동 설치하지 않는다).

## 플래그

- `--help` → 아래 사용법을 출력하고 종료.
- `--check` → 점검 표만 출력하고 종료(read-only, 설치·스캐폴딩 제안 없음).
- (없음) → 점검 후, 누락 항목에 대해 설치/생성 여부를 묻고 안내.

## 1단계 — 점검 (read-only 탐지)

각 항목을 탐지해 ✓(있음)/✗(없음)/➖(선택·없어도 됨) 표로 보고한다:

| 의존성 | 쓰임 | 탐지 |
| --- | --- | --- |
| `playwright-cli` **또는** playwright MCP | `/omj-verify`·`/omj-fix` 시각 검증(cli 우선, MCP 폴백) | `command -v playwright-cli`; 없으면 세션 도구에서 `mcp__playwright__*` 확인 |
| 공식 Figma Dev Mode MCP | `/omj` figma 프라이머·`/omj-sync` | `claude plugin list \| grep -i figma` |
| Context7 | `/omj` Next.js 최신 문서(선택) | `claude plugin list \| grep -i context7` |
| `oh-my-joy:frontend-fundamentals` | 구현 스펙 루브릭(번들) | OMJ 설치 시 항상 present |
| OMC (oh-my-claudecode) | 대규모 구현 escalation(선택) | `claude plugin list \| grep -i oh-my-claudecode` |
| `.omj/fe-context.md` | 프로젝트 acceptance·토큰·검증 선언 | `test -f .omj/fe-context.md` (➖ — 없으면 아래 스캐폴딩 제안) |
| 토큰 스토어 | `/omj-sync`(sync·push·extract) 대상 | fe-context `tokensPath` → `shared/tokens/tokens.json` → **CSS 기반 시스템**(Tailwind `@utility`/`@theme`·`:root --*`) 순으로 탐지(`references/fe-acceptance.md` SoT). 파일 스토어가 없어도 `/omj`는 동작 — **`/omj-sync`만 파일 스토어 필수**(`extract`로 부트스트랩 가능) |
| 토큰 가드 훅(opt-in) | 저장 즉시 하드코딩/Story 경고 | 소비 프로젝트 `.claude/hooks/check-design-tokens.mjs` 존재 여부 |

> Figma는 플러그인 설치와 별개로 **Figma 데스크톱 앱에서 Dev Mode MCP가 켜져 있어야** `/omj` figma 프라이머·`/omj-sync`가 동작하고, **뷰어 권한 파일은 접근이 거부**되므로 사본(Duplicate)이 필요하다 — 점검 시 사용자에게 안내한다.
> `claude` CLI를 쓸 수 없으면 탐지를 건너뛰고 수동 확인 방법(`/mcp`, `/plugin`)을 안내한다(graceful).

## 2단계 — 설치·스캐폴딩 가이드 (누락 항목, `--check` 아닐 때만)

누락된 항목마다 **`AskUserQuestion`으로 "지금 설치/생성할까요?"** 를 묻는다(설치된 항목은 스킵). 동의 시 실행, 거부 시 수동 명령만 안내:

- **Figma MCP 미설치** → `claude plugin install figma@claude-plugins-official` + "Figma 데스크톱 앱에서 Dev Mode MCP 활성화 필요" 안내.
- **Context7 미설치** → `claude plugin install context7-plugin@context7-marketplace`.
- **캡처 백엔드 없음** → playwright-cli 설치 안내(`npm i -g playwright-cli`) 또는 playwright MCP 활성 안내(둘 중 하나면 충분 — verify가 폴백 지원).
- **OMC 미설치** → 필수 아님. 원하면 `/plugin marketplace add Yeachan-Heo/oh-my-claudecode` → `install` 안내만(escalation 시너지용).
- **`.omj/fe-context.md` 부재** → "프로젝트 선언 파일을 만들까요?" 동의 시 프로젝트를 스캔(i18n 메시지 디렉터리·토큰 시스템 형태·테마 클래스·Storybook 설정)해 초안을 `Write`한다. **규칙(원칙 ⑩)**: `tokensPath`는 파일 기반 토큰이 실제로 감지될 때만 채우고, `acceptance:`는 **빈 리스트**로 두며, 감지 후보는 **주석으로만** 적는다 — 예: `# 감지됨: src/messages/{ko,en}.json — 로케일 동시 갱신을 축으로 넣을지 프로젝트가 결정`. 축·규칙을 플러그인이 자동 선언하지 않는다. 포맷 정본: `references/fe-acceptance.md`.
- **(선택) `docs/DESIGN.md` 초안** → fe-context 생성에 동의한 경우에만 이어서 제안: 브랜드 성격·색상/스페이싱 사용 맥락·컴포넌트 조합 규칙·Figma 레이어 네이밍 컨벤션의 **빈 틀 + 주석 가이드**만 생성(내용은 프로젝트가 채움). 생성 시 fe-context에 `designDocPath: docs/DESIGN.md` 연결.
- **토큰 가드 훅 미설치** → "저장 즉시 하드코딩 색상/Story 누락 경고 훅을 설치할까요?(opt-in)" 동의 시:
  1. 플러그인 `templates/hooks/check-design-tokens.mjs`·`check-story-exists.mjs`를 소비 프로젝트 **`.claude/hooks/`로 복사**한다(`cp`). 참조-등록이 아니라 **복사**인 이유: 소비 프로젝트 settings.json은 `${CLAUDE_PLUGIN_ROOT}`를 해석하지 못하고 플러그인 캐시 절대경로는 버전 업데이트마다 깨진다.
  2. 소비 프로젝트 `.claude/settings.json`의 `hooks.PostToolUse`에 matcher `Edit|Write`로 두 스크립트를 상대경로(`node .claude/hooks/check-design-tokens.mjs`)로 등록한다(`Edit`, 파일 없으면 `Write`).
  3. 훅은 fe-context 선언(`tokensPath`/`storybook: true`)이 없으면 no-op이므로, fe-context 스캐폴딩과 함께 설치할 것을 권장한다.
  4. 재실행 시 플러그인 템플릿과 복사본이 다르면 "훅 스크립트 갱신 가능" 안내(덮어쓰기는 동의 시만).

> 플러그인 설치는 **다음 세션부터** 커맨드/도구가 로드된다 — 설치 후 "새 세션에서 적용됨" 안내. 훅 등록도 다음 세션부터 발화한다.

## 3단계 — 마무리

- 점검 요약(✓/✗)과 "이제 `/omj <figma-url|작업>`으로 시작" 안내.
- (선택) `~/.claude/.omj-setup.json`에 `{"setupCompleted": "<오늘>"}` 기록 → 재실행 시 "이미 점검됨, 다시 점검할까요?"로 빠르게 처리.

## 사용법

```
/omj-setup            의존성 점검 + 누락 시 설치·스캐폴딩 가이드
/omj-setup --check    점검 표만(read-only)
/omj-setup --help     이 도움말
```

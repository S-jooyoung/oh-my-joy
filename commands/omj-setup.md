---
description: OMJ 의존성 점검 — playwright-cli·공식 Figma MCP·Context7 설치 여부 확인하고 없으면 설치 가이드 (첫 사용 전 권장)
argument-hint: "[--check] (점검만) | [--help]"
allowed-tools: Read, Write, AskUserQuestion, Bash(command:*), Bash(claude:*), Bash(npm:*), Bash(jq:*), Bash(test:*), Bash(ls:*), Bash(grep:*)
---

# /omj-setup — 의존성 닥터 + 설치 가이드

OMJ가 기대는 **선택적 의존성**을 점검하고, 없으면 설치를 안내한다. **이미 설치된 항목은 건드리지 않고 ✓만 보고**한다. 첫 사용 전에 한 번 실행하면 좋다.

## 플래그

- `--help` → 아래 사용법을 출력하고 종료.
- `--check` → 점검 표만 출력하고 종료(read-only, 설치 제안 없음).
- (없음) → 점검 후, 누락 항목에 대해 설치 여부를 묻고 안내.

## 1단계 — 점검 (read-only 탐지)

각 항목을 탐지해 ✓(있음)/✗(없음)/➖(선택·없어도 됨) 표로 보고한다:

| 의존성 | 쓰임 | 탐지 |
| --- | --- | --- |
| `playwright-cli` | `/omj-verify` 시각 검증 | `command -v playwright-cli` |
| 공식 Figma Dev Mode MCP | `/omj` figma 프라이머·`/omj-sync` | `claude plugin list \| grep -i figma` |
| Context7 | `/omj` Next.js 최신 문서(선택) | `claude plugin list \| grep -i context7` |
| `oh-my-joy:frontend-fundamentals` | 구현 스펙 루브릭(번들) | OMJ 설치 시 항상 present |
| OMC (oh-my-claudecode) | 대규모 구현 escalation(선택) | `claude plugin list \| grep -i oh-my-claudecode` |
| `tokens.json` | `/omj-sync` 대상(선택) | `.omj/fe-context.md`의 `tokensPath`(있으면) 또는 `shared/tokens/tokens.json`을 `test -f` |

> Figma는 플러그인 설치와 별개로 **Figma 데스크톱 앱에서 Dev Mode MCP가 켜져 있어야** `/omj` figma 프라이머·`/omj-sync`가 동작한다 — 점검 시 사용자에게 확인 안내한다.
> `claude` CLI를 쓸 수 없으면 탐지를 건너뛰고 수동 확인 방법(`/mcp`, `/plugin`)을 안내한다(graceful).

## 2단계 — 설치 가이드 (누락 항목, `--check` 아닐 때만)

누락된 항목마다 **`AskUserQuestion`으로 "지금 설치할까요?"** 를 묻는다(설치된 항목은 스킵). 동의 시 실행, 거부 시 수동 명령만 안내:

- **Figma MCP 미설치** → `claude plugin install figma@claude-plugins-official` + "Figma 데스크톱 앱에서 Dev Mode MCP 활성화 필요" 안내.
- **Context7 미설치** → `claude plugin install context7-plugin@context7-marketplace`.
- **playwright-cli 미설치** → 설치 명령 안내(프로젝트 vendoring 또는 `npm i -g playwright-cli`). 동의 시 `npm i -g` 실행.
- **OMC 미설치** → 필수 아님. 원하면 `/plugin marketplace add Yeachan-Heo/oh-my-claudecode` → `install` 안내만(escalation 시너지용).

> 플러그인 설치는 **다음 세션부터** 커맨드/도구가 로드된다 — 설치 후 "새 세션에서 적용됨" 안내.

## 3단계 — 마무리

- 점검 요약(✓/✗)과 "이제 `/omj <figma-url|작업>`으로 시작" 안내.
- (선택) `~/.claude/.omj-setup.json`에 `{"setupCompleted": "<오늘>"}` 기록 → 재실행 시 "이미 점검됨, 다시 점검할까요?"로 빠르게 처리.

## 사용법

```
/omj-setup            의존성 점검 + 누락 시 설치 가이드
/omj-setup --check    점검 표만(read-only)
/omj-setup --help     이 도움말
```

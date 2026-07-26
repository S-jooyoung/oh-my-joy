---
description: 승인된 OMJ 스펙을 OMC/OMX 실행 레인으로 넘기는 canonical fallback handoff command
argument-hint: "<approved-spec-path 또는 pasted approved spec>"
allowed-tools: Read, Grep, AskUserQuestion, Bash(git status:*)
---

# /omj-start — 승인 후 실행 레인 fallback

`/omj`가 Plan/spec을 만들고 사용자가 승인했지만 선택한 실행 레인을 자동 시작할 수 없을 때 사용하는 **단 하나의 fallback surface**다.

## 입력

`$ARGUMENTS`는 아래 둘 중 하나다.

1. 승인된 OMJ spec/plan 파일 경로
2. 승인된 OMJ spec 본문 paste

입력이 없으면 사용법만 출력하고 멈춘다. 새 스펙을 만들거나 소스 코드를 수정하지 않는다.

## 절차

1. 입력이 경로면 `Read`로 읽고, 본문이면 그대로 분석한다.
2. `selectedLane`, `선택된 레인`, 또는 `## 실행 레인 선택` 아래의 선택값이 있으면 **다시 묻지 않는다**.
3. 선택값이 없을 때만 `${CLAUDE_PLUGIN_ROOT}/docs/EXECUTION-HANDOFF.md`(레포 기준 `docs/EXECUTION-HANDOFF.md`)를 기준으로 `AskUserQuestion`을 정확히 한 번 사용한다. 1번 옵션은 항상 추천값이며 라벨에 `(추천)`을 붙인다. (스펙의 `선택된 레인`이 `(auto)`면 실행할 별도 레인이 없다는 뜻 — "인라인 구현 대상, /omj-start 불필요"를 안내하고 종료한다.)
4. 선택 결과를 `Wrapper`와 `Sublane`으로 분리한다.
   - Wrapper: `none` · `/goal` · `$ultragoal`
   - Sublane: `inline/manual` · `$ralph` · `$team`
   - QA follow-up: `$ultraqa`
   - Consensus fallback: `$ralplan`
5. 런타임을 감지한다.
   - shell availability probe는 쓰지 않는다. 현재 세션 문맥과 스펙의 선택 lane만으로 안전하게 판단한다.
   - 현재 세션이 명시적 OMX/Codex 문맥이고 입력이 파일 경로이며 `Wrapper=$ultragoal`이면 `omx ultragoal create-goals --brief-file '<safe-approved-spec-path>'`만 직접 실행할 수 있다.
   - Claude/OMC 문맥이면 `/goal`/`/team`/`/ralph`/`/ultraqa` 형식의 copyable command를 출력한다.
   - 둘 다 불명확하면 manual checklist 하나만 출력한다.
6. 직접 launch가 안전하고 명시적인 경우에만 실행한다. `$team`/`$ralph`/`$ultraqa` direct shell dispatch, pasted spec direct shell dispatch, 또는 런타임 semantics가 불확실한 경우에는 실행하지 말고 **정확히 하나의 copyable command/action**만 출력한다.

## 직접 Bash 실행 안전 조건

> **강제층은 권한이지 산문이 아니다.** 아래 조건은 모델이 지켜야 할 규율이고, 실제 게이트는
> `allowed-tools`가 `omx ultragoal create-goals`를 **사전승인하지 않는다**는 사실이다 —
> 직접 launch를 시도하면 사용자에게 권한 프롬프트가 뜨고, 거기서 실행될 명령 전문을 보고
> 승인/거부한다. 즉 "권한을 빼는 것이 곧 안전 게이트를 강제하는 것"(PRINCIPLES ③)을
> 이 커맨드에도 동일하게 적용한다.

직접 Bash 실행은 path 입력을 raw로 interpolation하지 않는다. 아래 조건을 모두 만족할 때만 실행한다.

**주입 차단 (문자 수준)**

- 입력이 `Read`로 확인 가능한 기존 파일 경로다.
- 경로가 `-`로 시작하지 않는다.
- 경로가 보수적 safe-path 패턴 `^[A-Za-z0-9._/+=:@-]+$`에 맞는다.
- 공백, newline, quote, backtick, `$`, `;`, `&`, `|`, `<`, `>`, `(`, `)` 같은 shell metacharacter가 없다.
- 실행 예시는 항상 single-quoted literal 형태로만 만든다: `omx ultragoal create-goals --brief-file '<safe-approved-spec-path>'`.

**봉쇄 (경로 수준)** — 위 패턴은 metacharacter만 막고 *어떤 파일을 가리키는지*는 통제하지 않는다. 다음도 함께 만족해야 한다.

- 경로가 `/`로 시작하지 않는다(절대경로로 레포 밖을 가리키지 않는다).
- 경로 세그먼트에 `..`가 없다(traversal 금지).
- 확장자가 `.md`다(승인된 spec/plan 문서만 넘긴다).

하나라도 실패하면 Bash를 실행하지 말고 copyable action 하나만 출력한다.

## 출력 계약

항상 최종 출력은 하나의 action으로 끝난다.

```md
선택된 실행 레인: Wrapper=<...>; Sublane=<...>
실행:
<one copyable command/action>
```

예:

```md
선택된 실행 레인: Wrapper=$ultragoal; Sublane=$team
실행:
$ultragoal "Implement <approved-spec-path>; selected lane: Wrapper=$ultragoal, Sublane=$team"
```

OMX/Codex에서 파일 경로 입력 + `Wrapper=$ultragoal` direct launch가 안전한 경우:

```md
선택된 실행 레인: Wrapper=$ultragoal; Sublane=$team
실행:
omx ultragoal create-goals --brief-file '<safe-approved-spec-path>'
```

붙여넣은 spec이라 파일 경로가 없는 경우:

```md
선택된 실행 레인: Wrapper=$ultragoal; Sublane=$team
실행:
$ultragoal "Implement approved OMJ spec; selected lane: Wrapper=$ultragoal, Sublane=$team; summary: <approved-spec 핵심 요약>"
```

## `/goal clear` 안전

- `/goal clear`는 절대 자동 실행하지 않는다.
- 이전 completed goal이 새 same-thread goal 생성을 막는 경우에만 “먼저 사용자가 `/goal clear` 실행”을 명시적 action으로 출력한다.
- active unrelated goal이나 OMC/OMX workflow state를 몰래 clear하지 않는다.

## 금지

- 선택 lane이 이미 있는데 다시 질문하기.
- 두 개 이상의 command를 뿌려 사용자가 다시 판단하게 만들기.
- source code를 직접 수정하기.
- 빌드/테스트/검증을 실행하기.
- active `/goal` 또는 workflow state를 숨은 방식으로 clear하기.

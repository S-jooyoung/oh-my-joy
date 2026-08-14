# OMJ 실행 핸드오프 라우팅

이 문서가 OMJ 실행 레인 선택의 **유일한 라우팅 SoT**다. README, `docs/OMC-INTEGRATION.md`, `docs/PRINCIPLES.md`, `commands/omj.md`, `commands/omj-start.md`는 이 문서를 요약하거나 링크만 하고, **점수표·임계값을 중복 정의하지 않는다**.

> **한 가지 예외**: 런타임에서 이 파일에 도달할 수 없을 때를 대비해 `commands/omj.md`가 **임계값 없는** 최소 fallback 매핑(작으면 inline/manual, 지속 목표면 wrapper, 병렬 lane이면 team …)을 갖는다. 수치·조건은 여기에만 있고 fallback은 방향만 준다 — graceful degradation(PRINCIPLES ⑨)과 SoT 단일화(⑧)를 동시에 만족시키는 경계다.

## 모델: Wrapper + Sublane

- **Wrapper**: durable state/checkpoint owner.
  - `none`: 아주 작은 단발 작업.
  - `/goal` 또는 `$ultragoal`: 여러 단계·여러 턴·checkpoint가 필요한 작업.
  - `/oh-my-joy:goal-loop`: OMJ 자체 durable wrapper — **런타임(OMC/OMX)이 없어도 항상
    존재하는 선택지**다(런타임 행이 아니라 상시 축). 골 상태를 `.omj/goals/`에 영속하고
    완료를 validator 증거 객체로만 인정한다.
- **Sublane**: 실제 실행 방식.
  - `inline/manual`: OMC/OMX가 없거나 매우 작은 작업.
  - `$ralph`/`/ralph`: 한 명의 persistent owner가 끝까지 밀고 검증해야 할 때.
  - `$team`/`/team`: 병렬 가능한 구현·문서·검증 lane이 2개 이상일 때.
- **QA follow-up**: `$ultraqa`/`/ultraqa`, 구현 후 adversarial e2e/hostile QA가 목표일 때.
- **Consensus fallback**: `/oh-my-claudecode:ralplan`(OMC), `$ralplan`(OMX), 또는 `/oh-my-joy:ralplan`(OMJ native — 런타임 불요, critic 1패스 경량 합의), 아직 모호하거나 아키텍처 합의가 필요한 경우. **런타임 비대칭**: OMC `/oh-my-claudecode:ralplan`은 합의 승인 시 실행(team/ralph)으로 이어지지만, OMX `$ralplan`은 현재 호스트 영수증 게이트로 **계획 산출 후 정지**한다(fail-closed) — 합의 뒤 실행 레인은 사용자가 별도로 시작해야 하며, OMX 문맥에서 이 레인을 추천할 때는 selector가 그 사실을 함께 안내한다.

## 추천 입력

레인 추천은 아래 신호를 함께 본다.

- touched file count
- screen/route count
- separable lanes count
- uncertainty
- risk
- verification need
- expected multi-turn duration
- OMC/OMX availability

## 추천 규칙

1. **작고 구체적**: 파일 1-2개, route 1개, 새 추상화 없음 → `Wrapper: none`, `Sublane: inline/manual` 또는 `ralph`.
2. **지속 목표**: 파일 3개 이상, 여러 단계, 재시작/체크포인트 필요 → `Wrapper: $ultragoal` 또는 `/goal`. **둘 다 없으면 `/oh-my-joy:goal-loop`** — 완료 증거 강제가 특히 중요하면 런타임이 있어도 이 레인을 선택할 수 있다(우선순위 규칙은 아래 "OMJ native 레인" 절).
3. **병렬 가능**: 화면/문서/검증 등 독립 lane 2개 이상 → `Sublane: $team` 또는 `/team`.
4. **순차 압박**: 병렬성은 낮지만 완료/검증 루프가 중요 → `Sublane: $ralph` 또는 `/ralph`.
5. **QA-only**: 구현이 끝났고 hostile 시나리오·시각/상호작용 결함 탐지가 목표 → `$ultraqa`/`/ultraqa`를 1번으로 추천.
6. **모호/고위험**: 요구·경계·아키텍처가 불명확 → `/oh-my-claudecode:ralplan`/`$ralplan`을 먼저 추천(OMX면 plan-only 안내 포함 — 위 Consensus fallback 참조). OMC/OMX가 없으면 `/oh-my-joy:ralplan`.
7. **런타임 없음**: OMC/OMX 없음 → durable 필요면 `/oh-my-joy:goal-loop`, 아니면 copyable manual command/action을 출력하고 실패하지 않는다.

## OMJ native 레인 (`/oh-my-joy:goal-loop`)

런타임 표의 **행이 아니라 항상 존재하는 durable 선택지**다(OMC/OMX 유무 무관). 규칙:

- **우선순위**: OMC `/goal`·OMX `$ultragoal`이 가용하면 기본 추천은 여전히 그 레인이다
  (오케스트레이션 폭이 넓다). `/oh-my-joy:goal-loop`는 ① 런타임이 없을 때의 durable
  기본값이고 ② 런타임이 있어도 "증거 강제 완료·단일 owner 순차"가 목적이면 명시
  선택지로 병기한다. selector 표기는 반드시 정규 호출로 구분한다 —
  `Wrapper: /goal`(OMC)과 `Wrapper: /oh-my-joy:goal-loop`(OMJ)는 다른 레인이다.
- **auto-select 경계**: `/oh-my-joy:goal-loop`도 무거운 레인이다 — 추천되면 다른 무거운
  레인과 똑같이 **정확히 1회 질문**한다(침묵 진행 금지).
- **풀 사이클 결합**: 흐릿한 아이디어는 `/oh-my-joy:deep-interview`가 스펙으로,
  FE 신호는 `/omj`가 uSpec으로 만들고, 승인된 스펙을 이 레인이 소비한다 — FE 골의
  실행자는 `figma-implementer`, 검증 층(design-qa·`/omj-verify`·`/omj-fix`·`/omj-sync`·
  `/oh-my-joy:ff-review`)은 기존 그대로 공용이다. 기존 `/omj` 단독 사용은 아무것도
  달라지지 않는다.

## Auto-select 규칙 (inline/manual 한정 질문 생략)

추천 레인이 **`Wrapper=none; Sublane=inline/manual`일 때만** selector의 `AskUserQuestion`을 생략하고, 스펙에 `Selected lane: Wrapper=none; Sublane=inline/manual (auto)`로 기록만 한다.

- **근거**: 이 경우 질문의 답이 자명해 프롬프트 피로만 남는다(PRINCIPLES ⑪ — 추론 가능+저비용이면 묻지 않는다). 오판의 blast radius도 작다 — 잘못돼도 "가장 값싼 레인으로 진행" 또는 사용자가 승인 화면에서 정정.
- **경계**: `$team`/`$ultragoal`/`/goal`/`$ralph`/`$ralplan`/`$ultraqa`가 추천이면 **항상 정확히 1회 질문**한다(무거운 레인의 침묵 진행 금지).
- **동의 지점**: Plan 승인(ExitPlanMode)이 곧 레인 동의다. 이견이면 승인 화면에서 plan 파일을 수정하거나 `/omj-start`에서 재선택한다.
- **`(auto)` 스펙의 승인 후**: 실행할 레인이 따로 없으므로 `/omj-start`가 불필요하다 — 현재 세션이 바로 인라인 구현을 진행한다.

## Selector output contract

항상 option 1이 추천이어야 하며 `(recommended)`를 붙인다(auto-select 조건에 해당하면 질문 없이 아래 형식의 `Selected lane` 줄에 `(auto)`를 붙여 기록만 한다). Wrapper와 Sublane이 모두 적용되면 한 줄 안에 분리해 쓴다.

```md
## Execution lane selection
1. Wrapper: $ultragoal; Sublane: $team (recommended) — multiple doc/command/verification lanes can be split; checkpoints needed.
2. Wrapper: none; Sublane: $ralph — one owner implements/verifies sequentially.
3. QA follow-up: $ultraqa — hostile QA/fix loop after implementation.

Selected lane: Wrapper=$ultragoal; Sublane=$team

If auto-start is not possible after approval, run exactly this one line:
/omj-start <approved-spec-or-plan-path>
```

## `/omj-start` fallback contract

- `/omj`가 선택한 lane이 spec에 있으면(수동 선택이든 `(auto)` 기록이든) 다시 묻지 않는다.
- 선택 lane이 없을 때만 동일한 단일 selector를 한 번 묻는다.
- 직접 launch가 가능하고 안전하면 launch한다.
- 직접 launch가 불가하거나 slash/dollar command semantics가 불명확하면 정확히 하나의 copyable command/action만 출력한다.
- OMX ultragoal direct launch는 **2단계**다: `omx ultragoal create-goals --brief-file '<path>'`는 durable goal을 **생성만** 하고, 시작/재개는 `omx ultragoal complete-goals`가 담당한다 — create-goals 실행 후 최종 copyable action은 `omx ultragoal complete-goals`로 한다.
- `/goal clear`는 절대 자동으로 하지 않는다. 이미 완료된 이전 goal이 새 same-thread goal을 막을 때만 명시적 사용자 액션으로 출력한다.

## Syntax map

| Runtime | Durable wrapper | Team sublane | Ralph sublane | UltraQA | Ralplan |
| --- | --- | --- | --- | --- | --- |
| Codex/OMX | `$ultragoal` + Codex `/goal` | `$team` / `omx team`¹ | `$ralph` | `$ultraqa` | `$ralplan`(plan-only) |
| Claude/OMC | `/goal` | `/team` | `/ralph` | `/ultraqa` | `/oh-my-claudecode:ralplan` |
| No runtime | `/oh-my-joy:goal-loop` | manual | manual | manual QA checklist | `/oh-my-joy:ralplan` |

¹ Codex App·tmux 밖 세션에서는 `$team`/`omx team`을 직접 제시하지 않는다 — shell에서 OMX CLI를 먼저 기동해야 한다(OMX README).

## Clear/start safety

- Native Plan approval is the handoff/clear point for the plan gate.
- Terminal/stale OMC/OMX state can be cleared only by the active execution workflow’s documented cleanup path.
- Active unrelated `/goal` must not be cleared silently.
- `/omj` and `/omj-start` must never hide destructive or irreversible state changes behind “start”.

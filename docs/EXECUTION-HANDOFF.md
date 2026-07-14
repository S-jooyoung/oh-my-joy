# OMJ 실행 핸드오프 라우팅

이 문서가 OMJ 실행 레인 선택의 **유일한 라우팅 SoT**다. README, `docs/OMC-INTEGRATION.md`, `docs/PRINCIPLES.md`, `commands/omj.md`, `commands/omj-start.md`는 이 문서를 요약하거나 링크만 하고, 점수표·임계값·레인 선택 규칙을 중복 정의하지 않는다.

## 모델: Wrapper + Sublane

- **Wrapper**: durable state/checkpoint owner.
  - `none`: 아주 작은 단발 작업.
  - `/goal` 또는 `$ultragoal`: 여러 단계·여러 턴·checkpoint가 필요한 작업.
- **Sublane**: 실제 실행 방식.
  - `inline/manual`: OMC/OMX가 없거나 매우 작은 작업.
  - `$ralph`/`/ralph`: 한 명의 persistent owner가 끝까지 밀고 검증해야 할 때.
  - `$team`/`/team`: 병렬 가능한 구현·문서·검증 lane이 2개 이상일 때.
- **QA follow-up**: `$ultraqa`/`/ultraqa`, 구현 후 adversarial e2e/hostile QA가 목표일 때.
- **Consensus fallback**: `$ralplan`/`/ralplan`, 아직 모호하거나 아키텍처 합의가 필요한 경우.

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
2. **지속 목표**: 파일 3개 이상, 여러 단계, 재시작/체크포인트 필요 → `Wrapper: $ultragoal` 또는 `/goal`.
3. **병렬 가능**: 화면/문서/검증 등 독립 lane 2개 이상 → `Sublane: $team` 또는 `/team`.
4. **순차 압박**: 병렬성은 낮지만 완료/검증 루프가 중요 → `Sublane: $ralph` 또는 `/ralph`.
5. **QA-only**: 구현이 끝났고 hostile 시나리오·시각/상호작용 결함 탐지가 목표 → `$ultraqa`/`/ultraqa`를 1번으로 추천.
6. **모호/고위험**: 요구·경계·아키텍처가 불명확 → `$ralplan`/`/ralplan`을 먼저 추천.
7. **런타임 없음**: OMC/OMX 없음 → copyable manual command/action만 출력하고 실패하지 않는다.

## Auto-select 규칙 (inline/manual 한정 질문 생략)

추천 레인이 **`Wrapper=none; Sublane=inline/manual`일 때만** selector의 `AskUserQuestion`을 생략하고, 스펙에 `선택된 레인: Wrapper=none; Sublane=inline/manual (auto)`로 기록만 한다.

- **근거**: 이 경우 질문의 답이 자명해 프롬프트 피로만 남는다(PRINCIPLES ⑪ — 추론 가능+저비용이면 묻지 않는다). 오판의 blast radius도 작다 — 잘못돼도 "가장 값싼 레인으로 진행" 또는 사용자가 승인 화면에서 정정.
- **경계**: `$team`/`$ultragoal`/`/goal`/`$ralph`/`$ralplan`/`$ultraqa`가 추천이면 **항상 정확히 1회 질문**한다(무거운 레인의 침묵 진행 금지).
- **동의 지점**: Plan 승인(ExitPlanMode)이 곧 레인 동의다. 이견이면 승인 화면에서 plan 파일을 수정하거나 `/omj-start`에서 재선택한다.
- **`(auto)` 스펙의 승인 후**: 실행할 레인이 따로 없으므로 `/omj-start`가 불필요하다 — 현재 세션이 바로 인라인 구현을 진행한다.

## Selector output contract

항상 option 1이 추천이어야 하며 `(추천)`을 붙인다(auto-select 조건에 해당하면 질문 없이 아래 형식의 `선택된 레인` 줄에 `(auto)`를 붙여 기록만 한다). Wrapper와 Sublane이 모두 적용되면 한 줄 안에 분리해 쓴다.

```md
## 실행 레인 선택
1. Wrapper: $ultragoal; Sublane: $team (추천) — 여러 문서/커맨드/검증 lane이 분리 가능하고 checkpoint가 필요함.
2. Wrapper: none; Sublane: $ralph — 한 owner가 순차 구현/검증.
3. QA follow-up: $ultraqa — 구현 후 hostile QA/fix 루프.

선택된 레인: Wrapper=$ultragoal; Sublane=$team

승인 후 자동 시작이 불가하면 다음 한 줄만 실행:
/omj-start <approved-spec-or-plan-path>
```

## `/omj-start` fallback contract

- `/omj`가 선택한 lane이 spec에 있으면(수동 선택이든 `(auto)` 기록이든) 다시 묻지 않는다.
- 선택 lane이 없을 때만 동일한 단일 selector를 한 번 묻는다.
- 직접 launch가 가능하고 안전하면 launch한다.
- 직접 launch가 불가하거나 slash/dollar command semantics가 불명확하면 정확히 하나의 copyable command/action만 출력한다.
- `/goal clear`는 절대 자동으로 하지 않는다. 이미 완료된 이전 goal이 새 same-thread goal을 막을 때만 명시적 사용자 액션으로 출력한다.

## Syntax map

| Runtime | Durable wrapper | Team sublane | Ralph sublane | UltraQA | Ralplan |
| --- | --- | --- | --- | --- | --- |
| Codex/OMX | `$ultragoal` + Codex `/goal` | `$team` / `omx team` | `$ralph` | `$ultraqa` | `$ralplan` |
| Claude/OMC | `/goal` | `/team` | `/ralph` | `/ultraqa` | `/ralplan` |
| No runtime | manual/copyable action | manual | manual | manual QA checklist | manual plan review |

## Clear/start safety

- Native Plan approval is the handoff/clear point for the plan gate.
- Terminal/stale OMC/OMX state can be cleared only by the active execution workflow’s documented cleanup path.
- Active unrelated `/goal` must not be cleared silently.
- `/omj` and `/omj-start` must never hide destructive or irreversible state changes behind “start”.

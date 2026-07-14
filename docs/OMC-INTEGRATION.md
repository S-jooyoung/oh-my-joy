# OMJ × OMC/OMX 통합 작업 플로우

> oh-my-joy(OMJ)를 oh-my-claudecode(OMC) 또는 oh-my-codex(OMX)와 함께 쓸 때의 심화 레퍼런스입니다. README "OMJ × OMC/OMX" 절에서 요약만 보고 이 문서로 넘어왔다면, 여기서 게이트가 왜 안 겹치는지·역할을 어떻게 나누는지·시나리오별(A/B/C) 구체 플로우를 확인할 수 있습니다. 실행 레인 라우팅의 유일한 SoT는 [`docs/EXECUTION-HANDOFF.md`](EXECUTION-HANDOFF.md)입니다.

평소 OMC/OMX로 계획하고 실행한다면, OMJ는 그 흐름의 **프론트엔드 전용 on-ramp(스펙 생성) + 실행 레인 선택 + 검증** 단계입니다. `/omj`로 계획해도 OMC/OMX 계획·실행 도구를 그대로 같이 씁니다 — `/omj`가 만든 구현 스펙이 곧 실행 도구가 소비하는 입력이 되기 때문입니다.

## 멘탈 모델 (1문장)

"FE는 무조건 `/omj`로 시작 — 스펙을 승인한 뒤 특별한 이유가 없으면 1번 `(추천)` 실행 레인으로 간다."

## 한 줄 역할 분담

- **계획**: `/omj`(FE 맥락 스펙, 네이티브 Plan + 실행 selector). 합의가 필요한 대규모만 승인 후 `/ralplan`/`$ralplan`에 시드로 넘김.
- **실행**: `/goal`/`$ultragoal`(durable goal/checkpoint) · `/team`/`$team`(병렬 N에이전트) · `/ralph`/`$ralph`(순차 루프). `/omj-start`는 자동 시작이 안 될 때의 canonical fallback handoff. inline 레인(`(auto)` 포함)에서는 OMJ 번들 `figma-implementer` 에이전트가 승인된 스펙의 표준 실행자로 쓰일 수 있다 — 단 OMC/OMX 레인이 선택된 스펙은 항상 그 레인이 우선한다(레인이 아니라 레인이 쓰는 실행자).
- **검증**: `/omj-review`(FE 코드 diff) · `/omj-verify`(FE 시각) · OMC/OMX 일반 검증 또는 `$ultraqa`(adversarial QA).

## 게이트 규칙 (왜 안 겹치나)

`/omj`만 Claude Code 네이티브 Plan 모드(`ExitPlanMode`)를 쓰는 **읽기 게이트**이고, OMC/OMX 계획·실행 도구는 각자의 workflow/goal ledger를 쓰는 **실행 게이트**입니다. 두 게이트는 **직교**하며 핸드오프 순간에만 시간순으로 만납니다.

따라서 기본 흐름은:

1. `/omj`가 FE 스펙과 실행 레인 선택지를 만든다.
2. 사용자가 Plan을 승인한다.
3. 선택된 레인으로 바로 실행하거나, 자동 시작이 불가하면 `/omj-start <approved-spec>` 한 줄로 넘긴다.

`/ralplan`/`$ralplan` 합의는 모호·고위험·아키텍처 합의가 필요할 때만 명시적으로 거칩니다. 단순히 "큰 작업"이라는 이유만으로 매번 두 번째 계획 게이트를 강제하지 않습니다.

## A. 일반 FE 작업 (단순~중간)

1. `/omj <figma-url|작업> [route]` → 구현 스펙(Plan) + 실행 레인 선택.
2. 검토 후 승인(ExitPlanMode).
3. 선택된 레인이 작으면 inline/manual 또는 `/ralph`/`$ralph`; 파일·검증 lane이 나뉘면 `/team`/`$team`.
4. `/omj-review`로 diff 점검 → `/omj-verify <route>` 시각 점검. 어긋나면 `/omj-fix`로 수정·재확인. 토큰이 바뀌면 `/omj-sync`(대화형: 코드가 기본 SoT이되 충돌 시 사용자가 방향 선택 — 그대로 밀어넣으려면 `push`).

## B. 대규모/복잡 FE (여러 화면·리팩터링)

1. `/omj`로 핵심 화면 스펙 author (figma + FF/vercel) — 대상 파일·번호 단계·acceptance·검증 route를 스펙에 박음.
2. 승인(ExitPlanMode) 후 durable work면 `/goal` 또는 `$ultragoal` wrapper를 둔다.
3. 병렬 가능한 구현·문서·검증 lane이 있으면 wrapper 안에서 `/team`/`$team`을 쓴다. 순차 완료 압박이 크면 `/ralph`/`$ralph`를 쓴다.
4. 진짜 모호하거나 합의가 필요할 때만 승인 후 명시적 `/ralplan`/`$ralplan`에 스펙을 시드로 투입한다.
5. 화면별 `/omj-review`·`/omj-verify`, 잔여 diff 재실행.

## C. 풀스택 (FE+BE)

1. 전체 큰 그림은 OMC/OMX 계획 도구로 잡는다.
2. FE 잎 = `/omj` 프라이밍 → 승인 → 선택된 실행 레인. BE = OMC/OMX 일반 executor/worker.
3. 검증: FE `/omj-review`·`/omj-verify`, BE 일반 검증, 필요 시 `$ultraqa`.

## 핸드오프 제약 (메커니즘 주의)

- `/omj`는 read-only라 소스 코드를 스스로 못 씁니다. 파일 materialize/수정은 `ExitPlanMode` 승인 **후** 실행 레인이 담당합니다.
- `/omj`는 실행 레인 선택을 **최대 한 번만** 묻습니다 — 추천이 `Wrapper=none; Sublane=inline/manual`이면 묻지 않고 `(auto)`로 기록만 하며(Plan 승인=레인 동의), 그 외 레인 추천일 때만 1회 질문에 1번 옵션을 `(추천)`으로 둡니다. 선택값은 최종 스펙에 남깁니다(auto-select 규칙 정본: `EXECUTION-HANDOFF.md`).
- 자동 시작이 불가하면 `/omj-start <approved-spec-or-plan-path>` 한 줄만 출력합니다. 사용자가 다시 판단해야 하는 여러 command를 동시에 뿌리지 않습니다.
- `/goal clear`는 자동 실행하지 않습니다. 이전 completed goal이 새 same-thread goal을 막을 때만 명시적 사용자 action으로 안내합니다.
- OMC/OMX syntax와 wrapper/sublane 분리는 [`docs/EXECUTION-HANDOFF.md`](EXECUTION-HANDOFF.md)가 정본입니다. 이 문서는 플로우 설명만 유지합니다.

> **요지**: "무엇을 만들지"는 FE면 `/omj`가 figma·FF 맥락으로 정확히 뽑아주고(처방), "어떻게 굴릴지"는 OMC/OMX 실행 도구가 가져갑니다. 기본은 승인 후 선택된 레인으로 실행 직행이고, 합의 루프는 모호·고위험일 때만 명시적으로 씁니다.

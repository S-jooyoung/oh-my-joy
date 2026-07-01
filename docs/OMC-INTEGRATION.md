# OMJ × OMC 통합 작업 플로우

> oh-my-joy(OMJ)를 oh-my-claudecode(OMC)와 함께 쓸 때의 심화 레퍼런스입니다. README "OMJ × OMC" 절에서 요약만 보고 이 문서로 넘어왔다면, 여기서 게이트가 왜 안 겹치는지·역할을 어떻게 나누는지·시나리오별(A/B/C) 구체 플로우를 확인할 수 있습니다.

평소 `/omc-plan`·`/ralplan`로 계획하고 `/ralph`·`/team`·`/goal`로 실행한다면, OMJ는 그 흐름의 **프론트엔드 전용 on-ramp(스펙 생성) + 검증** 단계입니다. `/omj`로 계획해도 OMC 계획·실행 도구를 **그대로 같이 씁니다** — `/omj`가 만든 구현 스펙이 곧 OMC 도구가 소비하는 입력이 되기 때문입니다(스펙이 둘을 잇는 매개).

## 멘탈 모델 (1문장)

"FE는 무조건 `/omj`로 시작 — 커지면 승인 후 OMC `executor`로 escalate. 백엔드/범용/리서치만 OMC 직접."

## 한 줄 역할 분담

- **계획**: `/omj`(FE 맥락 스펙, 네이티브 Plan) — 합의가 필요한 대규모만 승인 후 `/ralplan`에 시드로 넘김
- **실행**: `/ralph`(순차 루프) · `/team`(병렬 N에이전트) · `/goal`(장기 다목표) — OMC
- **검증**: `/omj-review`(FE 코드 diff) · `/omj-verify`(FE 시각) · OMC `/verify`(BE/일반)

## 게이트 규칙 (왜 안 겹치나)

`/omj`만 Claude Code 네이티브 Plan 모드(`ExitPlanMode`)를 쓰는 **읽기 게이트**이고, OMC 계획/실행 도구(`/omc-plan`·`/ralplan`·`/ralph`·`/team`·`/autopilot`)는 전부 자체 `pending-approval` **실행 게이트**를 씁니다 — OMC는 `ExitPlanMode`를 호출하지 않습니다. 두 게이트는 **직교**하며 핸드오프 순간에만 시간순으로 만나므로 "이중 계획 충돌"은 없습니다. 또한 `ralph`/`team`/`autopilot`의 사전 게이트에서 **auto-pass = ralplan을 건너뛰고 실행 직행**(ralplan 실행이 아님)이고, 합의는 **명시적 `/ralplan` 호출만** 거칩니다(2차 승인).

## A. 일반 FE 작업 (단순~중간)

1. `/omj <figma-url|작업> [route]` → 구현 스펙(Plan)
2. 검토 후 승인(ExitPlanMode)
3. 실행: 작으면 인라인, 다중 파일이면 승인된 스펙/경로를 `/ralph`·`/team` free-text에 임베드해 직행(사람 승인 1회)
4. `/omj-review`로 diff 점검 → `/omj-verify <route>` 시각 점검(어긋나면 `/omj-fix`로 수정·재확인) → 토큰이 바뀌면 `/omj-sync`(대화형: 코드가 기본 SoT이되 충돌 시 사용자가 방향 선택 — 그대로 밀어넣으려면 `push`)

## B. 대규모/복잡 FE (여러 화면·리팩터링)

1. `/omj`로 핵심 화면 스펙 author (figma + FF/vercel) — 대상 파일·번호 단계·acceptance를 스펙에 박음(구체 신호)
2. 승인(ExitPlanMode) 후 **메인 세션**이 스펙을 실행 커맨드 free-text에 임베드(또는 `.omc/plans/omj-<slug>.md`로 저장 후 경로 참조) → `/team`(병렬)·`/ralph`(순차) **직행**. 구체 신호가 있어 사전 게이트가 ralplan으로 리다이렉트하지 않습니다(= ralplan 스킵, 승인 1회). 장기면 `/goal`에 등록.
3. **진짜 모호하거나 합의가 필요할 때만** 승인 후 명시적 `/ralplan`에 스펙을 시드로 투입 → 합의 정제(`.omc/plans/ralplan-*.md`) → OMC 게이트 승인(2차) → `/team`·`/ralph` 실행.
4. 화면별 `/omj-review`·`/omj-verify`, 잔여 diff 재실행.

## C. 풀스택 (FE+BE)

1. `/omc-plan` 또는 `/ralplan`로 전체 큰 그림
2. FE 잎 = `/omj` 프라이밍 → 승인 → 실행, BE = OMC `executor`
3. 검증: FE `/omj-review`·`/omj-verify`, BE OMC `/verify`

## 핸드오프 제약 (메커니즘 주의)

- `/omj`는 read-only라 스펙 아티팩트를 **스스로 못 씁니다** → 파일 materialize는 `ExitPlanMode` 승인 **'후'** 메인 세션이 합니다.
- `autopilot`은 `omj-*.md`를 자동탐지하지 않습니다(`ralplan-*`/`consensus-*`/`deep-interview-*`만) → autopilot 재사용은 `/ralplan` 경유 또는 명시 경로 지정이 필요합니다.
- `ralph`의 `.omc/plans` 소비는 미문서화이므로, 실행 커맨드 free-text에 **경로를 명시 임베드**하는 게 결정적입니다. `team`은 free-text만 받으므로 경로 + acceptance 요약을 함께 임베드합니다.
- 네이티브 Plan 파일(`~/.claude/plans/`)과 `.omc/plans/`는 **다른 위치**입니다 — 혼동하지 마세요.

> **요지**: "무엇을 만들지"는 FE면 `/omj`가 figma·FF 맥락으로 정확히 뽑아주고(처방), "어떻게 굴릴지"는 OMC 실행 도구(`/ralph`·`/team`·`/goal`)가 그대로 가져갑니다 — 스펙이 매개입니다. 기본은 승인 후 실행 직행(승인 1회)이고, `/ralplan` 합의는 모호·대규모일 때만 명시적으로 씁니다.

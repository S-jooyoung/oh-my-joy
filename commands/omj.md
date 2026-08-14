---
description: FE 작업·Figma 디자인 구현(design to code)의 진입점 — figma.com 링크를 붙여넣거나 "이 디자인/화면/컴포넌트 구현해줘"(implement this Figma design) 요청이면 이 커맨드가 먼저다. 명세를 수집해 FF·vercel 적용 구현 스펙(Plan)을 만들고 멈춘다(승인 후 구현)
argument-hint: "[figma-url … 또는 작업설명] [route]"
allowed-tools: Read, Grep, Glob, Skill, AskUserQuestion, mcp__plugin_figma_figma__get_design_context, mcp__plugin_figma_figma__get_screenshot, mcp__plugin_figma_figma__get_variable_defs, mcp__plugin_figma_figma__get_metadata, mcp__figma__get_design_context, mcp__figma__get_screenshot, mcp__figma__get_variable_defs, mcp__figma__get_metadata, mcp__plugin_context7-plugin_context7__*, mcp__context7__*
---

# /omj — 프론트엔드 Plan 프라이머

프론트엔드 작업의 **명세를 수집**하고 **구현 스펙(=네이티브 Plan)** 을 작성한 뒤 **멈춘다**. 실제 코드 구현은 사용자가 그 Plan을 승인(ExitPlanMode)한 뒤의 정상 실행이 담당한다.

> ⚠️ **이 커맨드는 코드를 직접 쓰지 않는다(read-only).** 파일을 Write/Edit하거나 빌드/검증을 실행하지 않는다. allowed-tools는 읽기 도구(`Read`/`Grep`/`Glob`) + **figma 읽기 전용 도구만**(`get_design_context`/`get_screenshot`/`get_variable_defs`/`get_metadata` — `use_figma` 등 write 도구 제외) + Context7 + `Skill`(frontend-fundamentals 루브릭 로드용) + 승인 직전 실행 레인 선택용 `AskUserQuestion` 최대 1회로 한정된다. 따라서 `/omj` 호출은 소스 코드 부작용이 없고, 결과물인 스펙이 곧 사용자가 승인할 Plan이 된다 — "거의 항상 Plan 모드" 습관과 충돌하지 않는다.

## Phase 0 — 모드 디스패치 (신호 존재 기반, 순서대로)

`$ARGUMENTS`를 아래 순서로 처리한다(LLM 추측 금지 — 각 트랙은 **해당 신호의 존재만으로 독립 결정**한다):

1. **먼저** 인자 끝에 `/`로 시작하는 토큰(예: `/settings/profile`)이 있으면 **떼어내 검증용 route로 기록**만 한다(이 커맨드는 검증을 실행하지 않음). route 토큰이 없으면 Phase 1 코드 탐색에서 대상 컴포넌트가 마운트되는 라우트를 추론해 스펙에 `검증 route(추론): /xxx` 라벨로 기록한다(오추론이 사용자에게 보이도록 라벨 필수, 추론 불가면 공란 — 억지 추측 금지).
2. 남은 인자에 `figma.com` URL이 포함 → **figma 프라이머** 트랙 활성. URL이 아닌 **텍스트 작업 항목**도 함께 있으면 → **dev 프라이머 수집을 병행**한다(두 트랙은 배타가 아니라 **합성** — 각 신호의 존재로 독립 결정). Figma 노드가 5개를 초과하면 스펙 비대·컨텍스트 낭비를 막기 위해 작업 분할을 제안한다.
3. 남은 인자가 (URL 아닌) 텍스트뿐 → **dev 프라이머**.
4. 남은 인자가 **비어 있으면**(route만 줬거나 bare `/omj`) → 아래 "사용법"을 출력하고 종료한다. **빈 스펙을 author하지 않는다.**

- **첨부 이미지 해석**: 대화에 붙여넣은 스크린샷이 있으면 *현재 상태 증거*인지 *기대 디자인*인지 한 줄로 해석해 스펙 Context에 기록한다(해석 규칙 정본은 `omj-fix.md` step 1).
- Figma "Copy as prompt"가 붙이는 보일러플레이트("이 1개의 디자인을 Figma에서 구현하세요" 등)는 작업 항목이 아니다 — 무시한다.

검증(시각 비교)은 이 커맨드가 아니라 별도 커맨드 `/omj-verify`가 담당한다. `verify`/`review` 같은 단어가 작업 설명 안에 있어도 그것은 dev 작업 설명이지 모드 키워드가 아니다.

## Phase 1 — 명세 수집 (read-only)

**figma 프라이머**: 공식 Figma(Dev Mode) MCP로 디자인을 읽는다(읽기 전용).
- `mcp__plugin_figma_figma__get_design_context` — 코드용 구조/레이아웃 명세
- `mcp__plugin_figma_figma__get_screenshot` — 기준 이미지(이후 `/omj-verify` 비교 baseline). 세션 컨텍스트의 이미지는 세션이 끝나면 사라지고 에셋 URL은 약 7일 후 만료되므로, **노드 ID·에셋 URL·수집 시각(captured-at)을 스펙에 기록**한다 — 승인 후 `/omj-verify`가 이 URL로 `.omj/baselines/`에 PNG를 영속화한다(다운로드는 능동 op인 verify/fix 소유, 프라이머는 기록만).
- `mcp__plugin_figma_figma__get_variable_defs` — 디자인 토큰/변수
- `mcp__plugin_figma_figma__get_metadata` — 노드 메타(선택)
- Figma MCP를 쓸 수 없으면(미설치·데스크톱 미연결) **에러로 취급하지 말고** "Figma 미연결 — URL 내용 없이 진행하거나 수동 명세를 받겠다"고 안내(graceful). 뷰어 권한 파일은 변수/노드 접근이 거부된다 — "사본 만들기(Duplicate) 후 사본 URL로 재시도" 안내.
- **figma 공식 스킬과의 역할 경계**: 공식 figma 플러그인의 `figma-design-to-code` 스킬은 `get_design_context` 호출 전 자기 로드를 MANDATORY로 규정하지만, `/omj` 프라이밍은 이를 **알고도 따르지 않는 의도적 결정**이다 — 그 스킬은 구현을 전제하는데 프라이밍은 스펙 작성용 읽기이며, 구현 유도 지침을 로드하면 read-only plan-gate 정체성(PRINCIPLES ①③)이 침식된다. 상류 지침은 **승인 후 구현 단계**(figma-implementer·inline 실행자)가 따른다. 두 스킬이 동시 로드된 세션에서도 역할 분담은 같다: 프라이밍=OMJ, 구현=상류 지침 준수(내용 복제 없음). 이 절은 스킬 **발동 경쟁을 중재하지 않는다** — 그 층은 description 트리거가 담당한다.

**dev 프라이머**: 대상 코드를 읽는다.
- 작업과 관련된 컴포넌트/훅/스타일/타입을 `Glob`·`Grep`·`Read`로 수집해 현재 구조와 재사용 가능한 패턴을 파악한다.

**공통(선택)**: 변경이 Next.js 버전 민감 주제와 관련되면 **`frontend-fundamentals` 스킬의 라우팅 규칙**에 따라 Context7로 `/vercel/next.js` 최신 문서를 조회한다(`resolve-library-id` → `query-docs`). 버전 민감 주제 목록과 vercel/Context7 라우팅의 SoT는 FF 스킬이며, 여기서는 중복 서술하지 않고 위임한다. Context7 부재 시 이 단계 생략(graceful). 레포 루트에 `.omj/fe-context.md`가 있고 `designDocPath`·`contextDocs`가 선언돼 있으면 그 문서들도 `Read`해 브랜드·조합·프로젝트 규칙을 스펙에 반영한다(`decisions:` 목록은 재발 방지 체크로). 반대로 **셋업 흔적이 전혀 없으면**(레포에 `.omj/` 없음 + `~/.claude/.omj-setup.json` 마커 없음) 스펙 말미에 "처음이면 `/omj-setup` 1회 실행 권장(fe-context·훅·의존성 점검)" 한 줄을 포함한다 — 제안만 하고 실행하지 않는다.

## Phase 2 — 구현 스펙 author 후 STOP

수집한 명세로 **구현 스펙**을 작성한다. 스펙은 아래 **uSpec 섹션 분류**로 구조화하고, 각 섹션을 **frontend-fundamentals 4기준(가독성·예측가능성·응집도·결합도) + 접근성**으로 평가한다. 루브릭은 `Skill`로 **frontend-fundamentals 스킬을 invoke**해 그 `references/`를 사용한다. figma 프라이머일 때는 **Figma 충실도 규칙**(`references/figma-fidelity.md` — 원본 텍스트 유지·임의 variant 생성 금지·고정 px 금지·토큰 하드코딩 금지)을 스펙 전 섹션에 적용한다:

1. **Anatomy** — 만들 UI의 요소 분해(어떤 컴포넌트/서브컴포넌트로 구성되는가).
2. **Structure** — 레이아웃·간격·치수·반응형 분기(모바일 우선; 모바일 공유가 중요한 서비스라면 특히 민감). 컴포넌트 너비는 고정 px 대신 `w-full`+부모 padding 제어(`figma-fidelity.md`).
3. **Color / Tokens** — 색·타이포·radius·shadow를 **semantic 토큰으로 매핑**(raw hex·Primitive 직접 사용 금지). 토큰 시스템은 **`references/fe-acceptance.md`의 탐지 순서**(① fe-context `tokensPath` → ② tokens.json 관례 경로 → ③ Tailwind config/`@utility` CSS → ④ CSS 변수)로 찾는다 — **tokens.json 부재는 raw 값 사용의 면죄부가 아니다**: 탐지된 시스템의 시맨틱 클래스/변수로 매핑한다.
4. **Props / Variants** — 컴포넌트 API(props 인터페이스, variant 축). 예측가능성: 이름=동작. 결합도: props drilling 회피. **Figma에 없는 variant를 임의 생성하지 않는다**(`figma-fidelity.md`).
5. **A11y** — alt/라벨/시맨틱 태그/키보드/터치 타깃(VoiceOver·ARIA).
6. **Motion** — 애니메이션이 있으면 `motion`(Motion One) 기준 타임라인/이징.

**구현 acceptance(프로젝트 선언 기반)**: 레포 루트에 **`.omj/fe-context.md`** 가 있으면 거기 선언된 **프로젝트별 acceptance 축**을 스펙의 acceptance 기준에 포함한다. 없으면 보편 FF 기준만 적용한다(graceful). **OMJ는 특정 축(다국어·모드 등)을 강제하지 않는다** — 무엇을 점검할지는 프로젝트가 정한다(범용·오픈소스 친화). 메커니즘 상세: `frontend-fundamentals` `references/fe-acceptance.md`. 반응형·토큰·a11y 등 보편 축은 위 Structure/Color·Tokens/A11y 섹션이 이미 다룬다.

스펙에는 **대상 파일 경로**, **재사용할 기존 함수/컴포넌트**, **적용할 FF/vercel 원칙**, **검증 route**(인자 또는 Phase 0의 추론 — 추론이면 `(추론)` 라벨), **figma 프라이머면 baseline provenance**(노드 ID·에셋 URL·captured-at)를 명시한다.

**과설계 금지**: 함께 바뀔 게 확실할 때만 추상화. 단순 로직을 불필요하게 추상화하거나 일어나지 않을 미래를 위한 깊은 계층을 만들지 않는다(`frontend-fundamentals` "과설계 경고").

**실행 레인 선택 (읽기 전용 핸드오프)**: 스펙 끝에 `## 실행 레인 선택` 섹션을 반드시 추가한다. 라우팅 규칙의 SoT는 `${CLAUDE_PLUGIN_ROOT}/docs/EXECUTION-HANDOFF.md`(레포 기준 `docs/EXECUTION-HANDOFF.md`)이며, 이 파일을 읽을 수 없을 때만 최소 fallback(작으면 inline/manual, 지속 목표면 `$ultragoal` 또는 `/goal` — OMC/OMX가 없으면 `/oh-my-joy:goal-loop`, 병렬 lane이 있으면 `$team`, 순차 완료 압박이면 `$ralph`, 구현 후 hostile QA면 `$ultraqa`, 합의가 더 필요하면 `/oh-my-claudecode:ralplan`·`$ralplan` — 둘 다 없으면 `/oh-my-joy:ralplan`)을 사용한다. 커맨드 본문에는 점수표·임계값을 중복 정의하지 않는다.

레인 선택 질문은 **조건부**다(SoT의 auto-select 규칙): 추천 레인이 `Wrapper=none; Sublane=inline/manual`이면 **묻지 않고** 스펙에 `선택된 레인: Wrapper=none; Sublane=inline/manual (auto)`로 기록만 한다 — Plan 승인이 곧 레인 동의이며, 이견이면 승인 화면에서 plan을 수정하거나 `/omj-start`에서 재선택할 수 있다. 그 외 레인($team/$ultragoal/$ralph/$ralplan/$ultraqa)이 추천이면 스펙 완성 뒤 **정확히 한 번만** `AskUserQuestion`으로 묻는다. 1번 옵션은 항상 결정적 추천값이며 라벨에 `(추천)`을 붙인다. 추천은 `Wrapper`(durable/checkpoint owner: `none`·`/goal`·`$ultragoal`)와 `Sublane`(실행 방식: `inline/manual`·`$ralph`·`$team`)을 분리해 적는다. 구현이 끝난 뒤 QA만 필요한 경우에만 `$ultraqa`를 1번으로 추천하고, 아직 요구·경계·아키텍처 합의가 부족하면 `/oh-my-claudecode:ralplan`/`$ralplan`을 먼저 추천한다(OMX `$ralplan`은 계획 산출 후 정지 — 비대칭 정본: SoT).

최종 스펙에는 선택 결과를 아래 형식으로 남긴다:

```md
## 실행 레인 선택
1. Wrapper: $ultragoal; Sublane: $team (추천) — 여러 문서/커맨드/검증 lane이 분리 가능하고 checkpoint가 필요함.
2. Wrapper: none; Sublane: $ralph — 한 owner가 순차 구현/검증.
3. QA follow-up: $ultraqa — 구현 후 hostile QA/fix 루프.

선택된 레인: Wrapper=<...>; Sublane=<...>          # auto-select 시: Wrapper=none; Sublane=inline/manual (auto)
승인 후 자동 시작이 불가하면: /omj-start <approved-spec-or-plan-path>
```

승인 후에는 두 동작 중 하나만 한다: (a) 현재 런타임이 명시적이고 안전한 handoff surface를 제공하면 선택된 레인을 시작한다, 또는 (b) 자동 시작이 불가하면 정확히 한 줄의 `/omj-start <approved-spec-or-plan-path>`만 출력하고 멈춘다. **`(auto)` 기록된 inline/manual 스펙은 `/omj-start`가 불필요하다** — 승인 즉시 현재 세션이 인라인으로 구현을 진행한다. `/omj`는 구현·빌드·테스트·서브에이전트 위임·숨은 `/goal clear`를 하지 않는다.

작성이 끝나면 **여기서 멈춘다.** 다음을 절대 하지 않는다:
- 코드 파일을 만들거나 수정 (Write/Edit 금지 — allowed-tools에 없음)
- 빌드/테스트/검증 실행
- OMC/OMX worker·executor·team 등에 구현 위임
- active `/goal` 또는 OMC/OMX workflow state를 몰래 clear

> **풀 파이프라인은 Plan 모드를 자동 종료시키지 않는다.** 사용자가 이 스펙을 검토하고 직접 승인(ExitPlanMode)하면, 그 다음부터 구현이 시작된다.

## 승인 후 (이 커맨드의 범위 밖, 참고)

사용자가 스펙을 승인하면 메인 세션이 선택된 실행 레인으로 스펙을 넘긴다. 선택 레인이 이미 스펙에 기록되어 있으면(수동 선택이든 `(auto)`든) 다시 묻지 말고 그대로 사용한다. 자동 시작이 불가하거나 런타임이 불명확하면 `/omj-start <approved-spec-or-plan-path>` 한 줄만 출력한다. 구현이 끝나면 `/oh-my-joy:ff-review`로 코드 diff를(FF·a11y·vercel·nextjs), `/omj-verify <route>`로 시각을 검증한다. (OMC/OMX 실행 도구와 `/goal`/`$ultragoal` 핸드오프 메커니즘은 `${CLAUDE_PLUGIN_ROOT}/docs/EXECUTION-HANDOFF.md`(레포 기준 `docs/EXECUTION-HANDOFF.md`), 통합 플로우는 `${CLAUDE_PLUGIN_ROOT}/docs/OMC-INTEGRATION.md`(레포 기준 `docs/OMC-INTEGRATION.md`) 참고.)

## 사용법 (bare `/omj`)

```
/omj <figma-url> [route]        Figma 디자인 → 구현 스펙(Plan). 예: /omj https://figma.com/design/... /settings/profile
/omj <figma-url> <figma-url> "<작업 설명>"   다중 노드 + 텍스트 작업 혼합도 지원(합성 수집. 노드 5개 초과 시 분할 제안)
/omj "<작업 설명>" [route]       코드 작업 → 구현 스펙(Plan). 예: /omj "검색 입력 폼 컴포넌트" /settings/profile
/omj-start <approved-spec>      승인된 OMJ 스펙을 선택된 OMC/OMX 실행 레인으로 handoff ((auto) inline 스펙은 불필요)
/oh-my-joy:ff-review [--base <ref>]      구현 후 코드 diff 리뷰(FF·a11y·vercel·nextjs, Plan 해제 후 실행)
/omj-verify <route>             구현 후 시각 검증(Plan 해제 후 실행)
/omj-fix <route> ["설명"]        스크린샷+route 결함 수정 루프(Plan 해제 후 실행)
/omj-sync [sync|check|push|extract <figma-url>]   디자인 토큰 code↔Figma (extract: Figma 변수 → CSS custom properties)
/omj-setup                      의존성 점검·설치 가이드 + fe-context/훅 스캐폴딩
```

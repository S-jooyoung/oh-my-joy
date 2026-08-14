# Changelog

이 프로젝트의 모든 주요 변경사항을 이 파일에 기록합니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)을 따르며, 버전 관리는 [Semantic Versioning](https://semver.org/lang/ko/)을 준수합니다.

## [Unreleased]

### Added

- **릴리스 자동화 도입 — `scripts/release.mjs` + `release-tag.yml`** — 컷은 로컬 스크립트(CHANGELOG [Unreleased]→버전 절 확정·빈 골격 재생성·링크 2줄·버전 4표면 리터럴 치환, git 무접촉·산문 무변형·거부 가드 5종·동작 테스트 12건), 태깅은 main 머지 push의 워크플로우("plugin.json 버전 vs 태그 존재" 상태 비교 — 커밋 제목 파싱 배제, 멱등, 태그는 항상 main 커밋에 부착돼 v0.4.0 고아 태그 실패 모드 원천 차단, GitHub Release 자동 발행). keep-a-changelog 6섹션 골격 불변식도 테스트로 봉인. contents:write는 release-tag.yml에만.
- **README(EN/KO)에 "어떤 순서로 뭘 쓰나" 절 신설** — 풀 사이클 분기 서술(흐릿한 아이디어→deep-interview→스펙 paste→선택적 ralplan 합의→승인→실행 레인/goal-loop→검증)이 지금까지 docs/EXECUTION-HANDOFF.md에만 있어 "서술형은 README 정본" 규율과 어긋났다. mermaid 흐름도에도 deep-interview·ralplan·goal-loop을 반영(실행 레인 노드와 OMJ×OMC 표 간 자기모순 해소).

- **범용 딥 인터뷰 커맨드 `/oh-my-joy:deep-interview`** — 모호한 아이디어를 라운드당 1문항 소크라테스식 인터뷰로 명세화하는 read-only 프라이머. 토폴로지 고정(Round 0)·최약 (컴포넌트×차원) 타겟팅·가중 모호도 공식(greenfield/brownfield)·온톨로지 수렴 추적·Restate/Closure 이중 종료 게이트를 갖추고, 산출 스펙은 파일이 아니라 **네이티브 Plan 본문**으로 제시한다(파일화는 승인 후 실행 단계 소유 — read-only 계약 유지). 방법론은 gajae-code·oh-my-claudecode(MIT)에서 차용해 재작성했고 런타임(CLI·tmux·상태 규약)은 이식하지 않았다(`NOTICE.md` 신설). PRINCIPLES ⑧(방법론 흡수 규칙)·⑪(인터뷰 상호작용 클래스) 정본 개정 동반. **풀 사이클 확장 1단계 — 도입 2026-08-13, 도달률 재측정 창(~09-03) 진행 중 시점 기록.**
- **커맨드 네이밍 2축 규칙** — OMJ 고유 FE 루프 동사는 기존 `/omj-*` 접두, 이름 있는 방법론·루브릭 커맨드는 무접두 basename + 테스트 화이트리스트(`WORKFLOW_COMMANDS`) + 문서 표기는 항상 `/oh-my-joy:<name>` 정규 호출. bare 표기(`/deep-interview` 류)는 docs-consistency 테스트가 전 문서 표면에서 차단한다 — 동명의 OMC 스킬·Claude Code 네이티브 커맨드와의 호출 모호성을 문서 수준에서 봉쇄(2-워커 교차 리뷰 수렴안). read-only 커맨드 검사는 Write/Edit에 더해 `Task`/`Agent` 선언도 차단하도록 확장(서브에이전트는 부모 allowed-tools를 상속하지 않으므로).

- **durable 실행 루프 `/oh-my-joy:goal-loop` + `scripts/goal-state.mjs` validator** — 승인된 스펙을 골 단위로 `.omj/goals/<slug>/{brief.md, goals.json, ledger.jsonl}`에 영속시켜 단일 owner가 순차 완주하는 능동 op. 핵심은 강제력의 위치다: 커맨드 allowed-tools에 Write/Edit 없이 validator 스크립트 호출만 사전승인해 **상태 변경 경로를 하나로 좁혔다** — 유효 전이표·단일 active·증거 객체 없는 complete 거부·append-only ledger(잘림 감지)·단조 event_seq·원자적 스냅샷 교체를 스크립트가 검사하고 위반은 non-zero다(2-워커 교차 리뷰 blocker 반영: "프롬프트만 옮기면 형태는 남고 강제력은 사라진다"). 검증 명령은 사전승인하지 않는다 — 매 실행의 권한 프롬프트가 증거의 신뢰 근거(세탁 방지). 동작 테스트(temp dir 정상/불법 전이·truncate·reconcile)와 문서↔스크립트 어휘 드리프트 가드 동반. EXECUTION-HANDOFF에 "OMJ native 레인" 절(우선순위: 런타임 있으면 기존 레인 기본, 없으면 durable 기본값 / auto-select 1회 질문 경계 / 풀 사이클 결합), `/omj-start`에 copyable action 경로, `/omj-setup`에 `.omj/goals/` gitignore 등급 안내 추가. **풀 사이클 확장 2단계 — 도입 2026-08-13(재측정 창 진행 중 기록).**

- **합의 리뷰 커맨드 `/oh-my-joy:ralplan` + `plan-critic` 에이전트** — 이미 존재하는 스펙/플랜을 적대 리뷰로 합의시키는 read-only 커맨드(풀 사이클 확장 3단계·최종). 진입 조건을 "요구가 모호"(그건 deep-interview)가 아니라 "**아티팩트가 이미 있고 설계 이견 위험**"으로 못 박아 두 단계의 함수를 분리했다. v1은 교차 리뷰 수렴대로 Planner 정규화(Drivers·Viable Options ≥2·ADR) → 독립 `plan-critic` 1패스 → 최대 2회 → PLANNING-STUCK(최선 플랜 보존·실행 금지·쟁점 목록)로 축소 — Architect 2차 패스는 고위험 트리거 실측 후. 리뷰어는 빌트인이 아니라 **소유 에이전트 정의**(`agents/plan-critic.md`, `tools: Read, Grep, Glob`)라 도구 표면이 불변식 테스트로 고정된다. 서브에이전트 불가 환경은 순차 critic 패스로 degrade(⑨). **이 PR 자체가 `/oh-my-joy:goal-loop` 자기적용(E2E)으로 구현됐다** — `.omj/goals/pr3-ralplan/` ledger에 골 3건의 시작·완료·증거가 기록됨(gitignore 대상 로컬 산출물이라 PR에는 포함되지 않는다 — 형식은 `tests/goal-state.test.mjs`가 증명).

- **에이전트 도구 계약 불변식** — plan-critic 도구 표면 정확일치(Read·Grep·Glob), design-qa 쓰기 도구 부재, 번들 3종 존재(루프 공허 통과 방지)를 테스트로 고정. ralplan 본문·본 CHANGELOG의 "도구 표면이 불변식 테스트로 고정된다" 주장이 이 시점부터 사실이 된다(감사에서 해당 테스트 부재가 확인됐었다).

### Changed

- **BREAKING: `/omj-review` → `/oh-my-joy:ff-review` 개명 (2026-08-13)** — 사용자 결정으로 "이름 있는 방법론·루브릭 커맨드" 축(무접두 basename + 정규 호출)으로 이동. 기존 호출 `/omj-review [--base <ref>]`는 `/oh-my-joy:ff-review [--base <ref>]`로 바꾸면 된다(인자·동작 동일, 파일만 `commands/ff-review.md`로 이동). ⚠️ 도달률 재측정 창(~09-03) 진행 중의 표면 개명 — 실사용이 확인된 유일한 커맨드였으므로 재측정 리포트 해석 시 이 시점 전후를 분리 집계할 것.
- **배포 모델 성문화** — 마켓플레이스는 태그를 받지 않고 main HEAD를 내려받되 plugin.json `version`이 배포 게이트라는 사실(공식 문서 교차 검증)이 어디에도 문서화돼 있지 않았다. CONTRIBUTING 릴리스 절을 배포 모델+새 자동화 절차(cut→PR→자동 태깅, 수동 git tag 금지)로 전면 개정하고, README(EN/KO) Quick Start에 업데이트 반영 경로(`/plugin update`→`/reload-plugins`) 2줄 추가.
- **read-only 커맨드 검사를 권한 등급 2단으로 분리** — zero-bash(omj·deep-interview·ralplan: Bash 토큰 0 단언 신설)와 report-only(ff-review·omj-verify: 소스 비수정 + 관찰용 스코프 Bash). 기존 검사는 Bash를 아예 보지 않아 "read-only(Write/Edit/Bash 없음)" 주장의 절반이 미고정이었고, omj-verify의 "mutating 능동 op" 자기 선언·CLAUDE.md 정의·테스트 집합이 서로 다른 어휘를 쓰던 충돌도 함께 정합화.
- **FF 스킬 위임 레이어 전부에 graceful 부재 처리 동형화** — 라우팅 SoT(SKILL.md "통합 라우팅 규칙")에서 Context7에만 있던 부재 처리 문구를 vercel 2종·web-design-guidelines에도 추가하고, ff-review의 레이어별 중복 서술은 SoT 위임 1줄로 축약(규칙 조각 분산 해소). ff-review 절차에 Read·Grep·Glob 호출 지점도 명시(헝크만으로 응집도·결합도 오판 방지).
- **FF 스킬 트리거를 FE 한정어로 스코프** — description의 bare "리팩터링"·"코드 리뷰"가 백엔드 코드 리뷰에도 자동 활성될 오발동 여지를 제거. `metadata.version`은 내용 변경 릴리스에만 올리는 독립 semver 규칙을 CONTRIBUTING에 성문화하고 1.1.0으로 상향(1.0.0 고정 방치 해소).
- **검증 하네스 사각 4건 보강** — ① MCP 이중 프리픽스 병기 검사에 역방향(bare→플러그인 변형) 추가(순방향만으론 bare만 선언한 파일이 통과), ② bare 슬래시 표기 검사를 정확 매칭에서 경계 정규식으로(인자 동반·펜스 코드블록 내부 검출), ③ "실재하는 커맨드만 문서화" 검사를 README 한정에서 추적 전 마크다운으로 확장(+v1.1 예고·개명 이력 allowlist), ④ 정본 설치 문자열을 리터럴 대신 manifest에서 조립. CI도 `node --test` 직접 실행에서 `npm test`로 정렬(scripts.test와 결합 유지).

### Deprecated

### Removed

### Fixed

- **deep-interview 실행 브리지에 goal-loop durable 경로 추가** — goal-loop.md·EXECUTION-HANDOFF는 인터뷰 산출물을 goal-loop의 1급 입력으로 명시하는데 정작 브리지가 이 경로를 안내하지 않아, 런타임 없는 사용자가 durable 레인을 안내받지 못하는 SoT 모순이 있었다.
- **README 권한 분류 문장의 신규 커맨드 누락 정정** — read-only 목록에 ralplan, 능동 op 목록에 goal-loop이 빠져 있었다(유일한 권한/모드 분류 문장인데 신규 4종 중 2종 미반영). 커맨드 표에 deep-interview 적합성 게이트·`--threshold`, goal-loop `--slug` 재개 호출형·paste 1급 입력, ralplan 조기 종료, ff-review 무인자 기본 동작을 보강하고 트러블슈팅에 "인터뷰 즉시 종료=게이트"·"goal-loop 권한 프롬프트=의도"·`.omj/goals/` gitignore 3건 추가. argument-hint 플래그의 README(EN/KO) 문서화를 불변식 테스트로 고정.
- **omj-start의 미사용 `Grep` 선언 제거** — 본문 절차에 호출 지점이 없는 도구 선언 금지 규칙(CLAUDE.md) 위반이었다. Read·AskUserQuestion만으로 절차가 완결된다.
- **소비 프로젝트에서 훅 설치 불가 결함** — `/omj-setup`의 훅 복사 절차가 소스 경로를 플러그인 루트 기준으로 지정하지 않아, 소비 프로젝트 cwd에는 없는 `templates/hooks/`를 찾다 실패했다(dogfood 레포에선 cwd==플러그인 루트라 은폐). `${CLAUDE_PLUGIN_ROOT}/templates/hooks/` 병기 + 경로 불변식 테스트로 고정. `cp`·`mkdir`·`claude plugin install` Bash 스코프도 실호출 기준으로 축소.
- **훅 등록 matcher를 스크립트의 `MUTATING_TOOLS` 4종과 일치** — 설치 절차의 `Edit|Write` matcher가 스크립트 필터(Edit·Write·MultiEdit·NotebookEdit)보다 좁아 MultiEdit 저장이 훅을 조용히 우회했다.
- **훅 fail-open 구멍 봉합** — 두 훅의 fe-context 판독이 try/catch 밖에 있어 판독 불가(디렉터리·권한) 시 uncaught exception이 exit 1로 새어 "검사만, exit 0" 계약이 깨졌다. try/catch로 no-op 처리 + 계약 테스트 2건.
- **`$schema`가 404 URL을 가리키던 문제** — plugin.json·marketplace.json의 anthropic.com 스키마 URL은 실측 404라 테스트가 주장하던 "에디터 검증" 효과가 공허했다. SchemaStore 등재본(실측 200)으로 교체하고 테스트를 존재 검사에서 정본 URL 리터럴 고정으로 강화.
- **풀 사이클 문서 드리프트 일괄 정정** — PR-2·PR-3(goal-loop·ralplan)가 코드만 넣고 원리 문서를 못 따라가게 한 드리프트: ① PRINCIPLES ⑦(KO/EN)의 "durable은 복제하지 않는다" 단정을 "런타임 있으면 handoff 기본, 부재 시 ⑧ 흡수 규칙의 OMJ native 레인이 기본값 — 런타임이 있어도 증거 강제 완료 목적이면 명시 선택 가능한 상시 축"으로 조건화해 EXECUTION-HANDOFF와의 SoT 충돌 해소, ② PRINCIPLES.en.md에 goal-loop·ralplan·plan-critic 반영(기각 대안 자기모순 해소 포함), ③ README(EN/KO) 에이전트 절에 plan-critic 추가·"(v0.3.0)" 스테일 라벨 제거·"에이전트 2종"→3종, ④ OMC-INTEGRATION에 OMJ native 풀 사이클 3종 반영, ⑤ CONTRIBUTING 릴리스 절차를 버전 4표면으로 정정(절차대로 2표면만 올리면 테스트가 실패했다), ⑥ PR 템플릿에 PRINCIPLES.en.md 동반 갱신 항목.
- **NOTICE 상대링크 3곳(deep-interview·goal-loop·ralplan)에 런타임 경로 병기** — 설치된 플러그인 프롬프트에선 상대링크가 소비 프로젝트 cwd 기준으로 해석되므로 `${CLAUDE_PLUGIN_ROOT}/NOTICE.md`를 함께 표기(GitHub 렌더링용 상대링크는 유지).
- **design-qa description에 비트리거 절 추가** — 번들 3종 중 유일하게 "어떤 요청은 이 에이전트가 아니다" 서술이 없어 자동위임 오발동 여지가 있었다. 질적 리뷰(ff-review)·수정 루프(omj-fix)와의 경계를 명시.
- **goal-state init 원자화** — 최종 경로에 단계별로 쓰던 init은 중간 크래시 잔해가 경로를 점유해 재init·타 동사·reconcile 전부가 거부하는 복구 불능 상태를 만들 수 있었다. temp 디렉터리에 완성 후 rename하는 원자 이동으로 교체(writeSnapshot과 같은 계약을 init 전체로 확장, 직렬화·스탬프는 appendEvent/writeSnapshot 단일 경로 재사용). 다른 pid가 남긴 `.tmp-` 잔해 청소와 실패 시 자체 정리 포함. CLI·파일 계약은 불변.
- **goal-loop의 Task 비선언이 의도임을 본문에 성문화** — 본문이 서브에이전트 소집을 지시하면서 allowed-tools에 Task가 없는 것이 결함처럼 읽혔다. 소집 시 권한 프롬프트가 확인 지점이라는 근거(PRINCIPLES ③)를 블록쿼트로 명시(ralplan의 critic 소집 단계에도 동일 블록쿼트로 대칭화). 에이전트 `model` 필드 미지정=세션 모델 상속 의도도 CLAUDE.md에 성문화.

### Security

- **`Bash(command:*)` 사전승인 제거** — `command`는 인자를 그대로 실행하는 셸 builtin이라 이 스코프는 사실상 bare Bash였다(스코프 문법을 쓰고도 임의 실행을 승인하는 세탁 경로). 3개 커맨드(omj-verify·omj-fix·omj-setup)를 실호출인 `Bash(command -v:*)`로 축소하고, prefix 전체가 실행 위임 builtin·인터프리터·위임 플래그로만 이뤄진 선언(`Bash(sh -c:*)`·`Bash(npx:*)` 포함)을 휴리스틱 불변식 테스트로 차단(샌드박스가 아니라 리뷰 가시권 게이트 — 한계는 테스트 주석에 명시). Bash 호출지점 검사도 substring에서 단어 경계 정규식으로 강화 — 한국어 산문의 우연 일치로 공허 통과하던 구멍 봉합.
- **goal-state `--brief-file` 절대경로 가드의 win32 구멍 봉합** — 기존 가드가 POSIX 전용(`/` 시작)이라 Windows 드라이브(`C:\…`·`C:/…`)·UNC(`\\srv\…`) 절대경로와 백슬래시 traversal이 통과해, 사전승인 Bash 규칙 아래 임의 파일 읽기가 가능했다. `path.win32.isAbsolute` 병용 + 거부 케이스 4종 테스트.

## [0.5.0] - 2026-08-06

> **도달률 릴리스.** 31일 dogfood 마이닝(세션 로그 118개·소비 레포 git 66커밋·OMX 336커밋·.omc 아티팩트 21편)이 "품질이 아니라 도달률 문제"를 실증했다 — 호출된 커맨드는 마찰 없이 동작했지만 침투율 6.8%, 커맨드 7개 중 5개 사용 0회, 플래그십 루프(스크린샷 62장/24세션)가 전부 플러그인 밖에서 수동으로 돌았다. 이 릴리스는 기능 추가가 아니라 **도달 경로**를 고친다: 트리거 재작성·온보딩 자동 제안·라우팅 drift 정정·조용한 오검증 차단. 전 변경이 근거 로그와 ralplan 합의(Planner→Architect→Critic, 게이트 선행)를 거쳤고, 배포 전 불변식 테스트 2종과 격리 클론 스모크를 통과했다.

### Added

- **figma 공식 스킬과의 역할 경계 명문화** — `/omj` Phase 1에 경계 1절: 상류 `figma-design-to-code` 스킬이 `get_design_context` 호출 전 로드를 MANDATORY로 규정하지만, 프라이밍은 이를 **알고도 따르지 않는 의도적 결정**이다(그 스킬은 구현 전제 — read-only plan-gate 정체성 침식). 상류 지침은 승인 후 구현 단계가 따른다. 트리거 재작성으로 라우팅 경쟁에 들어간 뒤 동시 로드(마이닝 관측 6회) 시 역할 경계가 미정의였던 갭을 해소 — 단, 이 절은 발동 경쟁 자체를 중재하지 않는다(그 층은 description 담당). PRINCIPLES ③(+en)에 "버그가 아니라 결정" 명문화.
- **도구 선언 불변식 테스트 2종** — 같은 결함 클래스 3회 재발 후 ralplan 합의로 도입. (a) 플러그인 경유 MCP 선언(`mcp__plugin_<plugin>_<server>__*`)에 bare 서버 변형 병기 강제, (b) `Bash(…)` 선언의 명령 문자열이 frontmatter 제외 본문에 존재하는지 검증(언급 기반 게이트임을 주석 명시). 도입 시점에 실제로 잔존 결함 3건을 검출했다 — `omj-review`·`omj-fix`의 bare `mcp__context7__*` 누락(직전 이중 프리픽스 수정이 3/5 지점만 커버), `omj-setup`의 `Bash(mkdir:*)` 호출 지점 부재(→ 훅 설치 절차에 `mkdir -p .claude/hooks` 성문화). 셋 다 수정 후 149 테스트 통과.
- **`/omj-verify` 도달 라우트 검증 필수화** — 캡처를 증거로 쓰기 전에 현재 페이지가 요청한 `$ROUTE`에 실제 도달했는지 확인하고, 인증 리다이렉트 화면이면 비교하지 않고 "예상 라우트 미도달"을 실패로 보고한다. dogfood 마이닝 Phase C에서 인증 게이트 라우트 캡처가 3개 레포에서 실패했고(스킵/오검증/우회 제각각) 리다이렉트된 화면을 찍고 통과시킬 뻔한 실사례가 있었다 — 잘못된 결과를 자신 있게 보고하는 유일한 실패 모드를 차단한다. fe-context `verifySetup` 주석에 쿠키 주입·가드 목킹 옵션을 명시.

### Changed

- **`/omj-setup` 온보딩 개편 — 도달률 개선** — dogfood 마이닝에서 setup 실행 0회가 fe-context·훅 미설치의 연쇄 원인으로 확인됐다(Phase D). 네 가지를 바꾼다: ① `/omj`가 셋업 흔적 없음을 감지하면 스펙 말미에 1회 제안(자동 실행 아님), ② 누락 항목별 개별 질문을 **한 번의 multiSelect 일괄 선택**으로 교체(PRINCIPLES ⑪), ③ fe-context 스캐폴딩 전에 기존 규칙 문서(`AGENTS.md`·`.claude/rules/`·copilot-instructions)를 탐지해 **`contextDocs:` 참조-채택을 우선**(내용 복제 금지 — 실측에서 fe-context가 겨냥한 정보는 이미 이런 파일들로 존재했고, 리뷰 정확도를 올린 건 과거 결정 목록이라 `decisions:` 필드도 신설), ④ 마무리에 **GitHub star opt-in**(이미 starred면 무프롬프트 스킵, silent fail, gh 부재 시 URL 안내 — OMC omc-setup 패턴, 사용자 지시). `gh` Bash 권한은 star 호출 지점에 맞춘 최소 prefix(`gh auth status`·`gh api user/starred/S-jooyoung/oh-my-joy`)로만 선언.
- **`check-story-exists` 훅 제안 조건화** — Storybook 신호(`.storybook/`·`@storybook/*` 의존성·`*.stories.*`)가 감지될 때만 설치 선택지에 넣는다. 훅 자체는 fe-context 미선언 시 no-op이라 안전했지만, 대상 관행이 없는 프로젝트에 제안하는 것 자체가 노이즈였다(31일 실측에서 Storybook 실질 언급 0회). 범용 플러그인이므로 기능 제거가 아니라 제안 조건화로 처리.
- **`/omj`·`/omj-fix` 트리거 재작성 — 도달률 개선** — dogfood 마이닝 결과 31일간 OMJ 침투율 6.8%, Figma Dev Mode 붙여넣기 22건 중 OMJ 도달 7건(전부 수동 타이핑), 스크린샷+시각 결함 서술 37턴에 `/omj-fix` 사용 0회. 원인은 기능이 아니라 진입 경로 — 공식 figma 스킬은 붙여넣기 문구에 auto-trigger로 붙는데 OMJ description은 그 패턴을 담지 않았다. 두 커맨드의 description을 실관측 트리거(figma.com 링크·"이 디자인 구현해줘"·스크린샷+정렬/잘림/간격/색 불만)에 맞춰 재작성하고 README(EN/KO)에 자동 발동 안내를 추가.

### Deprecated

### Removed

### Fixed

- **figma/context7 MCP 사전승인이 플러그인 설치 경로 이름에만 의존하던 문제** — 소비자가 Figma MCP를 raw로 등록하면(`claude mcp add figma`) 도구명이 `mcp__figma__*`가 되어 커맨드 사전승인이 풀리고 `figma-implementer`는 도구를 아예 잃었다. v0.4.0이 playwright 폴백에 적용한 이중 선언("설치 출처에 따라 이름이 달라진다")을 figma·context7에도 적용 — `commands/omj.md`·`commands/omj-sync.md`·`agents/figma-implementer.md`에 bare 변형 병기. 플러그인 구성 점검(plugin-validator)에서 발견.
- `marketplace.json`의 "개인 프론트엔드 플러그인" 문구를 범용 서술로 정정 — 도메인 중립 원칙과 어긋나는 잔재였다.
- **OMX `$ralplan` 드리프트 정정** — OMX가 합의 레인에 호스트 영수증 게이트를 도입해(ADR 3212 계열) `$ralplan`이 **계획 산출 후 정지**(fail-closed)하게 됐는데, OMJ 문서 전반이 `/ralplan`/`$ralplan`을 한 쌍의 "합의 후 실행 연결 레인"으로 서술하고 있었다 — selector가 이를 추천하면 사용자는 blocker만 받는다. 라우팅 SoT(`docs/EXECUTION-HANDOFF.md`)에 런타임 비대칭을 명시하고, OMC-INTEGRATION·PRINCIPLES·README(EN/KO)·CLAUDE.md·`commands/omj.md`·`commands/omj-start.md`는 요약/링크로 정리. 근거: dogfood 마이닝 Phase A(`.omc/research/omj-dogfood-mining-2026-08.md`).
- README(EN/KO) 계획 행의 `/omc-plan` 표기 정정 — OMC에 그 커맨드는 존재하지 않는다(계획 진입점은 skill `/oh-my-claudecode:plan`).
- Syntax map의 `$team`/`omx team`에 런타임 표면 단서 추가 — Codex App·tmux 밖 세션에서는 직접 제시하지 않는다(shell에서 OMX CLI 선기동).
- `/omj-start`의 OMX direct launch를 2단계 CLI로 정정 — `create-goals`는 goal **생성만** 하므로(시작은 `complete-goals`), 생성 후 최종 copyable action을 `omx ultragoal complete-goals`로 출력한다. 기존 계약은 goal만 만들고 아무것도 실행되지 않은 상태로 사용자를 남겼다.

### Security

- `/omj-start`의 `Bash(git status:*)` 선언 제거 — 본문 절차에 호출 지점이 없었다("호출 지점 없는 도구는 선언하지 않는다" 규칙 정합). `/omj-fix`의 `git status`/`git diff`는 반대로 본문 step 6에 호출 지점을 성문화.
- `/omj-setup`의 gh star 권한을 `:*` prefix에서 **정확 매칭 2개**로 분리(`gh api user/starred/S-jooyoung/oh-my-joy` + 동일 경로 `-X PUT`) — 기존 와일드카드는 호출 지점이 없는 `-X DELETE`(unstar)까지 사전승인했다.

## [0.4.0] - 2026-07-27

> 레포를 6개 축(훅 코드 정확성 · 문서 SoT 정합 · 플러그인 스펙 준수 · 최소권한/주입 표면 · 외부 관점 · 번들 지식 정확성)으로 감사하고, 각 발견을 파일 근거로 적대적 검증한 뒤 확인된 것만 반영한 릴리스. **핵심은 "선언한 것을 실제로 강제하는 층을 만든 것"** — 문서가 주장하던 안전 속성(최소권한·read-only·zero-hook·EN/KO 패리티) 중 상당수가 산문일 뿐이었고, 이제는 매니페스트와 테스트가 강제한다. 강제할 수 없는 부분은 과장을 걷어내 실제 동작대로 다시 적었다.

### Added

- **검증 하네스** — `node --test` 기반 무의존성 테스트 스위트(`tests/`). 훅 스크립트를 실제 자식 프로세스로 띄워 PostToolUse 계약(stdin JSON → stdout JSON → exit code)을 경계에서 검증한다. `package.json`은 `private: true`인 dev 전용이며 플러그인 런타임 의존성은 여전히 0개다.
- `docs/PRINCIPLES.en.md` — 11개 설계 원리를 `문제 / 결정 / 버린 대안` 3열 표로 요약한 영문 페이지. 설계 문서 3종이 전부 한국어라 이 레포의 유일한 심층 콘텐츠가 영어 사용자에게 통째로 불투명했다. **정본은 여전히 `PRINCIPLES.md`**이며, 드리프트를 막기 위해 CLAUDE.md 문서화 규율에 "원리 변경 시 요약표의 해당 행도 같은 커밋에서 갱신"을 편입했다.
- `CONTRIBUTING.md`·`.github/PULL_REQUEST_TEMPLATE.md` — 레포의 실제 규율(zero-hook 불변식·최소권한·EN/KO README 동시 갱신·AI 서명 금지)을 외부에서 재현 가능한 형태로 성문화.
- `references/boundaries.md` 신설 — React 19/App Router 코드 품질의 최대 축인 **Server/Client 경계·에러 경계·테스트 가능성**이 번들된 지식에 전혀 없었고, 유일한 처리 방식이 "선택적으로 스킵 가능한" Context7 위임이라 실질적으로 무루브릭이었다. 직렬화·Suspense 스트리밍처럼 `vercel-react-best-practices`가 소유한 지식은 복제하지 않고 링크만 둔다(⑧ SoT 단일화) — 이 문서는 "어디에 선을 긋는가"만 다룬다.
- `references/a11y.md`에 WCAG 2.2 핵심 축 4개 추가 — **색 대비**(SC 1.4.3/1.4.11), **포커스 가시성**(2.4.7/2.4.11, `outline:none` 시 `:focus-visible` 필수), **모션 축소**(2.3.3, `prefers-reduced-motion`), **폼 에러 안내**(3.3.1/3.3.3, `aria-invalid`+`aria-describedby`+`role="alert"`). 실무 a11y 리뷰의 최빈 결함군이 통째로 루브릭에서 빠져 있었다.
- **CI**(`.github/workflows/ci.yml`) — push·PR마다 Node 20·22·24에서 검증 스위트를 실행한다. 훅 스크립트는 플러그인 레포가 아니라 소비 프로젝트의 Node에서 돌아가므로, `engines` 하한(20)을 버리지 않고 현재 유지되는 LTS 라인(22 maintenance·24 active)을 함께 검증한다. 의존성 설치 단계가 없다.
- **매니페스트·문서 정합성 자동 검증** — CLAUDE.md의 "문서화 규율"을 사람의 성실성이 아니라 기계가 강제한다: plugin/marketplace 스키마와 버전 일치, 커맨드·에이전트·스킬 frontmatter 유효성, **`hooks.json` 부재(zero-hook 불변식)**, README EN/KO 패리티와 설치 문자열 동일성, 영문 README의 한국어 잔재, CHANGELOG 릴리스 링크 정의, 전 마크다운의 상대 링크 무결성, README↔`commands/` 목록 일치, CLAUDE.md 120줄 상한.
- 훅 인라인 억제 주석 `omj-allow-color` — 외부 SDK 고정색처럼 정당한 raw 값이 있는 줄의 경고를 끈다(eslint-disable-line과 같은 역할). 구문만으로는 색상과 식별자를 구분할 수 없는 잔여 오탐의 탈출구.
- 훅이 `tool_name`을 확인해 변경 도구(`Edit`/`Write`/`MultiEdit`/`NotebookEdit`)에서만 발화한다 — 소비 프로젝트의 matcher가 넓어져도 읽기 도구에서 침묵하는 방어층.
- `.omj/fe-context.md`에 `storiesDir:` 선언 추가(선택) — Story를 형제 파일이 아니라 별도 디렉터리에 모으는 프로젝트를 `check-story-exists.mjs`가 지원한다. 축은 여전히 프로젝트가 선언한다(PRINCIPLES ⑩). 포맷 정본은 `references/fe-acceptance.md`.

### Fixed

- `check-design-tokens.mjs` — **탐지 신호/노이즈 역전 해소**. 실측에서 이 훅은 오탐 4건을 보고하면서 같은 파일의 진짜 하드코딩 2건을 놓쳤다. (a) `url(#gradient)`·`href="#section"`·private field `this.#abc`·5·7자리 hex를 색상으로 오인하던 것을 제거하고, (b) 블록·JSX(`{/* */}`)·인라인 `//` 주석을 라인 수 보존 방식으로 마스킹하며, (c) Tailwind v4/shadcn 생태계의 주 문법인 `hsl()`·`oklch()`·`hwb()`·`lab()`·`lch()`와 CSS 선언 위치의 네임드 컬러를 새로 탐지한다. `hsl(var(--h) …)`처럼 `var()`로 감싼 호출은 토큰 사용이므로 위반이 아니다.
- `check-design-tokens.mjs` — 검사 대상에 `.ts`/`.scss`/`.sass`/`.less` 추가(CSS-in-JS 테마 객체와 SCSS가 빠져 있었다). 경고 개수를 라인 수가 아닌 **실제 색상 개수**로 집계. 경로 해석 기준점을 훅 계약이 준 `cwd`로 통일(`path.resolve(filePath)`는 훅 프로세스 cwd를 써서 상대경로 입력 시 검사가 조용히 스킵됐다). 프로젝트 루트 밖 파일은 읽지 않는다.
- **`allowed-tools`의 강제 수준을 과장하던 서술 정정** — `docs/PRINCIPLES.md` ③이 "쓰기 경로 자체가 없으니 plan-gate를 우회할 방법도 원천적으로 사라진다"고 단언했지만, `allowed-tools`는 하드 차단이 아니라 **사전승인 목록**이다(목록에 없는 도구는 권한 프롬프트로 드러난다 — 같은 레포의 `/omj-start` 항목이 바로 그 성질에 기대고 있다). 하드 차단은 Plan 모드가 담당한다. 정본·README(EN/KO)·영문 요약표를 "조용한 쓰기가 불가능하다"는 정확한 서술로 통일.
- `docs/EXECUTION-HANDOFF.md`가 "레인 선택 규칙을 중복 정의하지 않는다"고 선언하면서 `commands/omj.md`는 SoT 도달 불가 시의 fallback 매핑을 갖고 있어 문서가 스스로를 위반했다 — **임계값은 SoT에만, fallback은 방향만**이라는 경계를 명시해 해소(graceful degradation과 SoT 단일화의 교차점).
- **playwright MCP 폴백이 권한 선언에 없어 실제로 호출 불가였다** — v0.3.0이 대표 기능으로 광고한 폴백인데 `/omj-verify`·`/omj-fix`의 `allowed-tools`에 어떤 playwright MCP 도구도 없었다. 두 커맨드에 `mcp__playwright__*`와 플러그인 프리픽스 변형을 함께 선언한다(설치 출처에 따라 이름이 달라진다).
- `/omj-sync check`를 "read-only라 어느 모드에서든 안전"하다고 단언하던 문구 정정 — `allowed-tools`는 커맨드 단위라 check 실행 세션도 `Edit`/`Write`/`use_figma` 권한을 그대로 들고 있다. read-only 보장의 강제층이 권한이 아니라 본문 규율임을 명시한다.
- `/omj-sync`의 토큰 탐지 SoT 인용이 4단계 중 2단계만 옮겨 적어 CSS/Tailwind 기반 스토어가 누락됐다 — 나열을 지우고 SoT로 위임하되, sync/push/extract가 **파일 기반 스토어만** 대상으로 한다는 경계를 명시(`fe-acceptance.md`와 정합).
- **설치 문자열이 작성자 로컬 경로를 가리키던 문제** — README(EN/KO)의 Quick Start 1행이 `~/projects/oh-my-joy`라 공개 레포를 클론한 누구도 설치할 수 없었다(작성자 머신에서조차 실제 경로와 불일치). `/plugin marketplace add S-jooyoung/oh-my-joy`로 정정.
- CHANGELOG 릴리스 링크 — `[0.3.0]` 링크 정의가 없어 GitHub에서 리터럴로 렌더됐고, `[Unreleased]`가 한 단계 옛 버전(v0.2.0)을 기준으로 비교해 0.3.0 변경분이 Unreleased로 잡혔다. 두 항목 모두 정정.
- 커맨드 본문의 SoT 포인터가 `[텍스트](${CLAUDE_PLUGIN_ROOT}/docs/…)` 형태의 마크다운 링크라 GitHub에서 404가 됐다 — 런타임 경로 문자열은 유지하고 링크 마크업만 벗겨 레포 기준 경로를 병기한다.
- 영문 README에 한국어 `(추천)`이 설명 없이 노출됐다. 라벨 리터럴은 출력 계약(`docs/EXECUTION-HANDOFF.md`)이 고정한 값이라 유지하고, 영어 설명을 병기한다.
- `plugin.json`에 `$schema` 선언 추가 — `marketplace.json`만 스키마가 걸려 있어 에디터 검증이 한쪽에만 적용됐다.
- **FF 스킬의 도메인 중립성 위반 제거** — 범용 FE 품질 가이드를 표방하면서 특정 개인 프로젝트 스택의 잔재가 남아 있었다(같은 레포가 선언한 도메인 중립 원칙과 정면 충돌). `yarn build`→프로젝트 빌드 스크립트, shadcn 고유 컴포넌트·props(`DialogContent`/`showCloseButton`/`FormField`)→접근성 프리미티브 라이브러리 일반 서술, Supabase RLS(`auth.uid()`)→"인가 계층이 권한 부족을 0행으로 돌려주는" 일반 증상으로 치환.
- `references/a11y.md` alt 예제가 컴파일되지 않는 코드였다 — `next/image`는 `alt`를 필수 prop으로 강제하므로 "alt 누락" Before는 타입 에러다. 컴파일되면서 실제로 잘못된 케이스(무의미한 `alt="image"`, 정보성 이미지를 `alt=""`로 오분류)로 교체하고, 판정 기준을 alt **존재**에서 alt **적절성**으로 옮겼다.
- `references/bundling-debug.md`의 코드 스플리팅 예제에 `import dynamic from 'next/dynamic'` 누락 — 그대로 붙여넣으면 동작하지 않는 스니펫이었다. `ssr: false`가 Server Component에서 불가하다는 주석도 병기.
- 위임 대상 스킬을 "58규칙"으로 인용하던 것을 수치 없는 표현으로 교체(SKILL.md·bundling-debug.md) — 상류 규칙 수는 바뀌므로 인용 자체가 드리프트 원천이다. 대신 `package.json`의 `react`/`next` 버전으로 **어느 절을 적용할지만** 정하는 버전 게이팅 규칙을 추가(규칙 내용은 복제하지 않음).
- `check-story-exists.mjs` — **Story 대상이 아닌 파일에서 상시 발화하던 문제 해소**. (a) 제외 판정을 전체 경로가 아닌 **파일명 기준**으로 바꾸고 Next.js App Router 예약 파일(`page`·`layout`·`template`·`loading`·`error`·`not-found`·`route`·`default`·`middleware` 등)을 제외한다. (b) `Button/index.tsx` 배럴 패턴에서 형제 `Button.stories.tsx`를 인정하도록 디렉터리명을 후보에 추가(가장 흔한 배치인데 100% 오탐이었다). (c) 소문자로 시작하는 파일은 훅·유틸 관례로 보고 검사하지 않는다. (d) 도달 불가능하던 `\.d\.ts$` 죽은 분기 제거(선행 `.tsx|.jsx` 게이트가 먼저 탈락시킨다). (e) 경로 기준점을 `cwd`로 통일하고, 읽을 수 없는 디렉터리는 "Story 없음"으로 단정하지 않는다.

### Security

- **`/omj-start`의 safe-path 가드가 산문일 뿐이었다** — 본문이 4개 조건을 규정하는 동안 `allowed-tools`의 `Bash(omx ultragoal create-goals:*)` 와일드카드가 그 prefix 뒤 **모든 인자**를 사전승인해, 가드가 한 겹도 강제되지 않았다. 해당 권한 선언을 제거해 직접 launch 시 권한 프롬프트가 실제 확인 게이트가 되게 한다(PRINCIPLES ③의 일관 적용 — 직접 launch 자체는 `docs/EXECUTION-HANDOFF.md`가 정의한 의도된 설계라 유지).
- `/omj-start` safe-path 규칙에 **경로 봉쇄** 추가 — 기존 패턴은 shell metacharacter만 막고 *어떤 파일을 가리키는지*는 통제하지 않아 절대경로·`..` traversal이 그대로 통과했다. 새 셸 권한 없이 문자열만으로 검사 가능한 조건(절대경로 금지·`..` 금지·`.md` 확장자)을 추가.
- `/omj-setup` 최소권한 정합화 — 본문에 호출 지점이 없는 `Bash(node:*)`·`Bash(jq:*)`·`Bash(ls:*)` 제거. 특히 `Bash(node:*)`는 `node -e "<임의 코드>"`를 사전승인하는 사실상의 임의 코드 실행 권한이었다(훅 등록은 문자열 `Write`이지 실행이 아니라 제거해도 영향 없음). `Bash(npm:*)`→`Bash(npm i -g playwright-cli:*)`, `Bash(claude:*)`→`Bash(claude plugin list:*)`+`Bash(claude plugin install:*)`로 축소.
- `/omj-fix` 커밋 스테이징 범위 하드 규칙 — step 4에서 `Edit`한 경로만 명시 스테이징하고 `git add -A`·`git add .`를 금지한다. `--commit` 없이 호출되면 git 계열을 아예 실행하지 않는다.
- `/omj-verify` 인자 검증 규칙 추가 — `ROUTE`·`BASE`는 사용자 입력이 셸에 들어가는 유일한 지점인데 아무 검증 없이 치환하도록 지시하고 있었다(`/omj-start`만 safe-input 계약을 갖고 있어 커맨드 간 태세가 불일치했다). 치환 전 형식 확인 + 항상 큰따옴표 변수 참조로 사용.
- **자격증명·인증 화면 유출 가드** — `JOY_TEST_EMAIL`/`JOY_TEST_PASSWORD`로 실제 로그인을 수행하면서 경고가 레포 전체에 한 줄도 없었다. `fill`에는 변수 참조만 넘기고 값을 리포트에 적지 않기, 테스트 전용 계정 사용, 인증 후 스크린샷의 baseline 영속화 고지, `.omj/baselines/` gitignore 필수화를 명문화(README EN/KO 동기화).
- `agents/design-qa.md`에 **강제 수준 고지** 추가 — `Edit`/`Write` 미부여는 도구 층 강제지만 스코프 없는 `Bash`가 있어 "`--fix` 금지"는 프롬프트 수준 규율일 뿐임을 명시하고, 기계적 강제가 필요할 때의 대안(`/omj-review` 또는 `permissions.deny`)을 안내한다.

## [0.3.0] - 2026-07-14

> 실사용 dogfood(ahmotravelReact `/omj` 풀 사이클) 피드백 + 디자인 시스템 하네스 스펙 흡수 + 플러그인 구조·사용 감사 결과를 ralplan 합의(Planner→Architect→Critic 3라운드)로 확정해 반영한 릴리스.

### Added

- `/omj-start` — 승인된 OMJ 스펙을 OMC/OMX 실행 레인으로 넘기는 canonical fallback handoff command. `/omj`가 이미 선택한 lane이 있으면(수동이든 `(auto)`든) 다시 묻지 않고, 직접 시작이 불확실하면 copyable action 한 줄만 출력한다.
- `docs/EXECUTION-HANDOFF.md` — `/omj` 실행 레인 selector의 단일 SoT. Wrapper(`/goal`/`$ultragoal`)와 Sublane(`/team`/`$team`, `/ralph`/`$ralph`) 분리, option 1 `(추천)` 출력 계약, `/goal clear` 안전 규칙 + **auto-select 규칙**(추천이 `Wrapper=none; Sublane=inline/manual`일 때만 질문 생략·`(auto)` 기록, Plan 승인=레인 동의 — 무거운 레인은 항상 1회 질문. 실사용에서 관측된 "레인 질문+Plan 승인 이중 인터럽트" 해소, PRINCIPLES ⑪ 정합).
- `skills/frontend-fundamentals/references/figma-fidelity.md` — design→code 보편 규칙 신설(원본 텍스트 유지·Figma에 없는 variant 임의 생성 금지·고정 px 너비 금지(w-full+부모 padding)·토큰 하드코딩 금지). `/omj` Phase 2가 처방, `/omj-review`·`design-qa`가 검증(같은 SoT).
- `agents/figma-implementer.md` — 승인된 OMJ 스펙 전담 구현 에이전트(Clarify→Context→Plan→Generate→Evaluate 5단계, Figma 읽기 4도구, 실패 2회 재시도 후 보고). **호출 계약**: 스펙 없는 bare Figma URL은 구현 거부 + `/omj` 안내(plan-gate 우회 차단). 레인이 아니라 inline 레인이 쓰는 실행자 — EXECUTION-HANDOFF(라우팅 SoT)·selector에는 미등장, OMC/OMX 레인 우선.
- `agents/design-qa.md` — 기계 점검 게이트(타입체크·린트(--fix 금지)·토큰 하드코딩 grep·Figma 충실도·a11y 기본 + fe-context 선언 시에만 Story·i18n 체크). 계약: "소스·설정 비수정 능동 op"(검사만, 수정 없음).
- `templates/hooks/check-design-tokens.mjs`·`check-story-exists.mjs` — 토큰 하드코딩/Story 누락 경고 훅 스크립트(Node, 크로스플랫폼). **플러그인은 hooks.json을 두지 않아 스스로 발화하지 않는다**(zero-hook 유지) — `/omj-setup`이 소비 프로젝트 `.claude/hooks/`로 **복사-설치**할 때만 동작(참조-등록은 소비 settings.json의 `${CLAUDE_PLUGIN_ROOT}` 미해석·플러그인 캐시 버전 경로 파손 때문에 불가). fe-context 선언 없으면 no-op 이중 안전.
- `/omj-sync extract <figma-url>` — Figma 변수 → CSS custom properties 부트스트랩 모드(`/`→`-` 변환, primitive→semantic `var()` 참조 유지, 컬렉션별 파일 분리, `docs/design-tokens.md` 매핑 테이블). 기존 파일 덮어쓰기는 AskUserQuestion 가드.
- `.omj/baselines/` 규약 — `/omj-verify`·`/omj-fix`가 Figma 에셋을 `<route-slug>@<viewport>.png`로 영속화(`curl -f --remove-on-error`, 0-byte 잔존 방지)해 크로스세션 시각 비교를 가능하게 함. slug 변환 규칙 명문화. provenance(노드ID·에셋URL·captured-at)는 스펙 문서가 SoT(sidecar JSON은 verify 권한상 저장 불가로 기각).

### Changed

- `/omj` — 실행 레인 질문을 "정확히 1회" → "**최대 1회**"(auto-select 시 생략)로 조건화. Phase 0 디스패치를 figma/dev 이분법 → **신호 존재 기반 합성**(figma URL+텍스트 작업 혼합 시 양 트랙 병행, 노드 5개 초과 분할 제안, 첨부 이미지 해석 기록, Figma 'Copy as prompt' 보일러플레이트 무시)으로 확장. route 인자 부재 시 코드 탐색으로 **추론 기록**(`검증 route(추론):` 라벨). Color/Tokens의 토큰 탐지를 fe-acceptance.md SoT로 위임("tokens.json 부재 ≠ raw hex 면죄부"). figma 프라이머 시 baseline provenance 기록.
- `/omj-verify` — **allowed-tools에 `Read` 추가**(스펙 URL 판독·baseline PNG 비전 로드에 필수 — 없으면 baseline 비교 자체가 불가). 비교 기준 3단계화(①세션 컨텍스트 → ②`.omj/baselines/` 온디스크 PNG → ③구조 점검만). **playwright MCP 폴백** 신설(playwright-cli 부재 시 — 사용 감사에서 30일간 verify 호출 0회의 구조적 원인이 도구 불일치로 확인됨). fe-context `verifySetup` 선언 소비(인증 우회·API 목 절차의 프로젝트 선언화).
- `/omj-sync` — 토큰 스토어를 DTCG json 전용 → **CSS custom properties(`*.css`) 동시 지원**으로 확장(파싱: `var(--x)`=alias). **allowed-tools에 `Write` 추가**(extract 전용 — check/sync/push는 Write 금지 본문 강제). check 출력에 "추가할 토큰 코드 제안" 블록. **Figma 변수 접근은 편집 권한 필요**(뷰어 파일은 Duplicate) 실측 명문화.
- `/omj-setup` — `.omj/fe-context.md` 스캐폴딩(감지 후보는 **주석으로만**, acceptance 축 자동 선언 금지 — 원칙 ⑩ 보존), `docs/DESIGN.md` 빈 틀 초안(선택), 토큰 가드 훅 복사-설치(opt-in), 캡처 백엔드 점검을 playwright-cli 또는 MCP로 확장.
- `.omj/fe-context.md` 스키마 확장(fe-acceptance.md SoT) — `conventions:`·`designDocPath:`·`storybook:`·`verifySetup:` 추가(전부 선택). **토큰 시스템 탐지 순서**(fe-context → tokens.json → Tailwind @utility → CSS 변수)를 fe-acceptance.md에 1회 정의하고 omj.md·omj-setup·omj-sync가 참조(탐지 로직 이중 정의 제거).
- `/omj-fix` — baseline·verifySetup 참조 추가(캡처 SoT 재사용 규율 유지).
- `/omj-review` — Figma 충실도 검증 축 추가(figma-fidelity.md 참조).
- 커맨드 본문 SoT 상대링크(`../docs/...`) → `${CLAUDE_PLUGIN_ROOT}/docs/...` 절대화(omj.md 2곳·omj-start.md 1곳 — 런타임에서 상대링크는 소비 프로젝트 cwd 기준으로 해석돼 도달 불가였음. 스킬 본문 치환 실측 근거, 실패 시 기존 fallback 문구가 그대로 안전망).
- `docs/PRINCIPLES.md` — ①⑪(레인 질문 "최대 1회"+auto-select 정합), ⑧(번들 최소화의 경계: 외부 지식 참조 원칙은 유지하되 자작물(agents·훅 템플릿·references)은 위반 아님), ⑩(opt-in 훅과의 양립 — 상시 훅 기각은 유지, zero-hook 표어의 문자적 완화는 소유자 승인 기록). `docs/OMC-INTEGRATION.md` — "한 번만 묻고" 문구 드리프트 정정 + figma-implementer 위치 1줄.
- README EN/KO — 커맨드 표(verify 폴백·sync extract·setup 스캐폴딩), 번들 에이전트·opt-in 훅 절 신설, 의존성 표(캡처 백엔드), 트러블슈팅(편집 권한·baseline 만료) 동기화 갱신.
- 버전 `0.2.0` → `0.3.0`(plugin.json·marketplace.json 2곳).

### Removed

- (계획 단계 기각 — 코드 미반영) 디자인 시스템 하네스 원안의 `install.sh`(플러그인 설치와 이중 배포 경로), 독립 `token-checker`·`design-reviewer` 에이전트(`/omj-sync`·`/omj-review`와 중복), `protect-files`·`notify` 훅(FE 디자인 루프 밖), 상시(always-on) 플러그인 hooks.json(PRINCIPLES ⑩ 명시 기각 대안), baseline sidecar JSON(verify 권한상 저장 불가).

## [0.2.0] - 2026-07-01

### Added

- **README i18n 프론트도어** — OMC(oh-my-claudecode) 관례를 따라 `README.md`(영어 정본) + `README.ko.md`(한국어)로 이중언어화. 최상단 언어 스위처(`English | 한국어`), 3-step Quick Start, 커맨드 통합 테이블(Command·What·When·Example), `---` 챕터 구분으로 스캔성 개선.
- `docs/OMC-INTEGRATION.md` 신설 — "OMJ × OMC 통합 작업 플로우" 심화(멘탈 모델·역할 분담·게이트 규칙·A/B/C 플로우·핸드오프 제약)를 README 프론트도어에서 분리해 이관.
- docs/PRINCIPLES.md ⑪ 신설 — "물어보나 vs 그냥 한다": AskUserQuestion은 (모호+추론불가+비가역+실행중 발견) 4조건 모두일 때만. 새 프롬프트는 `/omj-sync`에만, `/omj-fix`·`/omj`·`/omj-verify`는 규칙상 배제(프롬프트 피로 방지).
- `/omj-review` — FF 통합 코드 리뷰 커맨드(read-only): 브랜치/스테이징 diff를 FF 4기준+a11y · vercel(성능/합성) · Next.js(Context7) 기준으로 검토하고 심각도(🔴/🟡/🟢) 리포트만 낸다(수정 없음). `/omj`(처방) ↔ `/omj-review`(검증) 분리.
- `/omj-setup` — 의존성 닥터: playwright-cli·공식 Figma MCP·Context7·OMC·tokens.json을 점검하고 누락 시 설치 가이드(이미 설치된 항목은 스킵). 첫 사용 전 권장.
- `/omj-fix` — 시각/동작 결함 수정 루프(능동 op): 붙여넣은 스크린샷+route의 결함을 진단·수정하고 재캡처로 확인한다. 관찰·재확인은 `/omj-verify`의 `-s=omj` 캡처 프로토콜을 **재사용**(중복 정의 없음)하고, 순수 신규는 그 사이의 Edit(+`--commit`)뿐. `/omj-verify`(읽기 점검)의 능동(write) 짝으로 지각적 결함(색·z-index·정렬)까지 커버.
- `frontend-fundamentals` `references/fe-acceptance.md` — 프로젝트별 acceptance 축을 레포 루트 `.omj/fe-context.md`에서 읽어 `/omj` 스펙·`/omj-fix` 진단에 반영하는 **메커니즘**(부재 시 graceful). **플러그인은 특정 축(다국어·모드 등)을 명명/강제하지 않는다** — 무엇을 점검할지는 프로젝트가 선언한다(범용·오픈소스 친화).

### Changed

- `/omj` Phase 2: 구현 acceptance를 "레포의 `.omj/fe-context.md`가 선언한 프로젝트별 축 반영(없으면 보편 FF 기준만)"으로 명시 — OMJ는 특정 축을 강제하지 않음(범용성). Color·Tokens의 하드코딩 토큰 경로(`shared/tokens/tokens.json`)를 "기본값 — `.omj/fe-context.md`의 `tokensPath`로 오버라이드"로 정정.
- **OMJ × OMC 게이트 의미 정합화**: OMJ × OMC 통합 플로우(현 `docs/OMC-INTEGRATION.md`)의 B 경로를 두 경로로 재서술 — (a) 구체 스펙은 `/ralph`·`/team` 직행(ralplan 스킵·승인 1회), (b) 합의는 명시적 `/ralplan`만(승인 2회). "구체 스펙이라 ralplan 게이트 즉시 통과"라는 자기모순 문구 삭제(auto-pass = ralplan 스킵이므로 시드 투입과 상호배타). 게이트 규칙(네이티브 plan = 읽기 게이트 vs OMC 자체 = 실행 게이트, 직교, OMC는 `ExitPlanMode` 미호출)과 핸드오프 제약(read-only materialize는 승인 후, `autopilot`은 `omj-*.md` 미탐지, `ralph`/`team`은 경로 명시 임베드, `~/.claude/plans` ≠ `.omc/plans`) 명문화.
- `/omj`: Next.js/Context7 라우팅 중복 서술 제거 → `frontend-fundamentals` 스킬을 SoT로 위임(드리프트 방지). Phase 2 끝에 읽기전용 라우팅 권고(inline/`/ralph`/`/team`, `/ralplan`은 모호·대규모만) 추가 — `/omj`는 advisor일 뿐 오케스트레이션 미소유.
- docs/PRINCIPLES.md: ⑤에 처방(`/omj` author) vs 검증(`/omj-review`·`/omj-verify`) 경계, ⑦에 게이트 공존 규칙 보강.
- **OMJ × OMC 통합 작업 플로우 문서화** — 계획(`/omc-plan`·`/ralplan`) → 실행(`/ralph`·`/team`·`/goal`)에서 `/omj` 스펙이 입력 매개가 되는 A/B/C 플로우. (0.2.0에서 `docs/OMC-INTEGRATION.md`로 이관 — README 프론트도어는 요약 표 + 링크만 유지.)
- `/omj-verify`·`/omj-sync` 사용법 정정: 인라인 env prefix(`JOY_BASE_URL=… /omj-verify`)는 슬래시 커맨드에 적용 안 됨 → `--base` 인자/사전 `export`로 교체. `--file <url>`은 비기능(use_figma는 활성 탭에 작동) → "대상=활성 탭"으로 명확화.
- **`/omj-sync` 대화형 재설계**: 인자 없는 `/omj-sync`가 드리프트를 클래스별(값 불일치/코드에만/Figma에만)로 묶어 방향(코드→Figma / Figma→코드 / 건너뛰기)을 `AskUserQuestion`으로 묻는 `sync` 모드로 변경(각 문항 1번=코드 권위 기본 — 값 불일치·코드에만은 코드→Figma, Figma에만은 보수적 건너뛰기 → 엔터만 치면 기존 code-wins와 동일한 안전 결과). `push`=명시적 code-wins 빠른 경로 유지, `check`=read-only 유지. allowed-tools에 `Edit`·`AskUserQuestion` 추가, Figma→코드 pull의 DTCG 참조-보존 가드레일(semantic→raw flatten 방지, 위험 시 기본 건너뛰기) 명시. 원칙을 "code→Figma 코드가 이김 단방향" → "코드가 기본 SoT, 충돌은 사용자가 방향 선택"으로 전환.
- **`/omj-review` 문구 재구성 + Plan-mode 사실 정정**: read-only(리포트만·수정 안 함)를 제약이 아니라 기능으로 앞세우고, `git diff`/`git rev-parse`는 read-only라 현재 Claude Code Plan 모드에서도 대체로 동작함을 반영("코드 리뷰가 Plan 모드에서 실행 안 됨"이라는 오해 문구 제거, 환경이 Bash를 전면 차단할 때의 폴백만 안내).
- docs/PRINCIPLES.md: ① 전제 정밀화("Plan 모드는 `Write`/`Edit`와 부작용 있는 Bash만 차단, 읽기 전용 Bash 허용"), ⑥ 전면 재작성(대화형 토큰 sync — 코드 기본 SoT + 사용자 방향 선택, "버린 대안"을 *사람 선택 없는 자동 양방향 머지*만 거부로 좁힘).
- CLAUDE.md: 문서화 규율을 양 언어 README(EN/KO) 동기화로, sync 원칙을 대화형으로, OMC 통합 상세 포인터를 `docs/OMC-INTEGRATION.md`로 갱신.
- 버전 `0.1.0` → `0.2.0`(plugin.json·marketplace.json). 이전 `[Unreleased]`의 `/omj-fix`·`/omj-review`·`/omj-setup`·fe-acceptance 항목을 `[0.2.0]`으로 확정.

### Deprecated

### Removed

### Fixed

- 자체 코드리뷰(xhigh) 반영: `/omj-fix` allowed-tools에 `Bash(command:*)` 추가·미사용 `Bash(yarn/pnpm:*)` 제거(최소권한)·세션 close 시점/스크린샷 역할 문구 명확화; `.omj/fe-context.md`의 `tokensPath` 오버라이드를 `/omj-sync`·`/omj-setup`이 존중하도록 정정; README `/omj` 섹션에 acceptance·tokensPath 반영, Context7·능동 op 목록에 `/omj-fix` 추가, 토큰 구조에 "예시(프로젝트마다 다름)" 헤지; PRINCIPLES 정본 파일 목록·`Skill` 열거·⑩ 구분선 보강 및 "축을 명명하지 않는다"→"빌트인으로 강제하지 않는다" 정정; FF 예제 제네릭화 잔재(`KakaoMap`→`MapView`, "갤러리 업로드"→"이미지 업로드") 제거. (글로벌 `apply-pr-review` 스킬의 트리아지 합성 보강은 OMJ 레포 밖이라 미기록.)
- `frontend-fundamentals` SKILL.md의 dangling `/fe-review` 참조 → 실재하는 `/omj-review` 커맨드로 정정(네임스페이스 `/omj-*` 일관). 기존엔 존재하지 않는 커맨드를 가리키는 깨진 링크였음.
- `/omj` allowed-tools: `Skill` 추가(frontend-fundamentals 루브릭 로드 가능) + figma 와일드카드를 **읽기 전용 4종**으로 축소(`use_figma` 등 write 도구 제외 → read-only/side-effect-free 보장과 일치).
- `/omj` Phase 0 디스패치: route-only 입력(`/omj /settings/profile`)이 dev/route 규칙에 동시 매칭되던 모호성 제거(route 먼저 소비, 남은 인자 없으면 사용법).
- `/omj-verify` 셸 스니펫: 빈 `$JOY_BASE_URL` → `${JOY_BASE_URL:-http://localhost:3000}` 기본값, 리터럴 `<route>` → 치환 변수 `$ROUTE`, 인증(로그인 리다이렉트) 처리를 open/goto 이후로 이동.

### Security

## [0.1.0] - 2026-06-29

### Added

- `/omj` — Plan 네이티브 프라이머. 명세 수집 + 구현 스펙(Plan)을 author 후 멈추는 read-only 커맨드.
- `/omj-verify` — playwright-cli 기반 시각 검증 커맨드.
- `/omj-sync` — tokens.json(W3C DTCG) ↔ Figma Variables 토큰 동기화. code→Figma "코드가 이김" 단방향.
- `frontend-fundamentals` 스킬 번들 (OMJ 정본).
- 문서: README, PRINCIPLES.

---

> 앞으로 모든 기능 추가/변경 시 이 파일에 항목을 추가합니다.

[Unreleased]: https://github.com/S-jooyoung/oh-my-joy/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/S-jooyoung/oh-my-joy/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/S-jooyoung/oh-my-joy/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/S-jooyoung/oh-my-joy/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/S-jooyoung/oh-my-joy/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/S-jooyoung/oh-my-joy/releases/tag/v0.1.0

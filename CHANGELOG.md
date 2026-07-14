# Changelog

이 프로젝트의 모든 주요 변경사항을 이 파일에 기록합니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)을 따르며, 버전 관리는 [Semantic Versioning](https://semver.org/lang/ko/)을 준수합니다.

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

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

[Unreleased]: https://github.com/S-jooyoung/oh-my-joy/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/S-jooyoung/oh-my-joy/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/S-jooyoung/oh-my-joy/releases/tag/v0.1.0

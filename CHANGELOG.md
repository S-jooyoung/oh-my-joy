# Changelog

이 프로젝트의 모든 주요 변경사항을 이 파일에 기록합니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)을 따르며, 버전 관리는 [Semantic Versioning](https://semver.org/lang/ko/)을 준수합니다.

## [Unreleased]

### Added

- `/omj-review` — FF 통합 코드 리뷰 커맨드(read-only): 브랜치/스테이징 diff를 FF 4기준+a11y · vercel(성능/합성) · Next.js(Context7) 기준으로 검토하고 심각도(🔴/🟡/🟢) 리포트만 낸다(수정 없음). `/omj`(처방) ↔ `/omj-review`(검증) 분리.
- `/omj-setup` — 의존성 닥터: playwright-cli·공식 Figma MCP·Context7·OMC·tokens.json을 점검하고 누락 시 설치 가이드(이미 설치된 항목은 스킵). 첫 사용 전 권장.
- `/omj-fix` — 시각/동작 결함 수정 루프(능동 op): 붙여넣은 스크린샷+route의 결함을 진단·수정하고 재캡처로 확인한다. 관찰·재확인은 `/omj-verify`의 `-s=omj` 캡처 프로토콜을 **재사용**(중복 정의 없음)하고, 순수 신규는 그 사이의 Edit(+`--commit`)뿐. `/omj-verify`(읽기 점검)의 능동(write) 짝으로 지각적 결함(색·z-index·정렬)까지 커버.
- `frontend-fundamentals` `references/fe-acceptance.md` — 프로젝트별 acceptance 축을 레포 루트 `.omj/fe-context.md`에서 읽어 `/omj` 스펙·`/omj-fix` 진단에 반영하는 **메커니즘**(부재 시 graceful). **플러그인은 특정 축(다국어·모드 등)을 명명/강제하지 않는다** — 무엇을 점검할지는 프로젝트가 선언한다(범용·오픈소스 친화).

### Changed

- `/omj` Phase 2: 구현 acceptance를 "레포의 `.omj/fe-context.md`가 선언한 프로젝트별 축 반영(없으면 보편 FF 기준만)"으로 명시 — OMJ는 특정 축을 강제하지 않음(범용성). Color·Tokens의 하드코딩 토큰 경로(`shared/tokens/tokens.json`)를 "기본값 — `.omj/fe-context.md`의 `tokensPath`로 오버라이드"로 정정.
- **OMJ × OMC 게이트 의미 정합화**: README "통합 작업 플로우" B 경로를 두 경로로 재서술 — (a) 구체 스펙은 `/ralph`·`/team` 직행(ralplan 스킵·승인 1회), (b) 합의는 명시적 `/ralplan`만(승인 2회). "구체 스펙이라 ralplan 게이트 즉시 통과"라는 자기모순 문구 삭제(auto-pass = ralplan 스킵이므로 시드 투입과 상호배타). 게이트 규칙(네이티브 plan = 읽기 게이트 vs OMC 자체 = 실행 게이트, 직교, OMC는 `ExitPlanMode` 미호출)과 핸드오프 제약(read-only materialize는 승인 후, `autopilot`은 `omj-*.md` 미탐지, `ralph`/`team`은 경로 명시 임베드, `~/.claude/plans` ≠ `.omc/plans`) 명문화.
- `/omj`: Next.js/Context7 라우팅 중복 서술 제거 → `frontend-fundamentals` 스킬을 SoT로 위임(드리프트 방지). Phase 2 끝에 읽기전용 라우팅 권고(inline/`/ralph`/`/team`, `/ralplan`은 모호·대규모만) 추가 — `/omj`는 advisor일 뿐 오케스트레이션 미소유.
- docs/PRINCIPLES.md: ⑤에 처방(`/omj` author) vs 검증(`/omj-review`·`/omj-verify`) 경계, ⑦에 게이트 공존 규칙 보강.
- README·docs: **OMJ × OMC 통합 작업 플로우** 추가 — 계획(`/omc-plan`·`/ralplan`) → 실행(`/ralph`·`/team`·`/goal`)에서 `/omj` 스펙이 입력 매개가 되는 A/B/C 플로우 문서화.
- `/omj-verify`·`/omj-sync` 사용법 정정: 인라인 env prefix(`JOY_BASE_URL=… /omj-verify`)는 슬래시 커맨드에 적용 안 됨 → `--base` 인자/사전 `export`로 교체. `--file <url>`은 비기능(use_figma는 활성 탭에 작동) → "대상=활성 탭"으로 명확화.

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

[Unreleased]: https://github.com/S-jooyoung/oh-my-joy/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/S-jooyoung/oh-my-joy/releases/tag/v0.1.0

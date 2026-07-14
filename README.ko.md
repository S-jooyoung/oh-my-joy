# oh-my-joy (OMJ)

[English](README.md) | 한국어

> 코드 ↔ Figma 프론트엔드 루프 전체를 하나로 잇는 프론트엔드 플러그인.

**FE는 무조건 `/omj`로 시작 — 스펙을 뽑고, 검증하고, 토큰을 맞춘다.**
_"거의 항상 Plan 모드"인 습관과 충돌하지 않는 Plan 네이티브 프라이머._

`Plan-first` · `Figma 2-트랙` · `대화형 토큰 sync` · `graceful degradation` · `OMC/OMX와 무충돌 공존`

[Quick Start](#quick-start) • [커맨드](#커맨드) • [OMJ × OMC/OMX](#omj--omcomx) • [설계 원리](#설계-원리--figma-2-트랙) • [트러블슈팅](#트러블슈팅)

---

## Quick Start

```
# 1. 설치 (한 줄씩 입력)
/plugin marketplace add ~/projects/oh-my-joy
/plugin install oh-my-joy@omj

# 2. 의존성 점검 (첫 사용 전 권장)
/omj-setup

# 3. 시작 — 명세를 구현 스펙(Plan)으로 뽑고 실행 레인을 고른 뒤 멈춤 → 승인 → 구현
/omj "검색 입력 폼 — React Hook Form + Zod, 모바일 우선" /search
```

> `/omj`는 read-only 프라이머라 코드를 직접 쓰지 않습니다 — 스펙을 만들고, 1번에 `(추천)`이 붙은 실행 레인을 제안한 뒤 멈춥니다. 어디서 시작할지 모르겠으면 `/omj-setup`부터 실행하세요.

---

## 커맨드

| 커맨드 | 하는 일 | 언제 | 예시 |
| --- | --- | --- | --- |
| **`/omj`** | 명세 수집 + 구현 스펙(Plan) author + 실행 레인 추천 후 멈춤 (read-only 프라이머). route 미지정 시 추론 기록, 다중 Figma 노드+텍스트 작업 혼합 지원 | 모든 FE 작업의 시작점 | `/omj https://figma.com/design/abc?node-id=1-2 /settings/profile` |
| **`/omj-start`** | 승인된 OMJ 스펙을 선택된 OMC/OMX 실행 레인으로 handoff | 승인 후 자동 시작이 불가할 때 (`(auto)` inline 스펙은 불필요) | `/omj-start ./omj-search-spec.md` |
| **`/omj-review`** | 변경 FE diff를 FF 4기준+a11y·Figma 충실도·vercel·Next.js로 통합 리뷰 (리포트만) | 구현 직후 PR 전 코드 품질 점검 | `/omj-review --base main` |
| **`/omj-verify`** | 라우트를 실제 브라우저(playwright-cli, 부재 시 playwright MCP 폴백)로 열어 시각/구조 점검 + Figma baseline(`.omj/baselines/`) 대비 | PR 전 시각 회귀 확인 | `/omj-verify /settings/profile` |
| **`/omj-fix`** | 붙인 스크린샷+route 결함을 고치고 재캡처로 확인 (능동 루프) | 픽셀/시각 결함 빠른 수정 | `/omj-fix /pricing "배너 z-index 낮음"` |
| **`/omj-sync`** | 토큰 스토어(`tokens.json` **또는 CSS custom properties**) ↔ Figma 드리프트를 **방향 물어** 해소. `extract`로 Figma 변수를 CSS로 부트스트랩 | 코드/Figma 토큰 정렬·최초 추출 | `/omj-sync` · `check` · `push` · `extract <figma-url>` |
| **`/omj-setup`** | 의존성 점검 + 설치 가이드 + `.omj/fe-context.md`·토큰 가드 훅(opt-in) 스캐폴딩 | 첫 사용 전 | `/omj-setup` |

> **read-only vs 능동 op.** `/omj`·`/omj-review`는 read-only(리포트만) — `/omj`는 스펙 뒤 실행 레인 질문을 **최대 1회** 할 수 있고(inline/manual 추천이면 질문 없이 `(auto)` 기록만 — Plan 승인이 곧 레인 동의), 여전히 Write/Edit/build/test는 못 합니다. `/omj-start`는 handoff 커맨드입니다: 런타임 surface가 명시적이고 안전할 때만 시작하고, 아니면 copyable action 한 줄만 출력합니다. `/omj-verify`·`/omj-fix`·`/omj-sync`(sync/push/extract)는 Figma write·`Edit`/`Write`·Bash를 쓰는 능동 op라, 환경이 Plan 모드에서 이를 막으면 Plan을 해제한 뒤 실행하세요. 각 커맨드의 구문·인자·단계는 `commands/<name>.md`가 정본입니다.

### 번들 에이전트 & opt-in 훅 (v0.3.0)

- **`figma-implementer`** (에이전트) — **승인된 OMJ 스펙**을 Clarify→Context→Plan→Generate→Evaluate 5단계로 구현하는 inline 레인 실행자. 스펙 없는 bare Figma URL은 구현을 거부하고 `/omj`부터 안내(plan-gate 우회 차단). OMC/OMX 레인이 선택됐으면 그 레인이 우선.
- **`design-qa`** (에이전트) — 타입체크·린트·토큰 하드코딩·Figma 충실도·a11y 기본(+fe-context 선언 시 Story·i18n)을 **검사만** 하는 기계 게이트. 소스는 절대 수정하지 않음.
- **토큰 가드 훅** — `templates/hooks/`의 `check-design-tokens.mjs`(하드코딩 색상 경고)·`check-story-exists.mjs`(Story 누락 경고). **플러그인이 자동 발화시키지 않습니다** — `/omj-setup`이 소비 프로젝트 `.claude/hooks/`로 복사·등록할 때만(opt-in) 동작하고, `.omj/fe-context.md` 선언이 없으면 no-op입니다.

### `/omj-sync` — 방향을 사용자가 고른다

`/omj-sync`는 "코드가 무조건 이김"을 강요하지 않습니다. **코드가 기본 SoT**이되, 드리프트가 있으면 클래스별(값 불일치 / 코드에만 / Figma에만)로 묶어 `AskUserQuestion`으로 방향을 묻습니다. 각 질문의 1번(기본) 선택지는 코드 권위를 따릅니다 — 값 불일치·코드에만은 `코드→Figma`, Figma에만은 보수적 `건너뛰기` — 라 무심코 엔터만 쳐도 안전합니다.

- `/omj-sync` (기본 `sync`) — 방향을 물어 대화형 해소.
- `/omj-sync check` — 읽기 전용 드리프트 리포트 + Figma에만 있는 토큰의 "추가할 코드 제안" 블록.
- `/omj-sync push` — 질문 없이 코드→Figma 일괄 반영(명시적 code-wins).
- `/omj-sync extract <figma-url>` — Figma 변수 전체를 CSS custom properties로 추출(`/`→`-` 변환, primitive→semantic `var()` 참조 유지, `docs/design-tokens.md` 매핑 테이블 생성). 토큰 스토어가 없는 프로젝트의 부트스트랩.

> 토큰 스토어는 `tokens.json`(DTCG)과 CSS custom properties(`*.css`) 둘 다 지원합니다. Figma 변수 접근은 **편집 권한**이 필요합니다 — 뷰어로 공유받은 파일은 사본(Duplicate)을 떠서 사용하세요.

---

## 의존성 (모두 선택 · graceful degradation)

부재해도 에러로 죽지 않고 **스킵 + 안내**합니다.

| 의존성 | 쓰이는 곳 | 없을 때 |
| --- | --- | --- |
| 공식 Figma Dev Mode MCP | `/omj`(디자인 읽기), `/omj-sync`(Variables 읽기/쓰기) | "Figma 미연결 — 수동 명세로 진행" 후 계속 |
| `playwright-cli` **또는** playwright MCP | `/omj-verify` · `/omj-fix` (cli 우선, MCP 폴백) | 둘 다 없으면 "캡처 백엔드 없음 — 검증 건너뜀" 후 종료 |
| Context7 | `/omj`·`/omj-review`·`/omj-fix`(Next.js 최신 문서 조회) | 해당 단계만 생략 |

> Figma write(`/omj-sync`의 push/pull, 디자인 읽기)는 **Figma 데스크톱 앱이 켜져 있고 대상 파일이 활성 탭**이어야 합니다. MCP 도구명은 환경마다 다를 수 있으니 `/mcp`로 확인하세요.

---

## OMJ × OMC/OMX

OMJ는 oh-my-claudecode(OMC), oh-my-codex(OMX)와 **별개의 독립 플러그인**입니다. 같이 설치해도 `/omj*` 네임스페이스는 OMJ가 소유하므로 충돌하지 않습니다.

- **멘탈 모델 (1문장)**: "FE는 무조건 `/omj`로 시작 — 스펙을 승인한 뒤 특별한 이유가 없으면 1번 `(추천)` 실행 레인으로 간다."

| 단계 | OMJ | OMC/OMX |
| --- | --- | --- |
| 계획 | `/omj`(FE 스펙, 네이티브 Plan + 실행 selector) | `/omc-plan`·`/ralplan`·`$ralplan` |
| 실행 | `/omj-start` fallback handoff | `/goal`·`$ultragoal`·`/team`/`$team`·`/ralph`/`$ralph` |
| 검증 | `/omj-review`·`/omj-verify` | `/verify`·`$ultraqa` |

`/omj`가 만든 구현 스펙이 곧 OMC/OMX 실행 도구가 소비하는 입력입니다. 실행 레인 라우팅 정본은 **[docs/EXECUTION-HANDOFF.md](docs/EXECUTION-HANDOFF.md)**, A/B/C 플로우·게이트 규칙·핸드오프 제약은 **[docs/OMC-INTEGRATION.md](docs/OMC-INTEGRATION.md)** 참고.

---

## 설계 원리 · Figma 2-트랙

- **Plan 네이티브 프라이머**: `/omj`는 read-only — 스펙을 만들고 실행 레인 selector를 최대 1회 물은 뒤(inline/manual 추천이면 질문 없이 `(auto)`) 멈추며, 승인(ExitPlanMode)해야 구현이 시작됩니다.
- **스펙 포맷**: uSpec 섹션(Anatomy/Structure/Color·Tokens/Props·Variants/A11y/Motion) + 각 항목 FF 4기준 + a11y + Figma 충실도(`figma-fidelity.md`).
- **토큰 sync**: 코드가 기본 SoT, 충돌은 사용자가 방향 선택(대화형). 스토어는 DTCG json·CSS custom properties 양쪽.
- **Figma 2-트랙**: (A) 앱 화면 design→code = 공식 Dev Mode MCP, (B) 디자인 시스템 스펙·토큰 = figma-console-mcp + uSpec(v1.1+).
- **번들 최소화**: 외부가 관리하는 지식은 참조만(vercel 스킬 — `npx skills add/update`), OMJ가 소유한 자작물(FF 스킬·에이전트 2종·훅 템플릿)만 번들. 플러그인 자체는 훅을 발화시키지 않는 zero-hook 유지(훅은 opt-in 복사-설치).

각 결정의 "왜"는 **[docs/PRINCIPLES.md](docs/PRINCIPLES.md)** 참고.

---

## 트러블슈팅

- **`/omj`가 코드를 안 고침** — 정상입니다. read-only 프라이머라 스펙과 선택된 실행 레인만 남기고 멈춥니다. 승인(ExitPlanMode) 후 구현이 시작됩니다. 자동 시작이 불가하면 출력된 `/omj-start <approved-spec>` 한 줄을 실행하세요.
- **`/omj-verify`/`/omj-fix`가 아무것도 안 함** — 캡처 백엔드 없음(playwright-cli도 playwright MCP도 부재), dev 서버 미기동(`yarn dev`), 인증 라우트, 또는 환경 Plan 모드가 Bash를 막았을 수 있습니다. 인증 라우트는 `.omj/fe-context.md`의 `verifySetup` 선언(권장) 또는 실행 전 `export JOY_TEST_EMAIL=… JOY_TEST_PASSWORD=…`.
- **Figma 미연결 / 권한 없음** — `This figma file could not be accessed` 류는 graceful 처리 대상. Figma 데스크톱을 켜고 대상 파일을 활성 탭으로 둔 뒤 다시 실행하세요. **변수/노드 접근은 편집 권한이 필요** — 뷰어로 공유받은 파일(튜토리얼 등)은 사본(Duplicate)을 떠서 사본 URL로 사용하세요.
- **baseline 비교가 안 됨** — Figma 에셋 URL은 약 7일 후 만료됩니다. `/omj`를 재실행해 스펙의 baseline provenance를 갱신하세요. 크로스세션 비교는 `.omj/baselines/`의 PNG가 담당합니다(gitignore 권장).
- **MCP 도구명이 다름** — Figma/Context7 도구명은 환경마다 다를 수 있습니다. `/mcp`로 실제 등록된 도구명을 확인하세요.
- **커밋된 스킬 사본과 중복** — 어떤 프로젝트가 `frontend-fundamentals`를 자기 `.claude/skills/`에 커밋해 뒀다면 OMJ 번들과 동시 로드될 수 있습니다(무해). 그 사본은 삭제하지 마세요(삭제하면 OMJ 미설치로 클론한 동료의 환경이 깨집니다) — 편집(SoT)은 한쪽에서만 하면 됩니다.

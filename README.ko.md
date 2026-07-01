# oh-my-joy (OMJ)

[English](README.md) | 한국어

> 코드 ↔ Figma 프론트엔드 루프 전체를 하나로 잇는 프론트엔드 플러그인.

**FE는 무조건 `/omj`로 시작 — 스펙을 뽑고, 검증하고, 토큰을 맞춘다.**
_"거의 항상 Plan 모드"인 습관과 충돌하지 않는 Plan 네이티브 프라이머._

`Plan-first` · `Figma 2-트랙` · `대화형 토큰 sync` · `graceful degradation` · `OMC와 무충돌 공존`

[Quick Start](#quick-start) • [커맨드](#커맨드) • [OMJ × OMC](#omj--omc) • [설계 원리](#설계-원리--figma-2-트랙) • [트러블슈팅](#트러블슈팅)

---

## Quick Start

```
# 1. 설치 (한 줄씩 입력)
/plugin marketplace add ~/projects/oh-my-joy
/plugin install oh-my-joy@omj

# 2. 의존성 점검 (첫 사용 전 권장)
/omj-setup

# 3. 시작 — 명세를 구현 스펙(Plan)으로 뽑고 멈춤 → 검토·승인(ExitPlanMode) → 구현
/omj "검색 입력 폼 — React Hook Form + Zod, 모바일 우선" /search
```

> `/omj`는 read-only 프라이머라 코드를 직접 쓰지 않습니다 — 스펙을 만들고 멈춥니다. 어디서 시작할지 모르겠으면 `/omj-setup`부터 실행하세요.

---

## 커맨드

| 커맨드 | 하는 일 | 언제 | 예시 |
| --- | --- | --- | --- |
| **`/omj`** | 명세 수집 + 구현 스펙(Plan) author 후 멈춤 (read-only 프라이머) | 모든 FE 작업의 시작점 | `/omj https://figma.com/design/abc?node-id=1-2 /settings/profile` |
| **`/omj-review`** | 변경 FE diff를 FF 4기준+a11y·vercel·Next.js로 통합 리뷰 (리포트만) | 구현 직후 PR 전 코드 품질 점검 | `/omj-review --base main` |
| **`/omj-verify`** | 라우트를 실제 브라우저(playwright-cli)로 열어 시각/구조 점검 | PR 전 시각 회귀 확인 | `/omj-verify /settings/profile` |
| **`/omj-fix`** | 붙인 스크린샷+route 결함을 고치고 재캡처로 확인 (능동 루프) | 픽셀/시각 결함 빠른 수정 | `/omj-fix /pricing "배너 z-index 낮음"` |
| **`/omj-sync`** | 토큰(`tokens.json` ↔ Figma) 드리프트를 **방향 물어** 해소 (대화형) | 코드/Figma 토큰 정렬 | `/omj-sync` · `/omj-sync check` · `/omj-sync push` |
| **`/omj-setup`** | 의존성 점검 + 설치 가이드 | 첫 사용 전 | `/omj-setup` |

> **read-only vs 능동 op.** `/omj`·`/omj-review`는 read-only(리포트만) — `/omj-review`는 `git diff`만 쓰므로 Plan 모드에서도 대체로 동작합니다. `/omj-verify`·`/omj-fix`·`/omj-sync`(sync/push)는 Figma write·`Edit`·Bash를 쓰는 능동 op라, 환경이 Plan 모드에서 이를 막으면 Plan을 해제한 뒤 실행하세요. 각 커맨드의 구문·인자·단계는 `commands/<name>.md`가 정본입니다.

### `/omj-sync` — 방향을 사용자가 고른다

`/omj-sync`는 "코드가 무조건 이김"을 강요하지 않습니다. **코드가 기본 SoT**이되, 드리프트가 있으면 클래스별(값 불일치 / 코드에만 / Figma에만)로 묶어 `AskUserQuestion`으로 방향을 묻습니다. 각 질문의 1번(기본) 선택지는 코드 권위를 따릅니다 — 값 불일치·코드에만은 `코드→Figma`, Figma에만은 보수적 `건너뛰기` — 라 무심코 엔터만 쳐도 안전합니다.

- `/omj-sync` (기본 `sync`) — 방향을 물어 대화형 해소.
- `/omj-sync check` — 읽기 전용 드리프트 리포트.
- `/omj-sync push` — 질문 없이 코드→Figma 일괄 반영(명시적 code-wins).

---

## 의존성 (모두 선택 · graceful degradation)

부재해도 에러로 죽지 않고 **스킵 + 안내**합니다.

| 의존성 | 쓰이는 곳 | 없을 때 |
| --- | --- | --- |
| 공식 Figma Dev Mode MCP | `/omj`(디자인 읽기), `/omj-sync`(Variables 읽기/쓰기) | "Figma 미연결 — 수동 명세로 진행" 후 계속 |
| `playwright-cli` | `/omj-verify` · `/omj-fix` | "미설치 — 검증/수정 건너뜀" 후 종료 |
| Context7 | `/omj`·`/omj-review`·`/omj-fix`(Next.js 최신 문서 조회) | 해당 단계만 생략 |

> Figma write(`/omj-sync`의 push/pull, 디자인 읽기)는 **Figma 데스크톱 앱이 켜져 있고 대상 파일이 활성 탭**이어야 합니다. MCP 도구명은 환경마다 다를 수 있으니 `/mcp`로 확인하세요.

---

## OMJ × OMC

OMJ는 oh-my-claudecode(OMC)와 **별개의 독립 플러그인**입니다. 같이 설치해도 무충돌(`/omj*` vs `/omc-*`).

- **멘탈 모델 (1문장)**: "FE는 무조건 `/omj`로 시작 — 커지면 승인 후 OMC `executor`로 escalate. 백엔드/범용/리서치만 OMC 직접."

| 단계 | OMJ | OMC |
| --- | --- | --- |
| 계획 | `/omj`(FE 스펙, 네이티브 Plan) | `/omc-plan`·`/ralplan` |
| 실행 | — | `/ralph`·`/team`·`/goal` |
| 검증 | `/omj-review`·`/omj-verify` | `/verify`(BE/일반) |

`/omj`가 만든 구현 스펙이 곧 OMC 실행 도구가 소비하는 입력입니다. A/B/C 플로우·게이트 규칙·핸드오프 제약 등 상세는 **[docs/OMC-INTEGRATION.md](docs/OMC-INTEGRATION.md)** 참고.

---

## 설계 원리 · Figma 2-트랙

- **Plan 네이티브 프라이머**: `/omj`는 read-only — 스펙을 만들고 멈춘 뒤, 승인(ExitPlanMode)해야 구현이 시작됩니다.
- **스펙 포맷**: uSpec 섹션(Anatomy/Structure/Color·Tokens/Props·Variants/A11y/Motion) + 각 항목 FF 4기준 + a11y.
- **토큰 sync**: 코드가 기본 SoT, 충돌은 사용자가 방향 선택(대화형).
- **Figma 2-트랙**: (A) 앱 화면 design→code = 공식 Dev Mode MCP, (B) 디자인 시스템 스펙·토큰 = figma-console-mcp + uSpec(v1.1+).
- **번들 최소화**: 자작 `frontend-fundamentals` 1개만 번들. vercel 스킬은 참조(`npx skills add/update`).

각 결정의 "왜"는 **[docs/PRINCIPLES.md](docs/PRINCIPLES.md)** 참고.

---

## 트러블슈팅

- **`/omj`가 코드를 안 고침** — 정상입니다. read-only 프라이머라 스펙만 만들고 멈춥니다. 승인(ExitPlanMode) 후 구현이 시작됩니다.
- **`/omj-verify`/`/omj-fix`가 아무것도 안 함** — `playwright-cli` 미설치, dev 서버 미기동(`yarn dev`), 인증 라우트(자격증명 env 필요), 또는 환경 Plan 모드가 Bash를 막았을 수 있습니다. 인증 라우트는 실행 전 `export JOY_TEST_EMAIL=… JOY_TEST_PASSWORD=…`.
- **Figma 미연결 / 권한 없음** — `This figma file could not be accessed` 류는 graceful 처리 대상. Figma 데스크톱을 켜고 대상 파일을 활성 탭으로 둔 뒤 다시 실행하세요.
- **MCP 도구명이 다름** — Figma/Context7 도구명은 환경마다 다를 수 있습니다. `/mcp`로 실제 등록된 도구명을 확인하세요.
- **커밋된 스킬 사본과 중복** — 어떤 프로젝트가 `frontend-fundamentals`를 자기 `.claude/skills/`에 커밋해 뒀다면 OMJ 번들과 동시 로드될 수 있습니다(무해). 그 사본은 삭제하지 마세요(삭제하면 OMJ 미설치로 클론한 동료의 환경이 깨집니다) — 편집(SoT)은 한쪽에서만 하면 됩니다.

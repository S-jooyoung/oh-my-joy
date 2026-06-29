# oh-my-joy (OMJ)

> 코드 ↔ Figma 프론트엔드 루프 전체를 하나로 잇는 개인 프론트엔드 플러그인.

OMJ는 프론트엔드 작업의 세 단계를 한 워크플로우로 묶습니다 — **① design → code(명세 수집 + 구현 스펙)**, **② 시각 검증**, **③ code → Figma 토큰 sync**. 토스 frontend-fundamentals(FF) 4기준과 Vercel 베스트 프랙티스를 구현 스펙 단계에서 먼저 적용하고, "거의 항상 Plan 모드"인 사용 습관과 충돌하지 않도록 **Plan 네이티브 프라이머**로 동작합니다.

`Plan-first` · `Figma 2-트랙` · `code-wins 토큰 sync` · `graceful degradation` · `OMC와 무충돌 공존`

---

## 설치

```
/plugin marketplace add ~/projects/oh-my-joy
/plugin install oh-my-joy@omj
```

- 마켓플레이스명: `omj` / 플러그인명: `oh-my-joy`
- 설치 후 사용 가능한 커맨드: `/omj`, `/omj-verify`, `/omj-sync`, `/omj-setup`
- 번들 스킬: `frontend-fundamentals`(OMJ 정본 — 구현 스펙의 평가 루브릭)
- **첫 사용 전 권장**: `/omj-setup`으로 의존성(playwright-cli·Figma MCP·Context7) 점검·설치 가이드를 한 번 실행

### 의존성 (모두 선택 · graceful degradation)

부재해도 에러로 죽지 않고 **스킵 + 안내**합니다.

| 의존성 | 쓰이는 곳 | 없을 때 |
| --- | --- | --- |
| 공식 Figma Dev Mode MCP (`mcp__plugin_figma_figma__*`) | `/omj` figma 프라이머(디자인 읽기), `/omj-sync`(Variables 읽기/쓰기) | "Figma 미연결 — 수동 명세로 진행" 안내 후 계속 |
| `playwright-cli` | `/omj-verify` 시각 검증 | "미설치 — 검증 건너뜀" 안내 후 종료 |
| Context7 (`mcp__plugin_context7-plugin_context7__*`) | `/omj` 공통 단계(Next.js 최신 문서 조회) | 해당 단계만 생략 |

> Figma write(`/omj-sync push`, design 읽기)는 **Figma 데스크톱 앱이 켜져 있고 대상 파일이 활성 탭**이어야 합니다.

---

## 커맨드 레퍼런스

### `/omj` — 프론트엔드 Plan 프라이머

**목적.** 프론트엔드 작업의 명세를 수집하고 **구현 스펙(= 네이티브 Plan)** 을 작성한 뒤 **멈춥니다.** 실제 코드 구현은 사용자가 그 Plan을 승인(ExitPlanMode)한 뒤의 정상 실행이 담당합니다.

> ⚠️ **이 커맨드는 코드를 직접 쓰지 않습니다(read-only).** allowed-tools는 `Read`/`Grep`/`Glob` + **figma 읽기 전용 도구만**(`get_design_context`/`get_screenshot`/`get_variable_defs`/`get_metadata` — `use_figma` 등 write 도구 제외) + Context7 + `Skill`(frontend-fundamentals 루브릭 로드용)입니다. Write/Edit/Bash 없음 → 부작용 없음. 결과물은 "무엇을 어떻게 구현할지"의 스펙이고, 그 스펙이 곧 사용자가 승인할 Plan이 됩니다.

**구문**

```
/omj <figma-url> [route]      Figma 디자인 → 구현 스펙(Plan)
/omj "<작업 설명>" [route]     코드 작업 → 구현 스펙(Plan)
/omj                          (인자 없음) 사용법 출력
```

**인자 / 디스패치 (결정적 — LLM 추측 없음)**

- **먼저** 끝의 `/`로 시작하는 토큰(예: `/invite/edit`)이 있으면 떼어내 **검증용 route로 기록만**(검증은 실행 안 함; 스펙에 "검증: `/omj-verify <route>`"로 남김)
- 남은 인자에 `figma.com` URL 포함 → **figma 프라이머**
- 남은 인자가 (URL 아닌) 텍스트 → **dev 프라이머**
- 남은 인자가 비어 있음(route만 줬거나 bare `/omj`) → 사용법 출력 후 종료(**빈 스펙 author 안 함**)

**입력 → 무슨 일이 일어나는지 → 출력**

1. *(figma)* `get_design_context`(구조/레이아웃), `get_screenshot`(이후 검증 baseline, 같은 세션 컨텍스트 내 유효), `get_variable_defs`(토큰)로 디자인을 읽음 — *(dev)* 관련 컴포넌트/훅/스타일/타입을 Glob·Grep·Read로 수집해 재사용 패턴 파악.
2. 변경이 Next.js 버전 민감 주제(App Router, Server/Client 경계, fetch 캐싱/revalidate, metadata, Image, middleware, next/dynamic)면 Context7로 `/vercel/next.js` 최신 문서 조회(선택).
3. **출력 = 구현 스펙**: uSpec 섹션(Anatomy / Structure / Color·Tokens / Props·Variants / A11y / Motion)으로 구조화하고 각 섹션을 FF 4기준 + 접근성으로 평가. 대상 파일 경로, 재사용할 기존 함수/컴포넌트, 적용할 FF/vercel 원칙, 검증 route를 명시. 그리고 **멈춤**(코드 생성·빌드·서브에이전트 위임 안 함).

**예시**

```
# 1) Figma 디자인을 구현 스펙으로 (route는 나중에 검증용으로 기록)
/omj https://figma.com/design/abc?node-id=12-34 /invite/edit

# 2) 코드 작업 설명을 구현 스펙으로
/omj "RSVP 폼 컴포넌트 — React Hook Form + Zod, 모바일 우선" /invite/edit

# 3) 사용법만 보기
/omj
```

**언제 쓰나.** 모든 프론트엔드 작업의 시작점. 컴포넌트/훅 작성·수정, Figma 디자인 퍼블리싱, 리팩터링 계획 등.

**주의.** 풀 파이프라인이 Plan 모드를 자동 종료하지 않습니다. 사용자가 스펙을 검토하고 직접 승인(ExitPlanMode)해야 구현이 시작됩니다. 승인 후 다중 파일/대규모 변경이고 OMC가 설치돼 있으면 `executor`(`model=opus`)에 **opt-in 위임** 가능(자율 플래너가 아니라 *승인된 스펙의 구현 핸드오프*).

---

### `/omj-verify` — 시각 검증 (능동 op)

**목적.** 구현된 화면을 실제 브라우저(`playwright-cli`)로 열어 디자인/명세 대비 어긋난 점을 점검합니다.

> ⚠️ **Bash 의존.** Plan 모드에서는 Bash가 차단되어 검증이 실행되지 않습니다 — **Plan 모드를 해제한 뒤** 실행하세요.

**구문**

```
/omj-verify <route>
/omj-verify <route> --base http://localhost:5173     # 포트가 다를 때(Vite 등)
```

**인자 / 환경**

- `<route>` — 검증할 경로(예: `/invite/edit`). 없으면 사용법 출력 후 종료(어떤 라우트에 마운트됐는지 모르면 검증 불가).
- `--base <url>` — base URL 오버라이드(기본 `http://localhost:3000`). Vite(5173) 등 다른 포트면 지정.
- (env) `JOY_TEST_EMAIL` / `JOY_TEST_PASSWORD` — 로그인 리다이렉트 시 재로그인용. **실행 전 셸에서 `export`** 해야 함(슬래시 커맨드는 인라인 env prefix를 못 받음). `JOY_BASE_URL`도 export하면 base로 쓰이나, 포트 지정은 `--base`가 명확.

**입력 → 무슨 일이 일어나는지 → 출력**

1. **변수 고정**: `ROUTE`=route 인자로 **실제 치환**(리터럴 `<route>` 금지), `BASE="${JOY_BASE_URL:-http://localhost:3000}"`(`--base` 있으면 그 값). **프리플라이트(실패 시 graceful 종료)**: `command -v playwright-cli`(미설치면 안내 후 종료) → `curl -sf "$BASE"`로 서버 기동 확인(비200이면 "먼저 `yarn dev`" 안내, 자동 기동 안 함).
2. **검증 절차**(세션 `-s=omj`):

   ```bash
   playwright-cli -s=omj open "$BASE$ROUTE" --persistent
   playwright-cli -s=omj goto "$BASE$ROUTE"
   # 로그인 리다이렉트면(open/goto 후 관찰) export된 $JOY_TEST_EMAIL/$JOY_TEST_PASSWORD로 fill+click 재로그인 후 다시 goto
   playwright-cli -s=omj snapshot      # 구조(접근성 트리) 점검
   playwright-cli -s=omj screenshot    # 시각 점검
   playwright-cli -s=omj close          # 세션 정리(필수)
   ```
3. **출력**: 직전 `/omj` 세션의 Figma `get_screenshot` baseline이 같은 세션 컨텍스트에 있으면 그것과 대비해 차이 보고(없으면 구조/접근성/레이아웃 점검만 — baseline 없이 무리한 비교 추정 안 함). 차이를 심각도(🔴/🟡/🟢)로 그룹화해 `요소·위치 + 관찰된 차이 + 권장 수정`으로 정리. FF 접근성(alt·라벨·터치 타깃)과 토큰 일탈(raw hex)을 우선 점검.

**예시**

```
# 1) 기본 (localhost:3000)
/omj-verify /invite/edit

# 2) 다른 포트(Vite)
/omj-verify / --base http://localhost:5173

# 3) 인증 라우트 — 자격증명은 실행 전 export (인라인 prefix는 안 먹힘)
export JOY_TEST_EMAIL=me@ex.com JOY_TEST_PASSWORD=***
/omj-verify /history
```

**언제 쓰나.** `/omj` 스펙대로 구현을 마친 뒤, PR 전 시각 회귀 확인. (Figma baseline 비교가 목적이면 같은 세션에서 `/omj` 직후 이어서 실행.)

**주의.** dev 서버를 자동으로 띄우지 않습니다. 끝나면 항상 `close`로 세션을 정리합니다.

---

### `/omj-sync` — 디자인 토큰 sync (code → Figma)

**목적.** 코드의 디자인 토큰(`tokens.json`, W3C DTCG)을 단일 진실 소스(SoT)로 삼아 Figma Variables와 맞춥니다.

> **원칙: 코드가 이긴다.** 방향은 code → Figma 단방향. Figma에서 코드를 덮어쓰지 않습니다 — `check`는 드리프트를 *보고만* 하고, 토큰 변경은 `tokens.json` PR로 합니다.

> ⚠️ `push`는 **Figma write**입니다 — Figma 데스크톱 앱이 켜져 있고 대상 파일에 편집 권한이 있어야 합니다. Plan 모드 밖에서 실행하는 능동 op.

**구문 / 인자·플래그**

```
/omj-sync                      # = push (기본 토큰 경로, 활성 탭 대상)
/omj-sync check                # 읽기 전용 드리프트 리포트만
/omj-sync push --tokens <path>
```

- `push`(기본) — `tokens.json`을 **활성 탭**의 Figma Variables로 생성/갱신.
- `check` — 활성 탭의 Figma Variables ↔ `tokens.json` 차이를 read-only 리포트로 출력.
- `--tokens <path>` — 토큰 파일 경로(기본 `shared/tokens/tokens.json`).
- **대상 파일 = 현재 Figma 데스크톱 앱의 활성 탭.** `use_figma`가 활성 탭에 작동하므로 동기화할 디자인 시스템 파일을 **활성 탭으로 연 뒤** 실행(URL로 파일 지정 불가 — `--file` 인자 없음).

**토큰 구조 (W3C DTCG)**

- **Primitive** — `color/ar/{gray,ruby,red,blue}/{scale}` 등 원시 스케일.
- **Semantic** — `color/{brand,fg,surface,line,feedback}/*`(Primitive를 alias 참조). 디자인 작업은 semantic만 사용.
- **Theme** — `color/thema/{01..05}-{base,point}`(콘텐츠 — 디자인 시스템과 격리).
- **Typography / Radius / Shadow / FontFamily** — 슬롯 기반.

**모드별 단계**

- **push**: `tokens.json` Read·파싱 → **`figma-use` 스킬 먼저 invoke(MANDATORY)** → `use_figma`로 Variables Collection 일괄 생성/갱신(Semantic은 Primitive를 alias로 *참조* — 값 복제 아님) → 데스크톱 미연결/권한 없음이면 graceful 안내 → 생성/갱신/스킵 건수 요약.
- **check**: `tokens.json` 읽고 `get_variable_defs`로 Figma Variables 읽어 비교 → 드리프트 리포트(코드에만 있음 / Figma에만 있음 / 값 불일치, 자동 수정 안 함) → "차이는 `tokens.json` 수정 PR 후 `/omj-sync push`로 해소" 안내.

**예시**

```
# 1) 기본 push
/omj-sync

# 2) 드리프트만 점검 (read-only)
/omj-sync check

# 3) 토큰 경로 지정 push (대상 디자인시스템 파일을 활성 탭으로 연 뒤)
/omj-sync push --tokens shared/tokens/tokens.json
```

**언제 쓰나.** 코드에서 토큰을 바꾼 뒤 Figma Variables를 맞출 때(`push`), 또는 양쪽이 어긋났는지 확인할 때(`check`).

**주의.** code-wins 단방향이므로 Figma 쪽 수정은 sync 대상이 아닙니다. `push`는 Figma write라 Plan 모드 밖 + 데스크톱 연결이 필요합니다.

---

### `/omj-setup` — 의존성 닥터 + 설치 가이드

**목적.** OMJ가 기대는 선택적 의존성(playwright-cli·공식 Figma MCP·Context7·OMC·tokens.json)을 점검하고, 없으면 설치를 안내합니다. **이미 설치된 항목은 ✓만 보고하고 건드리지 않습니다.** 첫 사용 전에 한 번 실행하면 좋습니다.

**구문**

```
/omj-setup            점검 + 누락 시 설치 가이드(설치 여부를 물어봄)
/omj-setup --check    점검 표만(read-only)
/omj-setup --help     도움말
```

**무슨 일이 일어나는지.** ① 각 의존성을 탐지(`command -v playwright-cli`, `claude plugin list`로 figma/context7/OMC, `test -f`로 tokens.json)해 ✓/✗ 표로 보고 → ② (`--check`가 아니면) 누락 항목마다 "지금 설치할까요?"를 물어 동의 시 `claude plugin install …`/`npm i -g …` 실행, 거부 시 수동 명령 안내 → ③ "이제 `/omj`로 시작" 안내. Figma는 플러그인 설치와 별개로 **데스크톱 앱의 Dev Mode MCP 활성화**가 필요함도 안내합니다.

**주의.** 플러그인 설치는 **다음 세션부터** 로드됩니다. 설치 행위는 Bash 능동 op라 Plan 모드 밖에서 실행하세요. `claude` CLI를 못 쓰면 수동 확인(`/mcp`·`/plugin`)으로 폴백합니다.

---

## OMC와 함께 쓰기

OMJ는 oh-my-claudecode(OMC)와 **별개의 독립 플러그인**입니다. 같이 설치해도 충돌하지 않습니다.

- **멘탈 모델 (1문장)**: "FE는 무조건 `/omj`로 시작 — 커지면 승인 후 OMC `executor`로 escalate. 백엔드/범용/리서치만 OMC 직접."
- **네임스페이스 분리**: OMJ는 `/omj*`, OMC는 `/oh-my-claudecode:*`(또는 `/omc-*`) — 이름이 겹치지 않습니다.
- **독립 업데이트**: 각자 자기 마켓플레이스에서 갱신. 한쪽 업데이트가 다른 쪽에 영향 없음.
- ⚠️ **비-Plan 모드 주의**: `/omj`는 read-only Plan 프라이머지만, `/omj-verify`·`/omj-sync push`는 Bash/Figma write를 쓰는 능동 op입니다. Plan 모드를 해제하고 실행하세요.

---

## 권장 작업 플로우 (plan-first)

OMJ 단독 기본 흐름:

1. **프라임** — `/omj <figma-url 또는 작업설명> [route]`로 명세 수집 + 구현 스펙 author. 여기서 멈춤.
2. **승인** — 제시된 스펙(네이티브 Plan)을 검토하고 ExitPlanMode로 승인.
3. **검증** — Plan 해제 상태에서 `/omj-verify <route>`로 시각 회귀 점검(가능하면 같은 세션에서 Figma baseline 대비).
4. **sync** — 토큰을 바꿨다면 `/omj-sync push`(또는 먼저 `/omj-sync check`로 드리프트 확인)로 Figma Variables 정렬.

---

## OMJ × OMC 통합 작업 플로우

평소 `/omc-plan`·`/ralplan`로 계획하고 `/ralph`·`/team`·`/goal`로 실행한다면, OMJ는 그 흐름의 **프론트엔드 전용 on-ramp(스펙 생성) + 검증** 단계입니다. 핵심: **`/omj`가 만든 구현 스펙이 곧 OMC 실행 도구가 소비하는 입력**이 됩니다(스펙이 두 도구를 잇는 매개).

**한 줄 역할 분담**

- **계획**: `/omj`(FE 맥락 스펙) → 크면 `/ralplan`으로 합의 정제
- **실행**: `/ralph`(순차 루프) · `/team`(병렬 N에이전트) · `/goal`(장기 다목표) — OMC
- **검증**: `/omj-verify`(FE 시각) · OMC `/verify`(BE/일반)

**A. 일반 FE 작업 (단순~중간)**

1. `/omj <figma-url|작업> [route]` → 구현 스펙(Plan)
2. 검토 후 승인(ExitPlanMode)
3. 실행: 작으면 인라인, 다중 파일이면 `/ralph` 또는 `/team`
4. `/omj-verify <route>` → 토큰 바뀌면 `/omj-sync push`

**B. 대규모/복잡 FE (여러 화면·리팩터링)**

1. `/omj`로 핵심 화면 스펙 author (figma + FF/vercel)
2. 그 스펙을 **`/ralplan` 시드로** 투입 → 합의·정제 (구체 스펙이라 ralplan 게이트 즉시 통과)
3. `/team`(병렬) 또는 `/ralph`(순차)로 실행, 장기면 `/goal`에 등록
4. 화면별 `/omj-verify`, 잔여 diff 재실행

**C. 풀스택 (FE+BE)**

1. `/omc-plan` 또는 `/ralplan`로 전체 큰 그림
2. FE 잎 = `/omj` 프라이밍 → 승인 → 실행, BE = OMC `executor`
3. 검증: FE `/omj-verify`, BE OMC `/verify`

> **요지**: "무엇을 만들지"는 FE면 `/omj`가 figma·FF 맥락으로 정확히 뽑아주고, "어떻게 굴릴지"는 OMC 실행 도구(`/ralph`·`/team`·`/goal`)가 그대로 가져갑니다 — 스펙이 매개입니다.

---

## Figma 2-트랙 + uSpec 전략 (요약)

- **트랙 A — 앱 화면 design → code**: 공식 Figma Dev Mode MCP(`mcp__plugin_figma_figma__*`)로 화면을 읽어 구현.
- **트랙 B — 디자인 시스템 스펙·토큰**: figma-console-mcp(Southleft) + uSpec(Uber) 기반 컴포넌트 스펙(v1.1+).
- **스펙 포맷 = uSpec 섹션 차용**: Anatomy / Structure / Color·Tokens / Props·Variants / A11y / Motion — 각각 FF 4기준 + a11y로 평가.
- **code → Figma "코드가 이김"** 단방향 토큰 sync(드리프트만 보고).

상세 설계 원리는 [`docs/PRINCIPLES.md`](docs/PRINCIPLES.md) 참고.

**vercel 스킬은 참조(번들 아님).** 번들 최소화를 위해 자작 `frontend-fundamentals` 1개만 포함합니다. Vercel 스킬(성능/합성)은 필요 시 직접 설치하세요:

```
npx skills add vercel-labs/agent-skills/vercel-react-best-practices
npx skills add vercel-labs/agent-skills/vercel-composition-patterns
npx skills update
```

---

## 트러블슈팅

- **MCP 도구명이 다름**: Figma MCP 도구명은 환경마다 다를 수 있습니다. `/mcp`로 실제 등록된 서버·도구명을 확인하세요(이 문서의 `mcp__plugin_figma_figma__*`는 예시).
- **Figma 미연결 / 권한 없음**: `This figma file could not be accessed` 류 에러는 graceful 처리 대상 — Figma 데스크톱 앱을 켜고 대상 파일을 활성 탭으로 둔 뒤 다시 실행.
- **`/omj-verify`가 아무것도 안 함**: Plan 모드라 Bash가 막혔거나(해제 필요), `playwright-cli` 미설치, dev 서버 미기동(`yarn dev`), 또는 인증 라우트(자격증명 env 필요)일 수 있습니다.
- **`/omj`가 코드를 안 고침**: 정상입니다. `/omj`는 read-only 프라이머 — 스펙만 만들고 멈춥니다. 승인(ExitPlanMode) 후 구현이 시작됩니다.
- **areum 등 기존 프로젝트와 스킬 중복**: 프로젝트 `.claude/skills/`에 `frontend-fundamentals`가 커밋돼 있으면 OMJ 번들과 동시 로드될 수 있습니다(무해하나 약간의 토큰 중복). **areum의 커밋된 사본은 삭제하지 마세요** — areum은 "스킬을 `.claude/`에 커밋해 클론 즉시 무설정 동작"을 보장하므로, 삭제하면 OMJ 미설치 상태로 클론한 동료의 환경이 깨집니다. OMJ 번들은 *비-areum* 레포 포터빌리티용이고, 내용 편집(SoT)은 한쪽에서만 하세요.

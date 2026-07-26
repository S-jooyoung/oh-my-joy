---
description: 라우트를 시각 검증 — 디자인/명세 대비 점검. playwright-cli 우선, 부재 시 playwright MCP 폴백 (Plan 해제 후 실행)
argument-hint: "<route> [--base <url>]"
allowed-tools: Read, Bash(playwright-cli:*), Bash(curl:*), Bash(command:*), mcp__playwright__*, mcp__plugin_playwright_playwright__*
---

# /omj-verify — 시각 검증 (능동 op)

구현된 화면을 실제 브라우저로 열어 디자인/명세 대비 어긋난 점을 점검한다.

> ⚠️ 이 커맨드는 브라우저를 띄우는 **부작용 있는(mutating) 능동 op**다 — Plan 모드는 이런 부작용 Bash를 차단하므로(읽기 전용 Bash는 허용) 검증이 실행되지 않는다. Plan 모드를 해제한 뒤 실행한다. `Read`는 baseline PNG 로드·`.omj/fe-context.md` 판독 전용이다(소스 수정 없음).

## 인자

- `<route>` — 검증할 경로(예: `/settings/profile`). **route가 없으면** 아래 사용법을 출력하고 종료한다(컴포넌트가 어떤 라우트에 마운트됐는지 모르면 검증 불가). `/omj` 스펙의 `검증 route(추론):` 값을 복사해 쓸 수 있다.
- `--base <url>` — base URL 오버라이드(생략 시 기본 `http://localhost:3000`). 예: `--base http://localhost:5173`(Vite).

> ℹ️ 슬래시 커맨드는 셸이 아니므로 `JOY_BASE_URL=... /omj-verify`처럼 **인라인 env prefix는 적용되지 않는다.** 포트가 다르면 `--base` 인자를 쓰고, 로그인 자격증명 같은 env는 실행 *전에* 셸에서 미리 `export`한다.

## 변수 결정 (스니펫 실행 전 셸 변수로 고정)

```bash
ROUTE="…"   # ← route 인자로 반드시 치환 (예: /settings/profile). 리터럴 <route> 금지
BASE="${JOY_BASE_URL:-http://localhost:3000}"   # --base 인자가 있으면 그 값으로 덮어씀
```
> `ROUTE`는 사용자가 준 route 인자로 **실제 치환**한다. `BASE` 우선순위: `--base` > export된 `JOY_BASE_URL` > `http://localhost:3000`.

> ⚠️ **인자 검증(치환 전 필수).** `ROUTE`·`BASE`는 사용자 입력이 셸 명령에 들어가는 유일한 지점이다. 치환 *전에* 아래를 확인하고, 하나라도 어긋나면 치환하지 말고 "인자 형식이 올바르지 않음"으로 종료한다.
> - `ROUTE`는 `/`로 시작하고, 공백·newline·quote·backtick·`$`·`;`·`&`·`|`·`<`·`>`·`(`·`)`를 포함하지 않는다(쿼리스트링 `?`·`=`·`&`가 필요하면 값 전체를 큰따옴표로 감싼 채 두고, `&`는 셸 분리자가 되므로 route에서 제거한 뒤 baseline 슬러그 규칙대로 처리한다).
> - `BASE`는 `http://` 또는 `https://`로 시작하는 URL이고 같은 metacharacter를 포함하지 않는다.
> - 두 값 모두 스니펫에서 항상 `"$ROUTE"`/`"$BASE"`처럼 **큰따옴표로 감싼 변수 참조**로만 쓴다(값을 명령줄에 펼쳐 쓰지 않는다).

### `<route-slug>` 변환 규칙 (baseline 파일 키)

route → 파일명 슬러그: leading `/` 제거, 내부 `/`→`-`, 쿼리스트링 제거, 루트 `/`는 `root`, 후행·중복 `-`는 collapse. 예: `/settings/profile/` → `settings-profile`, `/` → `root`. viewport 라벨은 이번 verify가 실행하는 뷰포트(`desktop`|`mobile`)다.

## 프리플라이트 (실패 시 graceful 종료)

1. **캡처 백엔드**: `command -v playwright-cli`가 있으면 playwright-cli를 쓴다. **없으면 세션에 playwright MCP 도구(`mcp__playwright__*`)가 있는지 확인**하고, 있으면 그것으로 아래와 동일한 절차(네비게이트 → 접근성 스냅샷 → 스크린샷 → baseline 비교)를 수행한다(폴백 — 절차 동등, 도구만 다름). 둘 다 없으면 → "캡처 백엔드 없음 — 검증 건너뜀. 설치: `npm i -g playwright-cli` 또는 playwright MCP 활성(`/omj-setup` 참고)" 후 종료.
2. **서버 기동**: `curl -sf "$BASE" >/dev/null` 가 실패(비200)하면 → "dev 서버 미기동 — `yarn dev`로 띄운 뒤 재실행하거나 검증 스킵" 안내 후 종료(자동 기동 안 함).
3. **프로젝트 검증 절차**: 레포 루트 `.omj/fe-context.md`에 `verifySetup:`이 선언돼 있으면 그 문서를 `Read`해 **관찰 전에** 인증 우회·API 목 절차를 적용한다(없으면 생략 — graceful).

## 검증 절차

세션 이름은 `-s=omj`로 둔다(playwright MCP 폴백 시 세션 개념은 MCP 브라우저 탭이 대신한다).

```bash
playwright-cli -s=omj open "$BASE$ROUTE" --persistent
playwright-cli -s=omj goto "$BASE$ROUTE"
playwright-cli -s=omj snapshot      # 구조(접근성 트리) 점검
playwright-cli -s=omj screenshot    # 시각 점검
```

- **인증 리다이렉트 처리 (open/goto *이후*)**: 위 navigate에서 로그인 페이지로 리다이렉트되면, `verifySetup` 절차(있으면) 또는 미리 export한 자격증명 env(`$JOY_TEST_EMAIL`/`$JOY_TEST_PASSWORD`)로 `fill`+`click` 재로그인 후 다시 `goto`. 둘 다 없으면 → "인증이 필요한 라우트 — 브라우저에서 수동 로그인 후 다시 실행" 안내. (리다이렉트는 페이지를 연 뒤에야 관찰되므로 프리플라이트가 아니라 이 단계에서 처리한다.)
  - **자격증명 취급 규칙**: `fill`에는 반드시 `"$JOY_TEST_PASSWORD"` 같은 **변수 참조만** 넘긴다 — 값을 해석해 명령줄·리포트·에러 메시지에 적지 않는다(트랜스크립트에 평문으로 남는다). **테스트 전용 계정만** 사용한다.
  - **인증 후 화면의 영속화 주의**: 로그인 뒤 캡처한 스크린샷에는 세션·개인정보가 담길 수 있다. baseline으로 디스크에 남기기 전에 그 사실을 사용자에게 알린다.
- **baseline 영속화 (관찰 단계)**: 세션 컨텍스트에 `/omj` 스펙의 Figma 에셋 URL이 있으면 PNG를 영속화한다:
  ```bash
  curl -f --remove-on-error --create-dirs -o ".omj/baselines/<route-slug>@<viewport>.png" "<asset-url>"
  ```
  `-f` 필수(403/404 에러 바디가 PNG로 저장되는 침묵 손상 방지), `--remove-on-error` 필수(실패 시 0-byte 잔존 파일 방지). exit 비0이면 → "baseline 만료(에셋 URL은 약 7일 유효) — `/omj` 재실행으로 갱신" 안내하고 계속한다. **URL 출처는 세션 컨텍스트만**이다(스펙 파일 기반 URL 재조회는 v1.1 follow-up). 크로스세션 비교는 아래 ②의 온디스크 PNG가 담당한다.
- **비교 기준 (3단계)**: ① 직전 `/omj` 세션 컨텍스트에 Figma 기준 이미지가 있으면 그것과 대비. → ② 없으면 `.omj/baselines/<route-slug>@<viewport>.png`가 존재하고 **비어 있지 않으면** `Read`로 로드해 대비(viewport 라벨은 verify 실행 뷰포트이며 recorded 디자인 프레임과 다를 수 있음 — 공통 케이스인 단일 프레임은 일치). → ③ 둘 다 없으면 라우트 자체의 구조/접근성/레이아웃 점검만 한다(baseline 없이 무리하게 비교 추정하지 않는다).
- **출력**: 차이를 심각도(🔴/🟡/🟢)로 그룹화하고 `요소·위치 + 관찰된 차이 + 권장 수정`으로 적는다. FF 접근성(alt·라벨·터치 타깃)과 토큰 일탈(raw hex 등, `figma-fidelity.md` 기준)을 우선 본다.
- 작업이 끝나면 반드시 `playwright-cli -s=omj close`로 세션을 정리한다(MCP 폴백 시 탭 정리).

## 사용법 (route 누락 시)

```
/omj-verify <route>                 예: /omj-verify /settings/profile
/omj-verify <route> --base <url>    예: /omj-verify / --base http://localhost:5173
# 인증 라우트면: .omj/fe-context.md의 verifySetup 선언(권장) 또는 실행 전 셸에서
#   export JOY_TEST_EMAIL=... JOY_TEST_PASSWORD=...
```

> `.omj/baselines/`는 소비 프로젝트의 `.gitignore`에 **반드시** 추가한다 — 생성 산출물일 뿐 아니라 인증 화면·개인정보가 담긴 스크린샷이 커밋될 수 있다.

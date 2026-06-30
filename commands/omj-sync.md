---
description: 디자인 토큰을 코드↔Figma 동기화 — tokens.json(W3C DTCG)을 Figma Variables로 push, 또는 드리프트 check (코드가 SoT)
argument-hint: "[push|check] [--tokens <path>]"
allowed-tools: Read, Grep, Glob, Skill, mcp__plugin_figma_figma__get_variable_defs, mcp__plugin_figma_figma__use_figma
---

# /omj-sync — 디자인 토큰 sync (code → Figma)

코드의 디자인 토큰을 단일 진실 소스(SoT)로 삼아 Figma Variables와 맞춘다.

> **원칙: 코드가 이긴다.** 방향은 code → Figma 단방향이다. Figma에서 코드를 덮어쓰지 않는다(`check`는 드리프트를 *보고만* 하고, 토큰 변경은 `tokens.json` PR로 한다).

> ⚠️ **대상 파일 = 현재 Figma 데스크톱 앱의 활성 탭.** `use_figma`는 활성 탭 파일에서 작동하므로, 동기화할 **디자인 시스템 파일을 활성 탭으로 연 뒤** 실행한다(URL로 대상 파일을 지정할 수 없음). `push`는 Figma write라 Figma 데스크톱이 켜져 있고 편집 권한이 있어야 하며, Plan 모드 밖에서 실행하는 능동 op다.

## 인자

- `push` (기본) — `tokens.json`을 활성 탭의 Figma Variables로 생성/갱신.
- `check` — 활성 탭의 Figma Variables와 `tokens.json`의 차이를 **읽기 전용 드리프트 리포트**로 출력.
- `--tokens <path>` — 토큰 파일 경로. 미지정 시 기본값은 레포 루트 `.omj/fe-context.md`의 `tokensPath`(있으면 `Read`로 읽어 사용), 없으면 `shared/tokens/tokens.json`.

## 토큰 구조 (W3C DTCG)

`tokens.json`은 예시로 다음과 같은 계층을 가질 수 있다(구조는 프로젝트마다 다름):
- **Primitive** — `color/{스케일}/{단계}`(예: `color/gray/100`) 등 원시 스케일.
- **Semantic** — `color/{brand,fg,surface,line,feedback}/*` (Primitive를 alias 참조, 예: `{color.red.700}`). 디자인 작업은 semantic만 사용.
- **Theme** — `color/theme/*` (콘텐츠/테마 토큰 — 디자인 시스템과 격리).
- **Typography / Radius / Shadow / FontFamily** — 슬롯 기반.

## push 절차

1. `--tokens` 경로의 `tokens.json`을 `Read`로 읽어 DTCG 구조를 파싱한다(없으면 graceful 안내).
2. **`figma-use` 스킬을 먼저 `Skill`로 invoke(MANDATORY prerequisite)** — `use_figma` 호출 전 반드시 로드.
3. `use_figma`로 **활성 탭** 파일에 Variables Collection을 일괄 생성/갱신한다: Primitive/Semantic/Theme 컬렉션 + Typography/Radius/Shadow/FontFamily. **Semantic은 Primitive를 alias로 *참조*하도록** 매핑한다(값 복제가 아니라 참조).
4. Figma 데스크톱 미연결/권한 없음이면 `This figma file could not be accessed` 류 에러 — 에러로 죽지 말고 "Figma 데스크톱 앱을 켜고 대상 디자인 시스템 파일을 활성 탭으로 둔 뒤 다시 실행" 안내(graceful).
5. 결과 요약(생성/갱신/스킵 건수)을 출력한다.

## check 절차 (read-only)

1. `tokens.json`을 읽고, 활성 탭의 Variables를 `get_variable_defs`로 읽는다.
2. 양쪽을 비교해 **드리프트 리포트**를 출력한다: 코드에만 있음 / Figma에만 있음 / 값 불일치. 자동 수정하지 않는다.
3. 결론: "코드가 SoT이므로, 차이는 `tokens.json` 수정 PR 후 `/omj-sync push`로 해소" 안내.

## 사용법

```
/omj-sync                                  # = push (기본 토큰 경로, 활성 탭 대상)
/omj-sync check                            # 드리프트 리포트만
/omj-sync push --tokens shared/tokens/tokens.json
```
> 실행 전: 동기화할 Figma 디자인 시스템 파일을 데스크톱 앱에서 **활성 탭**으로 열어 둔다.

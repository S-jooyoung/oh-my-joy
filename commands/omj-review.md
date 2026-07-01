---
description: 브랜치/스테이징 diff를 FF 4기준+a11y · vercel(성능/합성) · Next.js(Context7) 기준으로 통합 리뷰 (read-only)
argument-hint: "[--base <ref>]"
allowed-tools: Read, Grep, Glob, Skill, Bash(git diff:*), Bash(git rev-parse:*), mcp__plugin_context7-plugin_context7__*
---

# /omj-review — FF 통합 코드 리뷰 (검증, read-only)

변경된 프론트엔드 코드(diff)를 **frontend-fundamentals 4기준 + 접근성**, **vercel 성능/합성**, **Next.js(Context7) 최신 권장**으로 한 번에 검토하고 **심각도별 리포트만** 낸다. **수정하지 않는다.**

> ✅ **read-only 검증 — 수정하지 않는다(기능).** allowed-tools에 `Write`/`Edit`이 없어 코드를 건드리지 않고 린터처럼 **리포트만** 낸다. 발견을 고치려면 `/omj-fix`(능동 루프)나 수동 수정으로 넘긴다.
>
> ⚠️ **Bash(git)로 diff를 읽는다.** `git diff`/`git rev-parse`는 **read-only**라 현재 Claude Code Plan 모드에서도 대체로 그대로 동작한다(Plan 모드는 `Write`/`Edit`와 부작용 있는 Bash만 차단, 읽기 전용 Bash는 허용). 다만 사용하는 환경의 Plan 모드가 Bash를 전면 차단한다면 Plan 모드를 해제한 뒤 실행한다.
>
> **처방 vs 검증**: `/omj`(author)가 "무엇을 만들지"를 FF 기준으로 **처방(prescriptive)** 한다면, `/omj-review`는 구현된 diff가 그 기준을 지켰는지 **검증(descriptive)** 한다. 같은 FF SoT(`frontend-fundamentals` 스킬)를 단계만 달리 쓴다. 시각 회귀는 `/omj-verify`가 담당.

## 인자

- (없음) — 작업 트리의 미커밋 + staged 변경(`git diff HEAD`)을 리뷰한다.
- `--base <ref>` — 기준 ref 대비 브랜치 전체 diff(`git diff <ref>...HEAD`)를 리뷰한다. 예: `--base main`, `--base origin/main`.

## 프리플라이트 (실패 시 graceful 종료)

1. **git 저장소**: `git rev-parse --is-inside-work-tree` 가 실패하면 → "git 저장소가 아님 — 리뷰 건너뜀" 후 종료.
2. **변경 수집**: 인자에 따라 diff를 얻는다.
   - 기본: `git diff HEAD` (+ staged 포함은 `git diff HEAD`가 커버) → 비어 있으면 `git diff --cached`도 확인.
   - `--base <ref>`: `git diff <ref>...HEAD`.
   - diff가 비어 있으면 → "변경 없음 — 리뷰할 diff가 없습니다" 후 종료.
3. **대상 필터**: 변경 파일 중 FE 관련(`.tsx`/`.jsx`/`.ts`/`.css`/`.scss` 및 컴포넌트·훅·스타일)만 추린다. FE 변경이 없으면 → "FE 변경 없음 — 리뷰 대상 아님" 안내 후 종료.

## 리뷰 절차

1. **루브릭 로드**: `Skill`로 **`frontend-fundamentals` 스킬을 invoke**해 `references/`(가독성·예측가능성·응집도·결합도·a11y) + 라우팅 규칙을 기준으로 삼는다. 스킬을 로드할 수 없으면 → 4기준을 이름만으로 수동 적용하고 "FF 스킬 미로드 — 루브릭 축약 적용" 안내(graceful, 에러 아님).
2. **변경별 평가**: 각 변경 파일/헝크를 다음으로 본다.
   - **FF 4기준 + a11y** — 가독성(맥락 과다·중첩 삼항), 예측가능성(이름≠동작·숨은 사이드이펙트), 응집도(흩어진 변경), 결합도(props drilling 3단계↑), 접근성(alt·시맨틱·키보드·터치 타깃), 토큰 일탈(raw hex/Primitive 직접 사용).
   - **성능·번들·리렌더·데이터 페칭** → `vercel-react-best-practices` 스킬 기준 참조(미설치 시 해당 레이어 생략, graceful).
   - **props 비대화·확장 컴포넌트 API** → `vercel-composition-patterns` 스킬 기준 참조(미설치 시 생략, graceful).
   - **Next.js 버전민감 주제**(App Router·Server/Client 경계·`fetch` 캐싱·`metadata`·`Image`·middleware·`next/dynamic`) → Context7로 `/vercel/next.js` 최신 문서 조회 후 권장안 대비. Context7 부재 시 이 레이어 생략(graceful).
3. **출력**: 발견을 심각도로 그룹화한다 — 🔴 blocker(동작/접근성 결함) · 🟡 major(원칙 위반·성능) · 🟢 minor·nit(스타일). 각 항목은 `파일:라인 + 위반 원칙 + 권장 수정`으로 적는다. **코드를 고치지 않는다** — 리포트만 낸다.
4. **요약**: 심각도별 건수 + "blocker/major부터 수정 권장. minor/nit은 후속 PR로 분리 가능" 안내.

## 사용법

```
/omj-review                  작업 트리 미커밋+staged 변경 리뷰
/omj-review --base main      main 대비 브랜치 전체 diff 리뷰
/omj-review --base origin/main
```

> 구현 직후 PR 전에 한 번 돌려 FF/a11y/vercel/nextjs 위반을 차단한다. 시각 회귀가 목적이면 `/omj-verify <route>`를 쓴다.

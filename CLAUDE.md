# CLAUDE.md — oh-my-joy(OMJ) 레포 운영 규칙

이 저장소에서 작업하는 Claude 세션이 지킬 규칙. 매 턴 가볍게 유지(<120줄).

## OMJ란

oh-my-joy(마켓플레이스 `omj`)는 **코드↔Figma 프론트엔드 루프 전체**를 다루는 독립 Claude Code 플러그인이다 — ① design→code(퍼블리싱) ② 시각검증 ③ code↔Figma 토큰 sync(대화형). OMC(oh-my-claudecode)와 별개이며 같이 써도 무충돌(네임스페이스 `/omj*` vs `/omc-*`). 멘탈 모델: **"FE는 무조건 /omj로 시작 — 커지면 승인 후 OMC executor로 escalate. 백엔드/범용/리서치만 OMC 직접."** `/omj` 스펙은 사용자의 OMC 실행 도구(`/ralph` 순차·`/team` 병렬·`/goal` 장기, 계획은 `/omc-plan`·`/ralplan`)가 소비하는 입력이 된다 — 상세는 `docs/OMC-INTEGRATION.md`.

## 문서화 규율 (최우선)

기능 추가/변경 시 아래 셋을 **반드시 함께 갱신**한다(코드만 바꾸고 문서를 안 고치면 미완료):

1. **README**(사용법, **EN `README.md` + KO `README.ko.md` 동기화**) — 커맨드/플래그/동작 변경 반영. 심화는 `docs/OMC-INTEGRATION.md`.
2. **CHANGELOG**(항목) — 변경 1건 = 1항목.
3. **docs/PRINCIPLES.md**(동작 원리) — 원리·설계 결정·멘탈 모델이 바뀌면 갱신.

정본 사실(커맨드명·설치 문자열 `/plugin install oh-my-joy@omj`)은 **모든 문서·양 언어 README에서 일치**시킨다. 멘탈 모델 등 **서술형은 README(EN/KO 동기화)를 정본**으로 두고 다른 문서는 요약/링크만 한다(verbatim 복제를 강제하지 않음 — 드리프트 방지). README.md(EN)와 README.ko.md(KO)는 항상 같은 구조·같은 정본 사실을 유지한다.

## 커맨드 규칙

- 네이밍: 모든 커맨드는 `/omj-*` 접두(루트 `/omj` 제외).
- v1 커맨드: `/omj`(Plan 프라이머)·`/omj-review`(FF 코드 diff 리뷰)·`/omj-verify`·`/omj-fix`(시각 결함 수정 루프, 능동)·`/omj-sync`(토큰 code↔Figma sync, 대화형·능동)·`/omj-setup`(의존성 닥터). (v1.1: `/omj-push`·`/omj-spec`.)
- 새 커맨드 = `commands/<name>.md` + frontmatter: `description`, `argument-hint`, `allowed-tools`(**최소 권한** — read-only면 Write/Edit/Bash 넣지 않음).
- 동작의 SoT는 각 `commands/*.md` 본문. 코드/문서 작성 전 해당 파일을 Read해 확인.

## 핵심 설계 원칙 (요약 — 정본은 docs/PRINCIPLES.md)

- **Plan 네이티브 프라이머**: `/omj`는 read-only(Write/Edit/Bash 없음). 명세 수집 + 구현 스펙 author 후 **멈춤** — 코드를 직접 쓰지 않는다. 사용자의 ExitPlanMode 승인 후 구현이 실행된다.
- **스펙 포맷**: uSpec 섹션 분류(Anatomy/Structure/Color-토큰/Props·Variants/A11y/Motion) + 각 항목 **토스 FF 4기준(가독성·예측가능성·응집도·결합도) + 접근성** 적용.
- **code↔Figma 토큰 sync**: 코드가 기본 SoT, 충돌 시 사용자가 방향 선택(대화형 `sync`). `check`는 드리프트만 보고, `push`는 명시적 code-wins.
- **번들 최소화**: 자작 `frontend-fundamentals` 1개만 번들. vercel 스킬은 참조(`npx skills add/update`).
- **graceful degradation**: figma/context7/playwright-cli/OMC 부재는 에러가 아니라 스킵 + 안내.
- **처방 vs 검증 / 게이트 공존**: FF 지식은 `/omj`가 처방(prescriptive), `/omj-review`·`/omj-verify`가 검증(descriptive) — 같은 FF SoT를 단계만 달리. `/omj`(네이티브 plan 읽기 게이트)와 OMC 자체 게이트(실행)는 직교 — 기본은 승인 후 실행 직행(1회), `/ralplan` 합의는 모호·대규모만(2회). 정본은 README/PRINCIPLES.

## Git / 커밋

- conventional commit: `<type>(<scope>): <subject>`(feat/fix/chore/docs/refactor/test).
- ❌ **AI 서명·`Co-Authored-By: Claude`·"Generated with Claude Code" 절대 금지**.
- 한국어로 작성. 간결하게.

## Meta: 이 파일 유지보수

- 새 커맨드/원리/통합 추가 시 반영. 한 개념 = 한 줄 지향, **<120줄 유지**.
- 자명한 것·일반 개발 상식은 넣지 않음. 상세 원리는 docs/PRINCIPLES.md로 분리.

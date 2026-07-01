---
description: 디자인 토큰을 code↔Figma 동기화 — 드리프트를 클래스별로 묶어 방향(코드→Figma / Figma→코드 / 건너뛰기)을 물어 해소하는 대화형 sync (코드가 기본 SoT)
argument-hint: "[sync|check|push] [--tokens <path>]"
allowed-tools: Read, Edit, Grep, Glob, Skill, AskUserQuestion, mcp__plugin_figma_figma__get_variable_defs, mcp__plugin_figma_figma__use_figma
---

# /omj-sync — 디자인 토큰 sync (code ↔ Figma, 대화형)

`tokens.json`(W3C DTCG)과 Figma Variables의 드리프트를 계산하고, **충돌마다 방향을 사용자에게 물어** 해소한다.

> **원칙: 코드가 기본 SoT, 충돌은 사용자가 방향을 고른다.** 방향을 플러그인이 한쪽으로 못박지 않는다 — 드리프트가 있으면 클래스별로 묶어 `AskUserQuestion`으로 방향(코드→Figma / Figma→코드 / 건너뛰기)을 묻는다. 각 질문의 **1번(기본) 선택지는 코드 권위**다 — 값 불일치·코드에만은 "코드→Figma", Figma에만은 보수적 "건너뛰기"(코드를 SoT로 그대로 둠). 무심코 엔터만 쳐도 기존 code-wins와 같은 안전한 결과가 나온다. `push`는 그 질문 없이 "코드가 이김"을 명시적으로 택하는 빠른 경로, `check`는 읽기 전용 진단이다.

> ⚠️ **대상 파일 = 현재 Figma 데스크톱 앱의 활성 탭.** `use_figma`/`get_variable_defs`는 활성 탭 파일에서 작동하므로, 동기화할 **디자인 시스템 파일을 활성 탭으로 연 뒤** 실행한다(URL로 대상 파일을 지정할 수 없음). `sync`·`push`는 Figma write(그리고 `sync`는 코드 `Edit`)를 쓰는 **능동 op** — Figma 데스크톱이 켜져 있고 편집 권한이 있어야 하며 Plan 모드 밖에서 실행한다. `check`는 read-only라 어느 모드에서든 안전하다.

## 인자 (모드)

- `sync` (**기본** — 인자 없는 `/omj-sync`) — 드리프트를 계산해 **클래스별로 방향을 물어** 해소하는 대화형 모드.
- `check` — Figma Variables ↔ `tokens.json` 차이를 **읽기 전용 드리프트 리포트**로만 출력(수정·질문 없음).
- `push` — 질문 없이 `tokens.json`을 활성 탭의 Figma Variables로 일괄 생성/갱신(**명시적 code-wins 빠른 경로**).
- `--tokens <path>` — 토큰 파일 경로. 미지정 시 기본값은 레포 루트 `.omj/fe-context.md`의 `tokensPath`(있으면 `Read`로 읽어 사용), 없으면 `shared/tokens/tokens.json`.

> **모드별 권한 규율(본문이 강제).** `allowed-tools`는 커맨드 단위라 세 모드가 같은 권한을 공유하지만, `check`는 **절대 `Edit`/`use_figma`를 호출하지 않는다**(read-only). `sync`/`push`만 쓰기를 수행하며, Plan 모드에선 `Edit`/`use_figma`가 막혀 오늘의 `push`처럼 graceful하게 실패한다.

## 토큰 구조 (W3C DTCG)

`tokens.json`은 예시로 다음 계층을 가질 수 있다(구조는 프로젝트마다 다름):
- **Primitive** — `color/{스케일}/{단계}`(예: `color/gray/100`) 등 원시 스케일.
- **Semantic** — `color/{brand,fg,surface,line,feedback}/*` (Primitive를 alias 참조, 예: `{color.red.700}`). 디자인 작업은 semantic만 사용.
- **Theme** — `color/theme/*` (콘텐츠/테마 토큰 — 디자인 시스템과 격리).
- **Typography / Radius / Shadow / FontFamily** — 슬롯 기반.

## sync 절차 (대화형 기본)

1. **드리프트 계산(read-only)**: `--tokens` 경로의 `tokens.json`을 `Read`로 파싱하고, 활성 탭 Variables를 `get_variable_defs`로 읽어 비교한다. 드리프트를 세 클래스로 묶는다 — **값 불일치**(양쪽 존재·다름), **코드에만 있음**, **Figma에만 있음**. (Figma 미연결/권한 없음이면 에러로 죽지 말고 "데스크톱 앱을 켜고 대상 파일을 활성 탭으로" 안내 후 종료 — graceful.)
2. **드리프트가 없으면** "일치 — 해소할 드리프트 없음"으로 종료(질문하지 않는다).
3. **드리프트가 있으면 단 한 번의 `AskUserQuestion`** 으로 비어 있지 않은 클래스마다 1문항씩 묻는다(≤3문항 = 한 모달, 토큰마다 묻지 않음). 각 문항의 **1번 옵션이 코드 권위 기본값**이다:
   - **Q1 값 불일치 (N건)**: ① `코드→Figma (코드가 이김)`[기본] · ② `Figma→코드` · ③ `건너뛰기` · ④ `건별 선택`
   - **Q2 코드에만 (M건)**: ① `Figma에 생성 (code→Figma)`[기본] · ② `코드에서 제거` · ③ `건너뛰기`
   - **Q3 Figma에만 (K건)**: ① `건너뛰기`[기본·보수적] · ② `코드에 추가 (Figma→code)` · ③ `Figma에서 제거`
     - (Q3만 기본이 `건너뛰기`인 이유: Figma에만 있는 토큰은 건너뛰면 코드=SoT가 그대로 유지된다 — 이것이 "코드 권위"의 비파괴 해석이다. 자동 생성/삭제를 강요하지 않는다.)
4. **해소 액션**을 클래스별 선택대로 적용한다:
   - `코드→Figma` / `Figma에 생성`: **`figma-use` 스킬을 먼저 `Skill`로 invoke(MANDATORY)** → `use_figma`로 **영향받은 변수만** 타겟 생성/갱신(컬렉션 전체 재빌드 아님). Semantic은 Primitive를 **alias로 참조**(값 복제 아님). **순서 규칙**: Semantic alias가 참조하는 Primitive가 아직 Figma에 없으면 그 **Primitive를 먼저 생성/보장한 뒤** Semantic을 만든다(없는 변수를 참조하는 깨진 alias 방지).
   - `Figma→코드` / `코드에 추가`: `Edit`로 `tokens.json`의 **해당 노드 하나만 외과적으로** 수정한다(전체 `Write` 금지 — 순서·포맷·주석 보존). ↓ DTCG 가드레일 준수.
   - `Figma에서 제거` / `코드에서 제거`: 각각 `use_figma` 삭제 / `Edit`로 DTCG 노드 제거.
   - `건너뛰기`: no-op. 요약의 "미해소 드리프트"에 남긴다.
5. **`건별 선택`은 opt-in만**: 택하면 그 클래스를 후속 `AskUserQuestion`으로 파고든다(한 모달 ≤4건). 총 건수가 많으면(~12건 초과) "너무 많음 — 벌크로 처리" 경고 후 벌크로 폴백한다(프롬프트 피로 가드). 건별은 기본 경로가 아니다.
6. **요약**: 해소 건수(방향별)와 **미해소 드리프트** 건수를 출력한다.

### DTCG 참조 보존 가드레일 (Figma→코드 pull 시 hard rule)

Figma 값을 코드로 되돌릴 때 semantic 토큰을 raw hex로 납작하게 만들면 토큰 시스템이 소리 없이 깨진다 — 아래를 반드시 지킨다.

1. **Figma 변수가 alias면** DTCG **참조**로 기록한다(`"$value": "{color.red.700}"`), 해석된 원시값이 아니라. `get_variable_defs`에서 alias 대상을 못 얻고 flatten된 값만 있으면 3번으로 취급한다. **단, 참조 대상 토큰이 코드 `tokens.json`에 실제로 존재할 때만** 참조를 기록한다 — 코드에 없으면 dangling 참조가 되므로 **기본 건너뛰기 + 명시 표시**(건별 확인 시 그 Primitive도 함께 추가).
2. **Primitive raw→raw**(예: `color/gray/100` hex 차이)는 안전하게 raw `$value`를 `Edit`한다.
3. **semantic-integrity 충돌** — 코드 토큰은 **alias**인데 Figma 쪽이 **raw override**(또는 코드에 참조 대상이 없음)이면, pull은 semantic을 raw로 flatten해 시스템을 깬다. **기본 건너뛰기 + 명시 표시**하고, 별도 건별 확인이 있을 때만 덮어쓴다.
4. **그 외(위 3케이스에 안 걸리는 경우)** — 예: 코드가 semantic 슬롯을 raw로 저장(alias 아님)하고 Figma도 raw로 다른 값. 참조 구조가 걸린 게 없으면 raw→raw `Edit`로 처리하되, 슬롯 이름이 semantic 계층(`color/{brand,fg,surface,line,feedback}/*` 등)이면 **기본 건너뛰기 + 명시 표시**로 사용자 판단에 맡긴다(우발적 raw 고착 방지).

## check 절차 (read-only)

1. `tokens.json`을 읽고, 활성 탭 Variables를 `get_variable_defs`로 읽는다.
2. 양쪽을 비교해 **드리프트 리포트**를 출력한다: 코드에만 있음 / Figma에만 있음 / 값 불일치. **수정·질문 없음.**
3. 결론: "방향을 골라 해소하려면 `/omj-sync`(sync), 코드를 그대로 밀어넣으려면 `/omj-sync push`" 안내.

## 사용법

```
/omj-sync                                  # = sync (대화형: 클래스별로 방향을 물어 해소)
/omj-sync check                            # 드리프트 리포트만 (read-only)
/omj-sync push                             # 질문 없이 코드→Figma 일괄 반영 (명시적 code-wins)
/omj-sync push --tokens shared/tokens/tokens.json
```
> 실행 전: 동기화할 Figma 디자인 시스템 파일을 데스크톱 앱에서 **활성 탭**으로 열어 둔다.

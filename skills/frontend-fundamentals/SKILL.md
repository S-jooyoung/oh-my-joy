---
name: frontend-fundamentals
description: 토스 frontend-fundamentals 기반 프론트엔드 코드 품질 가이드. React 컴포넌트/훅을 작성·수정·리팩터링하거나 코드 리뷰할 때 가독성·예측가능성·응집도·결합도·접근성 원칙을 적용한다. 성능/번들은 vercel-react-best-practices, 컴포넌트 합성/확장성은 vercel-composition-patterns, Next.js 최신 API는 Context7로 라우팅한다. "컴포넌트 작성", "훅 작성", "리팩터링", "코드 리뷰", "가독성" 등에서 활성화.
license: MIT
metadata:
  author: areum
  version: '1.0.0'
  source: https://github.com/toss/frontend-fundamentals
---

# Frontend Fundamentals (아름 통합 품질 가이드)

토스 [frontend-fundamentals](https://github.com/toss/frontend-fundamentals)의 "변경하기 쉬운 코드" 원칙을 아름(Next.js 15 / React 19 / shadcn / Zustand) 스택에 맞춰 정리한 가이드. **확장성 있고, 접근성 좋고, 예측 가능한 코드**를 목표로 한다.

## 핵심 원칙: 좋은 코드의 4가지 기준

| 기준                           | 한 줄 정의                             | 상세                                                         |
| ------------------------------ | -------------------------------------- | ------------------------------------------------------------ |
| **가독성**(Readability)        | 코드가 한 번에 담는 맥락을 줄인다      | [references/readability.md](references/readability.md)       |
| **예측가능성**(Predictability) | 이름만 보고 동작을 예측할 수 있다      | [references/predictability.md](references/predictability.md) |
| **응집도**(Cohesion)           | 함께 바뀌는 코드는 함께 둔다           | [references/cohesion.md](references/cohesion.md)             |
| **결합도**(Coupling)           | 모듈 간 의존을 낮춰 변경 파급을 줄인다 | [references/coupling.md](references/coupling.md)             |

> **핵심 트레이드오프**: 네 기준을 한 번에 모두 충족하기는 어렵다. 지금 코드가 **장기적으로 수정하기 쉬워지려면** 어떤 가치를 우선할지 상황에 따라 판단한다. (예: 응집도를 높이려 추상화하면 결합도가 올라갈 수 있다.)

추가 영역:

- **접근성(a11y)** → [references/a11y.md](references/a11y.md) — 청첩장은 모바일 공유가 핵심이라 a11y·터치 타깃에 민감
- **번들/디버그** → [references/bundling-debug.md](references/bundling-debug.md)

## 빠른 점검표 (smell → remedy)

| Smell                                          | 원칙          | Remedy                                 |
| ---------------------------------------------- | ------------- | -------------------------------------- |
| 중첩 삼항 / 이름 없는 복잡 조건                | 가독성        | 명명된 변수·early return·`if`로 분리   |
| 한 컴포넌트에 viewer/admin 등 비동시 분기 혼재 | 가독성        | 분기별 컴포넌트 분리                   |
| 매직 넘버(`7`, `3600`) 산재                    | 가독성·응집도 | 의미 있는 상수로 명명                  |
| 이름과 다른 숨은 사이드이펙트                  | 예측가능성    | 이름-동작 일치, 부수효과 분리          |
| 같은 종류 함수가 제각각 반환 타입              | 예측가능성    | 반환 형태 통일                         |
| 함께 바뀌는 로직이 여러 파일에 흩어짐          | 응집도        | 한 단위(폼/도메인)로 모으기            |
| props 3단계 이상 drilling                      | 결합도        | composition/context (아래 라우팅 참조) |
| 책임 과다 훅(한 훅이 여러 관심사)              | 결합도        | 관심사별 훅 분리                       |
| `<img>` alt 누락 / 클릭만 가능한 `div`         | 접근성        | alt·시맨틱 태그·키보드 핸들러          |

## 통합 라우팅 규칙 (중복 금지, 조합 우선)

이 스킬은 **품질 4기준 + 접근성**만 소유한다. 아래 영역은 기존 스킬/도구로 위임한다:

- **성능·번들·리렌더·데이터 페칭** → `vercel-react-best-practices` 스킬을 참조한다. (waterfall 제거, `next/dynamic`, 메모이제이션 등 58규칙)
- **props 비대화·확장 가능한 컴포넌트 API·compound component** → `vercel-composition-patterns` 스킬을 참조한다.
- **Next.js App Router·Server Component·`fetch` 캐싱·metadata 등 버전 민감 주제** → **Context7 MCP로 `/vercel/next.js` 최신 공식 문서를 조회**한 뒤 권장안을 적용한다. (training data가 아닌 런타임 문서 기준)
  - Context7 MCP를 쓸 수 없는 환경(`context7` 플러그인 미설치·CI)이면 이 레이어는 생략하고 training-data 기반 일반 권장으로 대체한다(에러 아님).
- **심화 a11y/UX 감사** → `web-design-guidelines` 스킬의 동적 fetch 리뷰를 활용한다.

## 과설계 경고

원칙을 "지키려고" 다음을 하지 말 것:

- 단순한 로직을 불필요하게 추상화하지 않는다.
- 일어나지 않을 미래 유연성을 위해 깊은 계층 구조를 만들지 않는다.
- 나쁜 코드에 주석을 다는 대신 코드 자체를 개선한다.

## 연동 커맨드

`/omj-review` — 현재 브랜치/스테이징 diff를 위 4기준 + a11y + Vercel 성능/합성 + Next.js(Context7) 기준으로 통합 리뷰한다(read-only). `/omj`(처방)와 같은 FF SoT를 검증 단계에서 재사용한다.

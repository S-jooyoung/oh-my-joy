# 결합도 (Coupling)

> 토스 frontend-fundamentals 기반. 출처: https://github.com/toss/frontend-fundamentals

**원칙**: 모듈 간 의존을 낮춰, 한 곳을 바꿔도 다른 곳이 깨지지 않게 한다. 낮은 결합도는 곧 **확장성**이다.

## 1. props drilling 줄이기

props를 3단계 이상 그냥 통과시키면 중간 컴포넌트가 불필요하게 결합된다.

**Before**

```tsx
<Page invitation={inv}>
  <Section invitation={inv}>
    <Card invitation={inv}>
      <Actions invitation={inv} /> {/* 4단계 drilling */}
```

**After** — composition 또는 context로 중간 단계의 결합을 끊는다. **상세 패턴은 `vercel-composition-patterns` 스킬을 참조한다** (compound component, context provider, render props 등 — 이 스킬에서 중복 설명하지 않는다).

```tsx
// 핵심 아이디어: 중간 컴포넌트가 invitation을 몰라도 되게 한다
<InvitationProvider value={inv}>
  <Page>
    <Section>
      <Card>
        <Actions /> {/* useInvitation()으로 직접 소비 */}
```

## 2. 책임 과다 훅 분리

한 훅이 여러 관심사를 가지면, 한 관심사 변경이 무관한 사용처까지 리렌더/재실행시킨다.

**Before**

```ts
function useInvitationPage(id: string) {
  // 데이터 페칭 + 폼 상태 + 갤러리 업로드 + 공유 로직 전부
}
```

**After** — 관심사별로 분리해 의존을 좁힌다.

```ts
function useInvitation(id: string) { ... }      // 데이터
function useInvitationForm(data) { ... }         // 폼
function useGalleryUpload(id: string) { ... }    // 업로드
```

## 3. 중복 제거 vs 성급한 추상화

> 결합도의 가장 큰 함정: **잘못된 추상화는 중복보다 나쁘다.**

두 코드가 "지금 우연히 같아 보인다"고 묶으면, 한쪽 요구사항이 바뀔 때 추상화가 깨지며 양쪽이 결합된다. **함께 바뀔 것이 확실할 때만** 추상화한다.

## smell → remedy

| Smell                       | Remedy                                                   |
| --------------------------- | -------------------------------------------------------- |
| props 3단계+ drilling       | composition/context (`vercel-composition-patterns` 참조) |
| 한 훅이 여러 관심사         | 관심사별 훅 분리                                         |
| boolean prop 난립           | 합성 패턴 (`vercel-composition-patterns` 참조)           |
| 우연한 중복을 성급히 추상화 | 함께 바뀔 것이 확실할 때까지 중복 허용                   |

## 과설계 경고

- 결합도를 낮추려 모든 것을 context로 빼면 추적이 어려워진다. 2단계 이하 props 전달은 그대로 두는 게 낫다.
- "재사용할지도 모른다"는 가정만으로 공통 모듈을 만들지 않는다.

> 성능 관점(리렌더 최소화, 메모이제이션)은 `vercel-react-best-practices` 스킬로 위임한다.

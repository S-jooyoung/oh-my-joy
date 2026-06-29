# 가독성 (Readability)

> 토스 frontend-fundamentals 기반. 출처: https://github.com/toss/frontend-fundamentals

**원칙**: 코드가 한 번에 담는 맥락(context)을 줄인다. 읽는 사람이 동시에 머릿속에 올려야 할 정보가 적을수록 읽기 쉽다.

## 1. 비동시(non-concurrent) 코드 분리

서로 다른 상황에서만 실행되는 분기를 한 컴포넌트에 섞지 않는다.

**Before** — 한 컴포넌트가 viewer/admin 두 맥락을 동시에 안고 있다.

```tsx
function InvitationActions({ invitation, role }: Props) {
  return (
    <div>
      {role === 'admin' ? (
        <button onClick={() => deleteInvitation(invitation.id)}>삭제</button>
      ) : (
        <button onClick={() => shareInvitation(invitation.id)}>공유</button>
      )}
    </div>
  );
}
```

**After** — 분기별로 컴포넌트를 나눠 각자 하나의 맥락만 갖는다.

```tsx
function AdminInvitationActions({ invitation }: { invitation: Invitation }) {
  return <button onClick={() => deleteInvitation(invitation.id)}>삭제</button>;
}

function GuestInvitationActions({ invitation }: { invitation: Invitation }) {
  return <button onClick={() => shareInvitation(invitation.id)}>공유</button>;
}
```

## 2. 복잡한 조건에 이름 붙이기

이름 없는 boolean 식은 "무엇을 의미하는지"를 읽는 사람이 매번 해석해야 한다.

**Before**

```tsx
if (user.age >= 18 && !user.isBanned && user.emailVerified) {
  showPurchaseButton();
}
```

**After**

```tsx
const canPurchase = user.age >= 18 && !user.isBanned && user.emailVerified;
if (canPurchase) {
  showPurchaseButton();
}
```

## 3. 중첩 삼항 제거

**Before**

```tsx
const label = isLoading
  ? '불러오는 중'
  : error
    ? '오류'
    : data
      ? '완료'
      : '대기';
```

**After** — early return 또는 `if`/매핑 객체로 평탄화.

```tsx
function getLabel({ isLoading, error, data }: Status) {
  if (isLoading) return '불러오는 중';
  if (error) return '오류';
  if (data) return '완료';
  return '대기';
}
```

## 4. 매직 넘버 명명

```tsx
// Before
setTimeout(refetch, 3600000);

// After
const ONE_HOUR_MS = 60 * 60 * 1000;
setTimeout(refetch, ONE_HOUR_MS);
```

## smell → remedy

| Smell                          | Remedy                            |
| ------------------------------ | --------------------------------- |
| 중첩 삼항                      | `if`/early return/매핑 객체       |
| 이름 없는 복잡 boolean         | 의미 있는 변수로 추출             |
| 한 컴포넌트에 비동시 분기 혼재 | 분기별 컴포넌트 분리              |
| 매직 넘버                      | 명명된 상수                       |
| 비선형 흐름(여기저기 점프)     | 조건 객체/함수로 묶어 한 흐름으로 |

## 과설계 경고

- 한두 줄짜리 단순 로직까지 함수로 추출하면 오히려 맥락이 늘어난다.
- 조건 추출은 "이름이 의미를 더할 때"만. `const isTrue = flag;` 같은 동어반복은 금지.

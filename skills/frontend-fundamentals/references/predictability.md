# 예측가능성 (Predictability)

> 토스 frontend-fundamentals 기반. 출처: https://github.com/toss/frontend-fundamentals

**원칙**: 함수·변수의 이름과 시그니처만 보고 동작을 예측할 수 있어야 한다. 숨은 동작이 없을수록 사용처에서 실수가 줄어든다.

## 1. 숨은 사이드이펙트 제거

이름이 "조회"인데 내부에서 상태를 바꾸면 호출자가 예측할 수 없다.

**Before** — `getPost`가 몰래 로깅+캐시 갱신까지 한다.

```ts
function getPost(id: string) {
  const data = api.fetchPost(id);
  analytics.track('post_viewed', { id }); // 숨은 부수효과
  cache.set(id, data); // 숨은 부수효과
  return data;
}
```

**After** — 조회와 부수효과를 분리한다.

```ts
function getPost(id: string) {
  return api.fetchPost(id);
}

// 부수효과는 호출하는 쪽에서 명시적으로
const post = getPost(id);
analytics.track('post_viewed', { id });
```

## 2. 이름과 동작 일치

```ts
// Before: 이름은 boolean을 기대하게 하는데 Promise를 반환
function checkLogin(): Promise<User> { ... }

// After: 동작에 맞는 이름
function fetchLoggedInUser(): Promise<User> { ... }
```

## 3. 같은 종류 함수의 반환 타입 통일

같은 계열의 함수가 어떤 건 `null`, 어떤 건 throw, 어떤 건 `undefined`를 반환하면 호출처마다 다르게 처리해야 한다.

**Before**

```ts
function fetchUser(id: string): User | null { ... }
function fetchPost(id: string): Post { /* 없으면 throw */ }
function fetchComment(id: string): Comment | undefined { ... }
```

**After** — 한 계열은 같은 규약으로.

```ts
// 모두 "없으면 null" 규약으로 통일
function fetchUser(id: string): User | null { ... }
function fetchPost(id: string): Post | null { ... }
function fetchComment(id: string): Comment | null { ... }
```

## 4. 서버 액션 반환 형태 통일

서버 액션이 `{ success: boolean, error?: string }` 같은 형태를 쓴다면 한 프로젝트 안에서 일관되게 따른다. 어떤 액션만 다른 형태를 반환하면 예측 가능성이 깨진다.

## smell → remedy

| Smell                        | Remedy                               |
| ---------------------------- | ------------------------------------ |
| 조회 함수의 숨은 상태 변경   | 부수효과를 호출처로 분리             |
| 이름과 다른 반환 타입        | 동작에 맞게 rename                   |
| 동종 함수의 제각각 반환 규약 | 한 계열 규약 통일(null/throw 중 택1) |
| 암묵적 전역 의존             | 인자로 명시적으로 주입               |

## 과설계 경고

- 예측가능성을 위해 모든 함수를 순수 함수로 만들 필요는 없다. 부수효과가 **이름에 드러나면** 충분하다 (예: `logPostView`).

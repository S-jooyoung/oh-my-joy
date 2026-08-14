---
description: 승인된 스펙·플랜을 durable 골 단위로 끝까지 완주시키는 단일 owner 순차 실행 루프 — "이 플랜 goal-loop로 돌려줘", 여러 턴·중단 후 재개·완료 증거가 필요한 작업이면 이 커맨드 (Plan 해제 후 실행). 골 상태는 .omj/goals/에 영속되고 완료는 증거 객체 없이 성립하지 않는다. 정규 호출은 /oh-my-joy:goal-loop
argument-hint: "[스펙/플랜 경로 또는 paste] [--slug <name>]"
allowed-tools: Read, Grep, Glob, AskUserQuestion, Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/goal-state.mjs:*)
---

# /oh-my-joy:goal-loop — durable 골 실행 루프

승인된 스펙·플랜을 골 목록으로 쪼개 `.omj/goals/<slug>/`에 영속시키고, **한 번에 하나의
골만** 잡아 구현→검증→증거 기록→다음 골로 완주한다. 세션이 끊겨도 같은 slug로 재개된다.

> ⚙️ **상태 변경은 validator가 유일한 경로다.** 이 커맨드의 allowed-tools에는
> Write/Edit가 없다 — `.omj/goals/`의 모든 생성·전이·종료는
> `node ${CLAUDE_PLUGIN_ROOT}/scripts/goal-state.mjs` 호출로만 일어나고, 스크립트는
> 유효 전이표·증거 필수조건·append-only ledger·원자적 스냅샷 교체를 검사해 위반을
> non-zero로 거부한다. 상태 파일을 직접 쓰려는 시도는 사전승인 밖이라 권한 프롬프트로
> 드러난다(PRINCIPLES ③ — 조용한 우회 불가).
>
> **증거 수집 명령은 사전승인하지 않는다.** 프로젝트마다 다른 테스트·빌드 명령을
> 미리 허용하면 좁은 사전승인이 임의 실행으로 세탁된다. 검증 명령(`npm test` 등)은
> 실행할 때마다 권한 프롬프트가 뜨는 것이 **의도된 UX**다 — 그 확인이 곧 증거의
> 신뢰 근거가 된다.

## 입력

- 승인된 스펙/플랜: 파일 경로 또는 **paste 전문**(1급 입력 — `/omj`·`/oh-my-joy:deep-interview` 산출물 포함).
- `--slug <name>`: 상태 디렉터리 이름(소문자·숫자·하이픈). 기존 slug면 **재개 모드**.

## 흐름

1. **초기화** — 스펙에서 독립적으로 완료 가능한 골 목록(제목·목표)을 추려 확인받고:
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/goal-state.mjs init --slug <slug> --brief-file <spec> --goals-json '<goals>'`
   (재개 모드면 init 대신 `status`로 현재 상태를 읽고, 스냅샷·ledger가 어긋나 있으면
   `reconcile`로 ledger에서 재유도한 뒤 남은 골부터 잇는다.)
2. **골 시작** — `transition --goal <id> --to active`. 전이표는 pending→active,
   active→complete/blocked/failed, blocked→active, failed→active. **active는 동시에
   하나뿐**(단일 owner) — 동시 writer·병렬 mutation은 지원하지 않는 계약이다.
3. **구현** — 현 세션이 직접 구현한다. FE 골이면 `figma-implementer` 에이전트가
   실행자다. 병렬 서브에이전트는 **read-only 조사에만** 쓴다 — 상태 파일을 쓰는 건
   언제나 이 세션 하나다.
4. **검증·완료** — 골의 검증 명령을 실행하고(권한 프롬프트 승인) 결과를 증거로
   `transition --goal <id> --to complete --evidence-json '<evidence>'`. 증거는 원문
   출력 덤프가 아니라 **명령·종료 코드·요약**이다(비밀값·개인정보 금지):

```json
{
  "verification": {
    "status": "passed",
    "commands": ["node --test"],
    "evidence": "157 passed, 0 failed — 신규 goal-state 스위트 포함"
  }
}
```

5. **막힘 처리** — 스스로 풀 수 있는 blocker(빌드 깨짐, 누락 파일)는 **멈추지 말고
   해소**한다. 사용자만 풀 수 있는 blocker(자격증명, 외부 승인, 스코프 결정)일 때만
   `transition --to blocked --reason '<이유>'` 후 `AskUserQuestion` 1회 — 실행 중
   발견된 데이터에 의존하는 결정이라 ⑪의 네 조건을 충족한다. 리뷰·검증에서 후속
   작업이 드러나면 골을 조작하지 말고 `add-goal`로 blocker 골을 append한다.
6. **종료** — 모든 골이 증거를 갖춘 complete가 되면 `close --slug <slug>`. 하나라도
   pending/blocked/failed면 close는 거부된다 — 우회 경로는 없다.

ledger(`ledger.jsonl`)에는 `plan_created`·`goal_started`·`goal_completed`·
`goal_blocked`·`goal_resumed`·`goal_failed`·`goal_added`·`plan_closed` 이벤트가
append-only로 쌓인다({"event": "goal_completed"} 형태) — 진행 보고·재개·사후 감사가
전부 이 파일 하나로 가능하다.

## git 정책

`.omj/goals/`는 **operational state라 커밋하지 않는다** — `.omj/baselines/`와 같은
등급으로 소비 프로젝트 `.gitignore`에 추가한다(`/omj-setup`이 스캐폴딩 시 안내).
커밋 대상인 `.omj/fe-context.md`(프로젝트 선언)와 등급이 다르니 `.omj/` 통째 ignore는
fe-context를 잃는다 — `goals/`·`baselines/`만 지정한다.

## 사용법

```
/oh-my-joy:goal-loop ./approved-spec.md --slug search-form
/oh-my-joy:goal-loop --slug search-form          # 중단된 루프 재개
```

> 방법론 출처: gajae-code의 durable goal 루프와 oh-my-claudecode의 goals/ledger
> 상태 계약을 차용해 재작성 — [NOTICE.md](../NOTICE.md). 런타임은 이식하지 않았다.

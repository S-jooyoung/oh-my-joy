---
description: 이미 존재하는 스펙·플랜 아티팩트를 독립 critic이 적대 리뷰해 합의로 만드는 read-only 커맨드 — "이 플랜 합의 리뷰해줘", "설계 결정에 이견 여지가 있는지 봐줘"처럼 검토할 산출물이 이미 있을 때 이 커맨드. 요구 자체가 흐릿하면 /oh-my-joy:deep-interview가 먼저다(그건 Q&A 명료화, 이건 아티팩트 적대 리뷰 — 다른 함수). 정규 호출은 /oh-my-joy:ralplan
argument-hint: "[스펙/플랜 경로 또는 paste]"
allowed-tools: Read, Grep, Glob
---

# /oh-my-joy:ralplan — 플랜 합의 리뷰

이미 만들어진 스펙·플랜을 정규화하고, **독립 critic이 반박**하게 한 뒤, 수렴하면
`pending approval`로 멈춘다. 코드를 쓰지 않고 파일도 만들지 않는다 — 산출은 네이티브
Plan/응답 본문이고, 파일화는 승인 후 실행 단계의 몫이다(paste가 1급 입력).

> ✅ **read-only.** allowed-tools에 Write/Edit/Bash/Task가 없다. critic 리뷰는 아래
> 절차대로 **독립 서브에이전트**가 맡되, 서브에이전트 표면이 없는 환경에서는 현재
> 세션이 분리된 critic 패스로 degrade하고 "독립성 저하" 라벨을 결과에 명시한다(⑨).

## 진입 조건

- 입력에 검토할 아티팩트(스펙/플랜 파일 경로 또는 paste 전문)가 **있어야 한다**.
  없으면 사용법을 출력하고 종료 — 요구가 아직 흐릿한 상태라면
  `/oh-my-joy:deep-interview`로 안내한다.
- 설계 결정이 자명하고 이견 위험이 없는 작은 플랜이면 "합의 리뷰 없이 바로 진행
  권장"을 근거와 함께 출력하고 종료한다 — 모든 플랜에 리뷰 비용을 붙이지 않는다.

## 흐름 (v1 — critic 1패스, 최대 2회)

1. **Planner 정규화** — 현재 세션이 아티팩트를 합의 가능한 형태로 정리한다:
   Decision Drivers(상위 3) · **Viable Options ≥2**(단일 옵션이면 대안 무효화 근거) ·
   검증 가능한 수용 기준 · ADR(결정·근거·버린 대안·결과). 얇은 입력은 나열만 하지
   말고 누락 스코프·가정을 표면화해 풍부화한다.
2. **Critic 독립 리뷰** — `plan-critic` 에이전트(도구: Read/Grep/Glob — 소유 정의라
   도구 표면이 테스트로 고정된다)에게 정규화된 플랜과 원본 아티팩트 경로를 넘긴다.
   critic은 파일 참조를 실제로 읽어 검증하고, 대표 구현 항목 2~3개를 실제 코드에
   대해 시뮬레이션하며, 치명 결함과 "얇아서 확장 필요"를 구분해 판정한다
   (`OKAY`/`ITERATE`/`REJECT` + 근거 목록).
3. **개정 루프** — `ITERATE`면 지적을 반영해 1회 개정 후 재리뷰. **리뷰 라운드는
   최대 2회**다.
4. **종결** —
   - `OKAY` → 합의 플랜을 `pending approval`로 제시하고 멈춘다(ExitPlanMode/승인은
     사용자 몫 — 이 커맨드는 실행을 시작하지 않는다).
   - 2라운드 후에도 미수렴 → **PLANNING-STUCK** 선언: 최선 플랜을 보존하고, 미해소
     쟁점을 항목별로 남기며, **실행하지 않는다**. 쟁점 해소는 사용자 결정이나
     `/oh-my-joy:deep-interview`(요구 층 문제일 때)로 돌린다.

## 승인 후

합의 플랜의 실행은 기존 레인 선택을 따른다 — FE 구현이면 `/omj` 스펙으로 발전,
durable 완주가 필요하면 `/oh-my-joy:goal-loop`, OMC/OMX가 있으면 해당 레인
(`docs/EXECUTION-HANDOFF.md` 정본).

## 사용법

```
/oh-my-joy:ralplan ./approved-spec.md
/oh-my-joy:ralplan   (플랜 전문을 paste로 붙여넣기)
```

> 방법론 출처: gajae-code ralplan의 합의 구조(리뷰 join·PLANNING-STUCK·RALPLAN-DR)를
> 차용해 v1은 critic 1패스로 축소 재작성 — [NOTICE.md](../NOTICE.md). Architect 2차
> 패스는 security·migration·public API 같은 고위험 트리거가 실측될 때 추가한다.

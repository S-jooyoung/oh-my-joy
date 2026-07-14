# 프로젝트 acceptance 축 — 자주 빠뜨리는 것을 스펙에 강제하는 *메커니즘*

FF 4기준 + 접근성 + 반응형·토큰은 **모든** 프로젝트에 보편적이다(이미 다른 `references/*`와 `commands/omj.md` Phase 2가 다룬다). 그런데 **재작업을 부르는 누락**은 보통 *그 프로젝트만의* 특수 조건에서 나온다 — 예: 다국어 병행, 테마/브랜드 모드, 통화·포맷 규칙, 특정 디바이스 우선순위. 이런 건 프로젝트마다 달라서 **플러그인이 특정 축을 강제하면 안 된다**(다른 레포·다른 사용자에겐 거짓이 된다).

> **원칙: OMJ는 acceptance 축을 *빌트인으로 강제하지 않는다.*** **메커니즘만 제공**하고(예시는 들되 기본값으로 탑재하지 않음), 무엇을 점검할지는 각 프로젝트가 선언한다. 그래야 회사 레포든 개인 프로젝트든 제3자의 오픈소스 사용이든 범용으로 동작한다.

## 동작

1. 레포 루트에 **`.omj/fe-context.md`** 가 있으면 → 거기 선언된 acceptance 축을 읽어 `/omj` 스펙의 acceptance 기준 + `/omj-fix` 진단 체크 + `design-qa` 조건부 항목(Story·i18n)에 포함한다.
2. 없으면 → 보편 FF 기준(가독성·예측가능성·응집도·결합도·접근성 + 반응형·토큰)만 적용한다(graceful — 에러 아님).
3. **스캐폴딩 진입점은 `/omj-setup`** — 파일이 없으면 setup이 생성을 제안하고, 감지된 후보(i18n 디렉터리·토큰 시스템·테마 클래스)는 **주석으로만** 적는다(축 자동 선언 금지).

## 토큰 시스템 탐지 순서 (SoT — `/omj` Color/Tokens·`/omj-setup`·`/omj-sync`가 이 순서를 참조)

1. `.omj/fe-context.md`의 `tokensPath:` 선언 (`.json` = DTCG, `.css` = CSS custom properties)
2. 관례 경로 `shared/tokens/tokens.json` (존재 시)
3. Tailwind 설정 — `tailwind.config.*`의 theme 확장 또는 Tailwind v4 `@utility`/`@theme` CSS 정의
4. 전역 CSS 커스텀 프로퍼티(`:root { --* }` 정의 파일)

어느 단계에서 발견되든 **그 시스템의 시맨틱 클래스/변수로 매핑하는 것이 스펙의 의무**다 — tokens.json이 없다는 사실은 raw hex/px 사용의 면죄부가 아니다. (`/omj-sync`의 sync/push/extract만 파일 기반 토큰 스토어(1·2 또는 `.css`)를 필요로 한다.)

## `.omj/fe-context.md` 포맷 (프로젝트가 작성 — **플러그인엔 미포함**)

```
tokensPath: <semantic 토큰 파일 경로>   # 선택 (.json=DTCG, .css=custom properties)
designDocPath: <브랜드/조합 규칙 문서>   # 선택 — 선언 시 /omj Phase 1이 Read
storybook: true|false                  # 선택 — true면 design-qa Story 체크·check-story-exists 훅 활성
verifySetup: <시각검증 절차 문서/절>     # 선택 — /omj-verify·/omj-fix가 관찰 전 Read (인증 우회·API 목)
conventions:                           # 선택 — 프로젝트 코드 구조 선언 (예: 1컴포넌트=4파일)
  - <규칙 1>
acceptance:                            # 선택 — 이 프로젝트에서 구현 시 자주 빠뜨리는 축을 한 줄씩
  - <축 1>
  - <축 2>
```

**예시 (어디까지나 *그 프로젝트의* 선언일 뿐, OMJ 기본값이 아니다):**

```
tokensPath: src/tokens/colors.css
storybook: true
verifySetup: docs/VERIFY-SETUP.md
acceptance:
  - 지원 로케일 전부 동시 갱신(메시지 키 누락 0, 통화/줄바꿈 로케일별)
  - 라우트별 테마/브랜드 모드 토큰 확인
  - 모바일·데스크탑 동시 확인
```

단일 로케일·단일 테마인 개인 프로젝트라면 `acceptance:`를 비우거나 파일 자체를 두지 않으면 된다 — 그 경우 보편 FF 기준만 적용된다. 즉 **무엇을 강제할지는 100% 프로젝트의 선택**이고, 플러그인은 그 선언을 읽어 스펙에 끼워줄 뿐이다.

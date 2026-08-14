# 기여 가이드

oh-my-joy는 **동작이 마크다운으로 선언되는** Claude Code 플러그인이다. 코드가 적은 대신 문서가 곧 스펙이라, 이 레포의 규율은 대부분 "무엇을 같은 커밋에 함께 바꾸는가"에 관한 것이다.

## 시작

```bash
git clone https://github.com/S-jooyoung/oh-my-joy.git
cd oh-my-joy
node --test          # 의존성 설치 단계가 없다 — Node 20.11+ 만 있으면 된다
```

로컬에서 플러그인으로 써 보려면 Claude Code에서:

```
/plugin marketplace add <이 레포의 로컬 경로>
/plugin install oh-my-joy@omj
```

## 절대 하지 않는 것

- **`hooks/hooks.json`을 만들지 않는다.** 존재하는 순간 플러그인을 켠 *모든* 레포에서 훅이 자동 발화한다. 훅 스크립트는 `templates/hooks/`의 템플릿이고, 활성화는 `/omj-setup`이 소비 프로젝트로 복사할 때만 일어난다(opt-in). 이 불변식은 테스트가 강제한다.
- **커밋 메시지에 AI 서명을 남기지 않는다.** `Co-Authored-By: Claude`, "Generated with …" 류 금지.
- **본문 절차에 호출 지점이 없는 도구를 `allowed-tools`에 선언하지 않는다.** 위험한 실행을 굳이 사전승인하지 않는 것 자체가 안전 게이트다(권한 프롬프트가 사용자 확인 지점이 된다).

## 변경할 때 함께 바꿔야 하는 것

기능을 추가·변경하면 아래 셋을 **같은 커밋에** 넣는다. 코드만 바꾸고 문서를 안 고치면 미완료다.

1. **README** — `README.md`(EN)와 `README.ko.md`(KO)를 **동시에**. 두 파일은 같은 구조·같은 정본 사실을 유지한다.
2. **CHANGELOG** — 변경 1건 = 1항목.
3. **`docs/PRINCIPLES.md`** — 원리·설계 결정·멘탈 모델이 바뀔 때만.

`tests/docs-consistency.test.mjs`가 이 규율의 기계적으로 확인 가능한 부분(README 패리티, 링크 도달성, 릴리스 링크, 커맨드 목록 일치)을 검사한다.

## 커밋

- Conventional Commits: `<type>(<scope>): <subject>` — `feat`/`fix`/`chore`/`docs`/`refactor`/`test`/`ci`.
- **한국어로, 간결하게.** 제목은 무엇을 했는지, 본문은 **왜 그렇게 했는지**(어떤 문제가 있었고 어떤 대안을 버렸는지)를 적는다.
- **1 커밋 = 1 관심사 + 그 관심사의 문서 갱신.** 릴리스 컷(버전 범프 + CHANGELOG 확정)만 별도 커밋으로 둔다.

## 새 커맨드를 추가할 때

- 파일: `commands/<name>.md`. 네이밍은 2축 — OMJ 고유 FE 루프 동사는 `/omj-*` 접두(루트 `/omj` 제외), 이름 있는 방법론·루브릭 커맨드(`deep-interview`·`ff-review` 류)는 무접두 basename + `tests/plugin-manifest.test.mjs`의 `WORKFLOW_COMMANDS` 등재. 무접두 커맨드는 문서에서 항상 `/oh-my-joy:<name>` 정규 호출로 표기한다(bare 표기는 테스트가 차단).
- frontmatter: `description`, `argument-hint`, `allowed-tools`(**최소 권한** — read-only면 `Write`/`Edit`/`Bash`를 넣지 않는다).
- 동작의 SoT는 그 파일 본문이다. 다른 문서는 요약·링크만 하고 임계값·규칙을 재정의하지 않는다.
- README(EN/KO) 커맨드 표에 추가한다 — 빠지면 테스트가 실패한다.

## 릴리스

**배포 모델.** 마켓플레이스(`/plugin install oh-my-joy@omj`)는 태그를 받지 않고 main HEAD를 shallow clone으로 내려받되, **`plugin.json`의 `version`이 배포 게이트**다 — 이 문자열이 바뀌지 않는 한 기존 설치자는 캐시된 버전을 유지한다(수동 강제 업데이트 제외). 즉 **버전 범프가 main에 머지되는 순간이 곧 배포**이고, 태그·GitHub Release는 사람이 읽는 이력 라벨이다. main에 기능이 쌓여도 릴리스를 컷하기 전에는 사용자에게 도달하지 않는다.

절차:

1. 평소처럼 `[Unreleased]`에 변경 항목을 서술한다 — 산문은 사람이 쓴다(자동 생성 없음).
2. `node scripts/release.mjs cut --version X.Y.Z` → CHANGELOG 절 확정·링크 정의·버전 4표면(plugin.json / marketplace.json 2곳 / package.json)이 한 번에 변환된다. diff를 검토하고 산문을 다듬는다.
3. `release/vX.Y.Z` 브랜치에서 `chore(release): vX.Y.Z` 커밋 → 동일 제목 PR → CI green 확인 후 머지.
4. **태깅·GitHub Release는 자동이다** — 머지 push에서 `.github/workflows/release-tag.yml`이 plugin.json 버전의 태그를 방금 머지된 main 커밋에 부착하고, CHANGELOG 해당 절을 본문으로 Release를 발행한다. **수동 `git tag`는 금지** — v0.4.0 태그가 main 밖 고아 커밋에 붙었던 사고가 이 규칙의 근거다(부분 실패는 워크플로우 수동 재실행으로 치유, 로직이 멱등).

번들 스킬(`skills/*/SKILL.md`)의 `metadata.version`은 플러그인 버전과 무관한 독립 semver다 — 스킬 내용(SKILL.md·`references/`) 변경이 있는 릴리스에서만 함께 올린다.

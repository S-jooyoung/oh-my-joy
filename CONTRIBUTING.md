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

- 파일: `commands/<name>.md`. 네이밍은 2축 — FE 루프 커맨드는 `/omj-*` 접두(루트 `/omj` 제외), 범용 워크플로우 커맨드는 무접두 basename + `tests/plugin-manifest.test.mjs`의 `WORKFLOW_COMMANDS` 등재. 워크플로우 커맨드는 문서에서 항상 `/oh-my-joy:<name>` 정규 호출로 표기한다(bare 표기는 테스트가 차단).
- frontmatter: `description`, `argument-hint`, `allowed-tools`(**최소 권한** — read-only면 `Write`/`Edit`/`Bash`를 넣지 않는다).
- 동작의 SoT는 그 파일 본문이다. 다른 문서는 요약·링크만 하고 임계값·규칙을 재정의하지 않는다.
- README(EN/KO) 커맨드 표에 추가한다 — 빠지면 테스트가 실패한다.

## 릴리스

1. `CHANGELOG.md`의 `[Unreleased]`를 새 버전 절로 확정하고 링크 정의를 추가한다.
2. `.claude-plugin/plugin.json`과 `marketplace.json`의 버전을 올린다(테스트가 두 값의 일치를 검사한다).
3. `chore(release): vX.Y.Z` 커밋 후 `git tag -a vX.Y.Z`.

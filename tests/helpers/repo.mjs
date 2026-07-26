/**
 * 테스트 공용 헬퍼 — 레포 경로 해석, 훅 스크립트 실행, 임시 프로젝트 픽스처.
 *
 * 의존성 0개(Node 내장 모듈만). 플러그인 자체는 런타임 의존성이 없고,
 * 검증 하네스도 같은 제약을 지켜 `npm i` 없이 `node --test`만으로 돌아간다.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const repoPath = (...segments) => path.join(REPO_ROOT, ...segments);

export const readRepoFile = (...segments) => readFileSync(repoPath(...segments), 'utf8');

export const readJson = (...segments) => JSON.parse(readRepoFile(...segments));

/** 레포에 커밋된 마크다운 전체(테스트 픽스처 제외). */
export function listMarkdownFiles() {
  const out = execFileSync('git', ['ls-files', '*.md'], { cwd: REPO_ROOT, encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

export const listCommandFiles = () =>
  readdirSync(repoPath('commands'))
    .filter((f) => f.endsWith('.md'))
    .sort();

export const listAgentFiles = () =>
  readdirSync(repoPath('agents'))
    .filter((f) => f.endsWith('.md'))
    .sort();

/**
 * 코드 블록과 인라인 코드를 제거한다. 코드 span 안의 `[텍스트](경로)`는 링크가 아니라
 * 링크를 *설명하는* 예시이므로, 링크 검사가 그것까지 잡으면 문서를 못 쓰게 된다.
 */
export const stripCode = (source) =>
  source.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');

const unquote = (value) => value.trim().replace(/^"(.*)"$|^'(.*)'$/, (_m, d, s) => d ?? s);

/**
 * 마크다운 frontmatter를 파싱한다. YAML 파서를 들이지 않고 이 레포가 실제로 쓰는
 * 부분집합만 다룬다: `key: value` 한 줄, `- item` 리스트, 한 단계 중첩 매핑.
 *
 * **지원 범위를 넘는 문법은 던진다.** 조용히 드롭하면 테스트가 "값이 없다"와
 * "파서가 못 읽었다"를 구분하지 못해 거짓 안심을 만든다 — 실제로 `metadata:`
 * 중첩 매핑이 통째로 소실되던 것이 그 사례였다. 블록 스칼라(`>`/`|`)처럼
 * 여기서 다루지 않는 문법이 들어오면 파서를 확장하라는 신호로 실패시킨다.
 */
export function parseFrontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source);
  if (!match) return null;

  const fields = {};
  let pendingKey = null; // 값이 비어 있던 직전 키 — 다음 들여쓴 줄이 리스트인지 매핑인지로 확정된다

  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;

    const indented = /^\s+(.*)$/.exec(line);
    if (indented) {
      if (!pendingKey) throw new Error(`지원하지 않는 frontmatter 들여쓰기: ${line}`);

      const listItem = /^-\s+(.*)$/.exec(indented[1]);
      if (listItem) {
        if (!Array.isArray(fields[pendingKey])) fields[pendingKey] = [];
        fields[pendingKey].push(unquote(listItem[1]));
        continue;
      }

      const nested = /^([A-Za-z0-9_-]+):\s*(.+)$/.exec(indented[1]);
      if (!nested) throw new Error(`지원하지 않는 frontmatter 문법: ${line}`);
      if (Array.isArray(fields[pendingKey]) && fields[pendingKey].length > 0) {
        throw new Error(`리스트와 매핑을 섞을 수 없습니다: ${line}`);
      }
      if (!fields[pendingKey] || Array.isArray(fields[pendingKey])) fields[pendingKey] = {};
      fields[pendingKey][nested[1]] = unquote(nested[2]);
      continue;
    }

    const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!pair) throw new Error(`지원하지 않는 frontmatter 문법: ${line}`);

    const [, key, rawValue] = pair;
    if (rawValue.trim() === '') {
      pendingKey = key;
      fields[key] = [];
    } else if (/^[>|]/.test(rawValue.trim())) {
      throw new Error(`블록 스칼라는 지원하지 않습니다(파서를 확장하세요): ${line}`);
    } else {
      pendingKey = null;
      fields[key] = unquote(rawValue);
    }
  }

  return fields;
}

/**
 * 훅 스크립트를 실제 자식 프로세스로 띄워 PostToolUse 계약대로 stdin JSON을 먹인다.
 * 함수를 import해서 부르지 않고 프로세스로 실행하는 이유: 훅의 계약 표면은
 * stdin/stdout/exit code이며, 그 경계가 곧 회귀가 나는 지점이기 때문이다.
 * (`execFileSync`는 비정상 종료에서 throw하므로 크래시는 테스트 실패로 드러난다.)
 *
 * `raw: true`면 payload를 문자열 그대로 보낸다 — 파싱 불가 stdin을 재현하려면
 * 필수다. `JSON.stringify('not-json')`은 `"not-json"`이라는 **유효한 JSON**이라
 * 그것만으로는 훅의 파싱 방어 코드를 한 번도 밟지 못한다.
 */
export function runHook(scriptName, payload, { raw = false } = {}) {
  const result = execFileSync('node', [repoPath('templates', 'hooks', scriptName)], {
    input: raw ? payload : JSON.stringify(payload),
    encoding: 'utf8',
  });
  return {
    stdout: result,
    json: result.trim() ? JSON.parse(result) : null,
    context: result.trim() ? JSON.parse(result).hookSpecificOutput?.additionalContext ?? '' : '',
  };
}

/**
 * 소비 프로젝트를 흉내 낸 임시 디렉터리를 만든다.
 * files: { '<상대경로>': '<내용>' } — `.omj/fe-context.md` 포함 여부로 게이트를 검증한다.
 */
export function makeProject(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'omj-test-'));
  for (const [relative, contents] of Object.entries(files)) {
    const absolute = path.join(root, relative);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, contents);
  }
  return {
    root,
    file: (relative) => path.join(root, relative),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

/** PostToolUse 훅이 실제로 받는 stdin 페이로드 형태. */
export const postToolUsePayload = ({ cwd, filePath, toolName = 'Edit' }) => ({
  session_id: 'test-session',
  transcript_path: '/dev/null',
  cwd,
  hook_event_name: 'PostToolUse',
  tool_name: toolName,
  tool_input: { file_path: filePath },
  tool_response: { success: true },
});

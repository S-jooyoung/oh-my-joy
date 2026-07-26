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

/**
 * 마크다운 frontmatter를 파싱한다. YAML 파서를 들이지 않고 이 레포가 실제로
 * 쓰는 부분집합(`key: value` 한 줄 + `- item` 리스트)만 다룬다 — 지원 범위를
 * 넘는 문법이 들어오면 조용히 무시하지 않고 테스트가 깨지도록 값 그대로 둔다.
 */
export function parseFrontmatter(source) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (!match) return null;

  const fields = {};
  let currentListKey = null;

  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;

    const listItem = /^\s+-\s+(.*)$/.exec(line);
    if (listItem && currentListKey) {
      fields[currentListKey].push(listItem[1].trim());
      continue;
    }

    const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!pair) continue;

    const [, key, rawValue] = pair;
    if (rawValue === '') {
      currentListKey = key;
      fields[key] = [];
    } else {
      currentListKey = null;
      fields[key] = rawValue.trim().replace(/^["'](.*)["']$/, '$1');
    }
  }

  return fields;
}

/**
 * 훅 스크립트를 실제 자식 프로세스로 띄워 PostToolUse 계약대로 stdin JSON을 먹인다.
 * 함수를 import해서 부르지 않고 프로세스로 실행하는 이유: 훅의 계약 표면은
 * stdin/stdout/exit code이며, 그 경계가 곧 회귀가 나는 지점이기 때문이다.
 */
export function runHook(scriptName, payload) {
  const result = execFileSync('node', [repoPath('templates', 'hooks', scriptName)], {
    input: JSON.stringify(payload),
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

#!/usr/bin/env node
/**
 * check-story-exists.mjs — PostToolUse(Edit|Write) 훅: 컴포넌트 저장 시 Story 누락 경고.
 *
 * 배포: oh-my-joy 플러그인 templates/hooks/ 정본 → /omj-setup이 소비 프로젝트
 * .claude/hooks/ 로 복사하고 .claude/settings.json 에 등록한다(opt-in).
 * 게이트: 프로젝트 루트 .omj/fe-context.md 에 `storybook: true` 선언이 없으면 무조건 no-op.
 * 검사만 하고 수정·차단하지 않는다(경고 컨텍스트 주입, exit 0).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const COMPONENT_EXT = /\.(tsx|jsx)$/;
const EXCLUDE = /(\.stories\.|\.test\.|\.spec\.|\.d\.ts$)/;

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

function findFeContext(startDir) {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const p = path.join(dir, '.omj', 'fe-context.md');
    if (existsSync(p)) return p;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const input = readStdin();
if (!input) process.exit(0);

const filePath = input.tool_input?.file_path ?? '';
if (!COMPONENT_EXT.test(filePath) || EXCLUDE.test(filePath)) process.exit(0);

const cwd = input.cwd || process.cwd();
const fcPath = findFeContext(cwd);
if (!fcPath) process.exit(0);
if (!/^storybook:\s*true/m.test(readFileSync(fcPath, 'utf8'))) process.exit(0);

const resolved = path.resolve(filePath);
const dir = path.dirname(resolved);
const base = path.basename(resolved).replace(COMPONENT_EXT, '');

let hasStory = false;
try {
  hasStory = readdirSync(dir).some((f) => f.startsWith(`${base}.stories.`));
} catch {
  process.exit(0);
}
if (hasStory) process.exit(0);

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    additionalContext: `[omj:check-story-exists] ${path.basename(resolved)}에 대응하는 ${base}.stories.* 가 없습니다 — 이 프로젝트는 storybook: true 선언 상태입니다(Story 추가 권장).`,
  },
}));
process.exit(0);

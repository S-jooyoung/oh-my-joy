#!/usr/bin/env node
/**
 * check-design-tokens.mjs — PostToolUse(Edit|Write) 훅: 하드코딩 색상 감지 경고.
 *
 * 배포: oh-my-joy 플러그인 templates/hooks/ 정본 → /omj-setup이 소비 프로젝트
 * .claude/hooks/ 로 복사하고 .claude/settings.json 에 등록한다(opt-in).
 * 게이트: 프로젝트 루트 .omj/fe-context.md 에 tokensPath 선언이 없으면 무조건 no-op.
 * 검사만 하고 수정·차단하지 않는다(경고 컨텍스트 주입, exit 0).
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const TARGET_EXT = /\.(tsx|jsx|css)$/;
const HARDCODE = /(#[0-9a-fA-F]{3,8}\b|rgba?\()/g;

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
if (!TARGET_EXT.test(filePath)) process.exit(0);

const cwd = input.cwd || process.cwd();
const fcPath = findFeContext(cwd);
if (!fcPath) process.exit(0); // fe-context 미선언 프로젝트 → no-op (범용성)

const fc = readFileSync(fcPath, 'utf8');
const tokensPathMatch = fc.match(/^tokensPath:\s*(\S+)/m);
if (!tokensPathMatch) process.exit(0); // 토큰 시스템 미선언 → no-op

// 토큰 정의 파일 자체는 raw 값이 정상이므로 제외
const tokensPath = tokensPathMatch[1];
const tokensDir = path.dirname(path.resolve(path.dirname(path.dirname(fcPath)), tokensPath));
const resolved = path.resolve(filePath);
if (resolved === path.resolve(path.dirname(path.dirname(fcPath)), tokensPath) || resolved.startsWith(tokensDir + path.sep)) {
  process.exit(0);
}

let source = '';
try {
  source = readFileSync(resolved, 'utf8');
} catch {
  process.exit(0);
}

const hits = [];
source.split('\n').forEach((line, i) => {
  if (/^\s*(\/\/|\/\*|\*)/.test(line)) return; // 주석 라인 제외
  const m = line.match(HARDCODE);
  if (m) hits.push(`L${i + 1}: ${line.trim().slice(0, 80)}`);
});

if (hits.length === 0) process.exit(0);

const context = [
  `[omj:check-design-tokens] ${path.basename(resolved)}에 하드코딩 색상 ${hits.length}건 감지 — 프로젝트 토큰(${tokensPath})의 시맨틱 값 사용을 권장:`,
  ...hits.slice(0, 5),
  hits.length > 5 ? `… 외 ${hits.length - 5}건` : '',
].filter(Boolean).join('\n');

console.log(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: context },
}));
process.exit(0);

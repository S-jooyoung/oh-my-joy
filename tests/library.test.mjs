/**
 * On-demand library: principles, playbooks, and the reporting rules.
 *
 * These documents are read during execution only when needed, so their shape is
 * the contract: an index that names every principle once, detail files with a
 * fixed skeleton, playbooks with steps, review, and report, and one reporting
 * document. Line caps keep each read cheap.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';

import { readRepoFile, repoPath } from './helpers/repo.mjs';

const GROUPS = [
  ['Build less', [
    'smallest-complete-change',
    'subtract-before-you-add',
    'shape-before-logic',
    'redesign-over-patching',
    'question-the-premise',
    'reader-first',
    'user-outcome-first',
    'try-it-instead-of-asking',
    'build-the-tool',
  ]],
  ['Structure', [
    'one-owner-per-rule',
    'check-at-the-boundary',
    'make-wrong-states-impossible',
    'safe-to-retry',
    'migrate-then-delete',
    'separate-before-sharing',
  ]],
  ['Proof', [
    'prove-it-works',
    'fix-the-origin',
    'small-verifiable-steps',
    'test-behavior',
    'see-it-fail-first',
    'explain-the-number',
    'say-how-sure',
  ]],
  ['Working together', [
    'guard-the-context',
    'proceed-then-report',
    'fresh-eyes-review',
    'lessons-into-checks',
  ]],
];
const PRINCIPLES = GROUPS.flatMap(([, names]) => names);
const PLAYBOOKS = ['bug-fix', 'feature', 'refactor', 'investigation'];
const DETAIL_SECTIONS = ['When it applies', 'The rule', 'What it changes', 'Not this'];
const PLAYBOOK_SECTIONS = ['When it applies', 'Steps', 'Principles to read', 'Review', 'Report'];
const REPORT_PARTS = ['Conclusion', 'Your move', 'What changed', 'Decisions made for you', 'How it was checked'];
const CHECK_STRENGTH = ['Ran in the real app', 'Ran the tests', 'Type check or build only', 'Read the code only'];
const LIMITS = { index: 60, detail: 25, playbook: 45, reporting: 90 };

const titleOf = (kebab) => {
  const words = kebab.replace(/-/g, ' ');
  return words[0].toUpperCase() + words.slice(1);
};
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const lineCount = (source) => source.replace(/\n$/, '').split('\n').length;
const headings = (source, level) =>
  [...source.matchAll(new RegExp(`^${'#'.repeat(level)} (.+)$`, 'gm'))].map((m) => m[1].trim());
const section = (source, heading) => {
  const start = source.search(new RegExp(`^## ${escape(heading)}$`, 'm'));
  if (start === -1) return '';
  const rest = source.slice(start).replace(/^.*\n/, '');
  const next = rest.search(/^## /m);
  return next === -1 ? rest : rest.slice(0, next);
};

const indexPath = ['docs', 'principles', 'INDEX.md'];
const detailPath = (kebab) => ['docs', 'principles', `${kebab}.md`];
const playbookPath = (name) => ['docs', 'playbooks', `${name}.md`];
const reportingPath = ['docs', 'REPORTING.md'];

const readExisting = (segments) => {
  assert.ok(existsSync(repoPath(...segments)), `${segments.join('/')} does not exist`);
  return readRepoFile(...segments);
};

describe('principles index', () => {
  it('the canonical list holds 26 distinct principles in four groups', () => {
    assert.equal(PRINCIPLES.length, 26);
    assert.equal(new Set(PRINCIPLES).size, 26);
    assert.equal(GROUPS.length, 4);
  });

  it(`INDEX.md stays within ${LIMITS.index} lines`, () => {
    const source = readExisting(indexPath);
    assert.ok(lineCount(source) <= LIMITS.index, `INDEX.md has ${lineCount(source)} lines`);
  });

  it('INDEX.md lists the four groups in order and each principle once, under its group', () => {
    const source = readExisting(indexPath);
    assert.deepEqual(headings(source, 2), GROUPS.map(([group]) => group));
    for (const [group, names] of GROUPS) {
      const body = section(source, group);
      const listed = [...body.matchAll(/^- \*\*[^*]+\*\* \(`([a-z-]+)`\)/gm)].map((m) => m[1]);
      assert.deepEqual(listed, names, `${group} lists ${listed.join(', ')}`);
    }
  });

  for (const kebab of PRINCIPLES) {
    it(`INDEX.md writes ${kebab} in the canonical line form`, () => {
      const source = readExisting(indexPath);
      const line = new RegExp(`^- \\*\\*${escape(titleOf(kebab))}\\*\\* \\(\`${kebab}\`\\) — .+\\. .+\\.$`, 'm');
      assert.match(source, line);
    });
  }

  it('index entries and detail files match one to one', () => {
    const dir = repoPath('docs', 'principles');
    assert.ok(existsSync(dir), 'docs/principles does not exist');
    const details = readdirSync(dir)
      .filter((f) => f.endsWith('.md') && f !== 'INDEX.md')
      .map((f) => f.replace(/\.md$/, ''))
      .sort();
    assert.deepEqual(details, [...PRINCIPLES].sort());
    const indexed = [...readExisting(indexPath).matchAll(/^- \*\*[^*]+\*\* \(`([a-z-]+)`\)/gm)].map((m) => m[1]).sort();
    assert.deepEqual(indexed, [...PRINCIPLES].sort());
  });
});

describe('principle detail files', () => {
  for (const kebab of PRINCIPLES) {
    it(`${kebab}.md has its title, the four sections in order, and at most ${LIMITS.detail} lines`, () => {
      const source = readExisting(detailPath(kebab));
      assert.equal(source.split('\n')[0], `# ${titleOf(kebab)}`);
      assert.deepEqual(headings(source, 2), DETAIL_SECTIONS);
      for (const heading of DETAIL_SECTIONS) assert.ok(section(source, heading).trim(), `${heading} is empty`);
      const examples = section(source, 'What it changes').split('\n').filter((l) => l.includes('→'));
      assert.ok(examples.length >= 1 && examples.length <= 2, `What it changes holds ${examples.length} before → after examples`);
      assert.ok(lineCount(source) <= LIMITS.detail, `${kebab}.md has ${lineCount(source)} lines`);
    });
  }
});

describe('playbooks', () => {
  it('exactly the four playbooks exist', () => {
    const dir = repoPath('docs', 'playbooks');
    assert.ok(existsSync(dir), 'docs/playbooks does not exist');
    const found = readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')).sort();
    assert.deepEqual(found, [...PLAYBOOKS].sort());
  });

  for (const name of PLAYBOOKS) {
    it(`${name}.md has the five sections in order, numbered steps, and at most ${LIMITS.playbook} lines`, () => {
      const source = readExisting(playbookPath(name));
      assert.deepEqual(headings(source, 2), PLAYBOOK_SECTIONS);
      for (const heading of PLAYBOOK_SECTIONS) assert.ok(section(source, heading).trim(), `${heading} is empty`);
      assert.match(section(source, 'Steps'), /^1\. /m);
      const named = [...section(source, 'Principles to read').matchAll(/\]\(\.\.\/principles\/([a-z-]+)\.md\)/g)].map((m) => m[1]);
      assert.ok(named.length > 0, 'Principles to read links no principle');
      for (const kebab of named) assert.ok(PRINCIPLES.includes(kebab), `${kebab} is not a canonical principle`);
      assert.ok(lineCount(source) <= LIMITS.playbook, `${name}.md has ${lineCount(source)} lines`);
    });
  }
});

describe('reporting rules', () => {
  it(`REPORTING.md stays within ${LIMITS.reporting} lines`, () => {
    const source = readExisting(reportingPath);
    assert.ok(lineCount(source) <= LIMITS.reporting, `REPORTING.md has ${lineCount(source)} lines`);
  });

  it('REPORTING.md names the five parts in order', () => {
    const parts = [...section(readExisting(reportingPath), 'The five parts').matchAll(/^(\d+)\. \*\*([^*]+)\*\*/gm)];
    assert.deepEqual(parts.map((m) => m[2]), REPORT_PARTS);
    assert.deepEqual(parts.map((m) => Number(m[1])), REPORT_PARTS.map((_, i) => i + 1));
  });

  it('REPORTING.md ranks the four check strengths in order and names `not confirmed`', () => {
    const source = readExisting(reportingPath);
    const levels = [...section(source, 'Claims and check strength').matchAll(/^(\d+)\. (.+)$/gm)];
    assert.deepEqual(levels.map((m) => m[2].trim()), CHECK_STRENGTH);
    assert.deepEqual(levels.map((m) => Number(m[1])), CHECK_STRENGTH.map((_, i) => i + 1));
    assert.ok(source.includes('`not confirmed`'), 'REPORTING.md lacks `not confirmed`');
  });

  it('REPORTING.md defines the progress line and the wait line before a long wait', () => {
    const lines = section(readExisting(reportingPath), 'Progress lines');
    assert.match(lines, /<done>\/<total> done/, 'the per-goal progress line is missing');
    assert.match(lines, /wait line/, 'the wait line is missing');
  });
});

describe('library files are documents, not skills or commands', () => {
  it('no library file carries frontmatter', () => {
    const files = [
      indexPath,
      ...PRINCIPLES.map(detailPath),
      ...PLAYBOOKS.map(playbookPath),
      reportingPath,
    ];
    const offenders = files.filter((segments) => readExisting(segments).startsWith('---'));
    assert.deepEqual(offenders.map((s) => s.join('/')), []);
  });
});

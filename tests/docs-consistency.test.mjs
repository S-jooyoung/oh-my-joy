/**
 * Cross-document fact consistency checks.
 *
 * In this repo markdown IS the behavior definition, so documentation drift is a
 * functional defect. The "documentation discipline" of CLAUDE.md (README EN/KO,
 * CHANGELOG, and PRINCIPLES updated together) is enforced by machines here
 * instead of relying on human diligence.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';

import {
  readRepoFile,
  repoPath,
  listMarkdownFiles,
  listTrackedFiles,
  listCommandFiles,
  parseFrontmatter,
  stripCode,
  REPO_ROOT,
} from './helpers/repo.mjs';

const readmeEn = readRepoFile('README.md');
const readmeKo = readRepoFile('README.ko.md');
const changelog = readRepoFile('CHANGELOG.md');

const headings = (source) => source.split('\n').filter((line) => line.startsWith('## '));

describe('README EN/KO parity', () => {
  // Heading text is translated, so it cannot be compared as strings. Matching the
  // count catches the most common drift — a section added to only one side. The
  // substantive parity is covered by 'Command list consistency' below.
  it('both README languages have the same number of sections', () => {
    assert.equal(headings(readmeEn).length, headings(readmeKo).length);
  });

  it('the install string is identical in both READMEs', () => {
    const installLine = (source) => source.match(/^\/plugin marketplace add .*$/m)?.[0];
    assert.ok(installLine(readmeEn), 'EN README has no marketplace add line');
    assert.equal(installLine(readmeEn), installLine(readmeKo));
  });

  it('the install string points at a public remote — a local path is installable by no one', () => {
    const line = readmeEn.match(/^\/plugin marketplace add (.*)$/m)?.[1];
    assert.ok(line, 'marketplace add line not found');
    assert.doesNotMatch(line, /^[~./]/, `points at a local path: ${line}`);
    assert.match(line, /^[\w.-]+\/[\w.-]+$/, `must be owner/repo form: ${line}`);
  });

  it('the canonical install command appears in both READMEs', () => {
    // Assembled from the manifest rather than hardcoded — if the plugin or
    // marketplace name changes, this check immediately exposes a README still
    // advertising the old string.
    const marketplace = JSON.parse(readRepoFile('.claude-plugin', 'marketplace.json'));
    const installLine = `/plugin install ${marketplace.plugins[0].name}@${marketplace.name}`;
    for (const [label, source] of [['EN', readmeEn], ['KO', readmeKo]]) {
      assert.ok(source.includes(installLine), `${label} README lacks the canonical install string (${installLine})`);
    }
  });
});

describe('Language purity of English artifacts', () => {
  // Denylist, not allowlist: every tracked markdown file must be English unless
  // explicitly exempted, so NEW documents default to English purity. The two
  // exemptions are the Korean README mirror and the CHANGELOG (pre-0.6.0 release
  // history is preserved in Korean; [Unreleased] entries may also quote legacy
  // Korean literals when documenting their replacement).
  const KOREAN_EXEMPT = new Set(['README.ko.md', 'CHANGELOG.md']);
  // The language-switcher literal in README.md.
  const ALLOWED = ['한국어'];
  // Matching only precomposed Hangul would let jamo (ㅋㅋ) and CJK ideographs slip through.
  const CJK = /[가-힣ㄱ-ㅎㅏ-ㅣ㐀-鿿]/;
  // Frontmatter descriptions may keep Korean trigger examples for auto-delegation
  // matching (CLAUDE.md command rules) — on these surfaces only the body is checked.
  const FRONTMATTER_EXEMPT_PREFIXES = ['commands/', 'agents/', 'skills/'];
  // Body-level exception, kept minimal and literal: omj-start's backward-compat
  // contract quotes the legacy Korean selector labels it must keep recognizing
  // (the selector output contract switched to English literals in 0.6.0).
  const FILE_ALLOWED = {
    'commands/omj-start.md': ['선택된 레인', '실행 레인 선택', '(추천)'],
  };

  const targets = listMarkdownFiles().filter((file) => !KOREAN_EXEMPT.has(file));

  it('enumeration covers a meaningful number of files — never silently empty', () => {
    // Guards the denylist itself: if file enumeration regressed to an empty or
    // near-empty list, every purity check below would pass vacuously.
    assert.ok(targets.length > 20, `only ${targets.length} markdown files enumerated`);
  });

  for (const file of targets) {
    it(`${file} contains no Korean or CJK beyond the allowed literals`, () => {
      let source = readRepoFile(file);
      if (FRONTMATTER_EXEMPT_PREFIXES.some((prefix) => file.startsWith(prefix))) {
        source = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
      }
      const allowed = [...ALLOWED, ...(FILE_ALLOWED[file] ?? [])];
      const offenders = source
        .split('\n')
        .map((line, index) => {
          const stripped = allowed.reduce((acc, literal) => acc.split(literal).join(''), line);
          return CJK.test(stripped) ? `L${index + 1}: ${line.trim()}` : null;
        })
        .filter(Boolean);

      assert.deepEqual(offenders, [], `${file} has untranslated text:\n${offenders.join('\n')}`);
    });
  }

  // Runtime output regression guard: scripts and hook templates are user-facing
  // surfaces (stderr messages, PR bodies, hook warnings) that were translated in
  // the English-first transition — Korean must not creep back into their source.
  it('runtime scripts and hook templates contain no CJK', () => {
    const files = listTrackedFiles('scripts/*.mjs', 'templates/hooks/*.mjs');
    assert.ok(files.length >= 4, `only ${files.length} script files enumerated`);
    const offenders = files.filter((file) => CJK.test(readRepoFile(file)));
    assert.deepEqual(offenders, [], `Korean found in runtime sources: ${offenders.join(', ')}`);
  });
});

describe('CHANGELOG link integrity', () => {
  const versionHeadings = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)].map((m) => m[1]);
  const linkDefinitions = new Set(
    [...changelog.matchAll(/^\[([^\]]+)\]:\s*\S+$/gm)].map((m) => m[1]),
  );

  it('release entries exist', () => {
    assert.ok(versionHeadings.length > 0);
  });

  const escape = (v) => v.replace(/\./g, '\\.');

  versionHeadings.forEach((version, index) => {
    it(`the [${version}] link points at the correct range`, () => {
      assert.ok(linkDefinitions.has(version), `[${version}]: no link definition — renders as a literal on GitHub`);

      const url = changelog.match(new RegExp(`^\\[${escape(version)}\\]:\\s*(\\S+)$`, 'm'))?.[1];
      assert.ok(url, `could not read the [${version}] link URL`);

      // A label whose URL points at the wrong range is the most common release
      // drift (copy-pasting the previous version's line and editing only one side).
      const previous = versionHeadings[index + 1];
      const expected = previous
        ? new RegExp(`compare/v${escape(previous)}\\.\\.\\.v${escape(version)}$`)
        : new RegExp(`releases/tag/v${escape(version)}$`);
      assert.match(url, expected);
    });
  });

  it('[Unreleased] compares against the latest release', () => {
    const unreleased = changelog.match(/^\[Unreleased\]:\s*(\S+)$/m)?.[1];
    assert.ok(unreleased, 'no [Unreleased] link definition');
    assert.match(
      unreleased,
      new RegExp(`compare/v${versionHeadings[0].replace(/\./g, '\\.')}\\.\\.\\.HEAD$`),
      `[Unreleased] points at an old version instead of the latest release v${versionHeadings[0]}: ${unreleased}`,
    );
  });

  it('the latest release version matches plugin.json', () => {
    const plugin = JSON.parse(readRepoFile('.claude-plugin', 'plugin.json'));
    assert.equal(versionHeadings[0], plugin.version);
  });
});

describe('CHANGELOG keep-a-changelog skeleton', () => {
  // Seals the skeleton-regeneration contract of scripts/release.mjs cut in CI —
  // without this check, automation or editing could delete empty sections or
  // change the section vocabulary and no test would fail.
  const SECTIONS = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];

  // stripCode: release-note prose may quote `## [`·`### ` examples inside code
  // fences without producing false positives.
  const strippedChangelog = stripCode(changelog);

  it('[Unreleased] carries all 6 sections in canonical order', () => {
    const start = strippedChangelog.indexOf('## [Unreleased]');
    assert.ok(start !== -1, 'no ## [Unreleased] section');
    const rest = strippedChangelog.slice(start);
    const next = rest.search(/\n## \[/);
    const section = next === -1 ? rest : rest.slice(0, next);
    const headings = [...section.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
    assert.deepEqual(headings, SECTIONS);
  });

  it('every section\'s ### headings honor keep-a-changelog vocabulary and canonical order (release sections may be subsets)', () => {
    const offenders = [];
    for (const chunk of strippedChangelog.split(/^## /m).slice(1)) {
      const label = chunk.slice(0, chunk.indexOf('\n'));
      let last = -1;
      for (const [, heading] of chunk.matchAll(/^### (.+)$/gm)) {
        const index = SECTIONS.indexOf(heading);
        if (index === -1) offenders.push(`${label}: non-standard section "${heading}"`);
        else if (index < last) offenders.push(`${label}: "${heading}" out of order`);
        else last = index;
      }
    }
    assert.deepEqual(offenders, [], offenders.join('\n'));
  });
});

describe('Internal link integrity', () => {
  it('every relative markdown link points at an existing file', () => {
    const broken = [];

    for (const file of listMarkdownFiles()) {
      const source = stripCode(readRepoFile(file));
      for (const match of source.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
        const target = match[1];
        // External URLs, in-document anchors, and runtime substitution variables
        // cannot be verified statically.
        if (/^(https?:|mailto:|#)/.test(target) || target.includes('${')) continue;

        const resolved = path.resolve(path.dirname(repoPath(file)), target.split('#')[0]);
        if (!existsSync(resolved)) broken.push(`${file} → ${target}`);
      }
    }

    assert.deepEqual(broken, [], `broken relative links:\n${broken.join('\n')}`);
  });

  it('markdown links carry no runtime substitution variables — they 404 on GitHub', () => {
    const offenders = [];

    for (const file of listMarkdownFiles()) {
      for (const match of stripCode(readRepoFile(file)).matchAll(/\[[^\]]*\]\(([^)\s]*\$\{[^)\s]*)\)/g)) {
        offenders.push(`${file} → ${match[1]}`);
      }
    }

    assert.deepEqual(offenders, [], `links with substitution variables in the URL:\n${offenders.join('\n')}`);
  });
});

describe('Command list consistency', () => {
  // Two naming axes (CLAUDE.md): FE-loop commands use the `/omj-*` prefix,
  // general-purpose workflow commands use an unprefixed basename and are always
  // written as the canonical `/oh-my-joy:<name>` invocation in docs.
  const commandFiles = listCommandFiles();
  const feCommands = commandFiles
    .filter((f) => /^omj(-[a-z-]+)?\.md$/.test(f))
    .map((f) => `/${f.replace(/\.md$/, '')}`);
  const workflowCommands = commandFiles
    .filter((f) => !/^omj(-[a-z-]+)?\.md$/.test(f))
    .map((f) => f.replace(/\.md$/, ''));

  // Checking README alone misses dead command references in docs/ and commands/.
  // CHANGELOG is excluded as preserved history; announced v1.1 commands
  // (CLAUDE.md) and pre-rename historical names are allowed via explicit lists.
  const PLANNED_COMMANDS = new Set(['/omj-push', '/omj-spec']);
  const HISTORICAL_COMMANDS = new Set(['/omj-review']);

  // Prevents the drift where a table row carries the command token but drops its
  // arguments (proven in the audit by the undocumented --threshold) —
  // argument-hint flags are surface users must know to invoke. --help is excluded
  // as conventional. Matching uses a boundary regex so --slug is not satisfied by
  // --slugify.
  it('every command\'s argument-hint flags are documented in both READMEs (EN/KO)', () => {
    const offenders = [];
    for (const file of commandFiles) {
      const fm = parseFrontmatter(readRepoFile('commands', file));
      const flags = [...(fm['argument-hint'] ?? '').matchAll(/--[A-Za-z][\w-]*/g)]
        .map((m) => m[0])
        .filter((flag) => flag !== '--help');
      for (const flag of flags) {
        const bounded = new RegExp(`${flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`);
        for (const [label, source] of [['EN', readmeEn], ['KO', readmeKo]]) {
          if (!bounded.test(source)) offenders.push(`${label}: ${flag} of ${file}`);
        }
      }
    }
    assert.deepEqual(offenders, [], `flags missing from docs:\n${offenders.join('\n')}`);
  });

  it('every tracked markdown documents only commands that exist', () => {
    const offenders = [];
    for (const file of listMarkdownFiles().filter((f) => f !== 'CHANGELOG.md')) {
      const source = readRepoFile(file);
      for (const [, command] of source.matchAll(/`(\/omj(?:-[a-z-]+)?)`/g)) {
        if (feCommands.includes(command) || PLANNED_COMMANDS.has(command) || HISTORICAL_COMMANDS.has(command)) continue;
        offenders.push(`${file}: ${command}`);
      }
      for (const [, name] of source.matchAll(/`\/oh-my-joy:([a-z-]+)`/g)) {
        if (!workflowCommands.includes(name)) offenders.push(`${file}: /oh-my-joy:${name}`);
      }
    }
    assert.deepEqual(offenders, [], `documents commands that do not exist:\n${offenders.join('\n')}`);
  });

  it('every command is documented in both READMEs (EN/KO)', () => {
    for (const [label, source] of [['EN', readmeEn], ['KO', readmeKo]]) {
      for (const command of feCommands) {
        assert.ok(source.includes(`\`${command}\``), `${label} README lacks docs for ${command}`);
      }
      for (const name of workflowCommands) {
        assert.ok(
          source.includes(`\`/oh-my-joy:${name}\``),
          `${label} README lacks docs for /oh-my-joy:${name}`,
        );
      }
    }
  });

  it('workflow commands are never written as bare slashes — canonical invocation only', () => {
    // A bare `/deep-interview` is ambiguous with the same-named OMC skill and
    // Claude Code native commands — which implementation runs is unclear. Blocked
    // across every tracked markdown surface; CHANGELOG is the only exemption
    // (past release entries preserve pre-rename names as history).
    const sources = [
      ['README.md', readmeEn],
      ['README.ko.md', readmeKo],
      ...listMarkdownFiles()
        .filter((f) => f !== 'CHANGELOG.md' && !f.startsWith('README'))
        .map((f) => [f, readRepoFile(f)]),
    ];
    const offenders = [];
    for (const name of workflowCommands) {
      // Exact matching (`/name`) alone misses inline code with arguments
      // (`/name --flag`) and bare mentions inside fenced code blocks. The leading
      // boundary excludes `:` (canonical oh-my-joy:name), `/` and word characters
      // (path fragments like commands/name.md), `.` (relative links ./name.md),
      // `~`, and `}` (substitution variables ${…}/name); a trailing `.md` is
      // treated as a path and excluded.
      // Known residual false-negative class: `/name` immediately after a Korean
      // character (\w does not include Hangul).
      const bare = new RegExp(`(^|[^\\w:/.~}])/${name}(?![\\w-]|\\.md)`, 'm');
      for (const [label, source] of sources) {
        if (bare.test(source)) offenders.push(`${label}: /${name}`);
      }
    }
    assert.deepEqual(offenders, [], `bare mentions must become /oh-my-joy:<name>:\n${offenders.join('\n')}`);
  });
});

describe('CLAUDE.md maintenance discipline', () => {
  it('honors its self-declared cap (120 lines)', () => {
    const lines = readRepoFile('CLAUDE.md').split('\n').length;
    assert.ok(lines < 120, `CLAUDE.md is ${lines} lines — over its own declared cap`);
  });

  it('repo-root-relative paths it references exist', () => {
    const missing = [...readRepoFile('CLAUDE.md').matchAll(/`(docs\/[\w.-]+\.md)`/g)]
      .map((m) => m[1])
      .filter((target) => !existsSync(path.join(REPO_ROOT, target)));

    assert.deepEqual(missing, [], `CLAUDE.md points at missing docs: ${missing.join(', ')}`);
  });
});

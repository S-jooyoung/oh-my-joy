/**
 * 플러그인 매니페스트·커맨드·에이전트·스킬의 구조 검증.
 *
 * 이 레포는 "동작이 마크다운 frontmatter로 선언되는" 플러그인이라, 오타 하나가
 * 런타임에서야 권한 실패로 드러난다. 여기서 검증하는 것은 전부 정적으로 확인 가능한
 * 사실들 — 스키마 필드, 버전 일치, 파일명↔선언 일치, 그리고 이 레포의 최우선 불변식인
 * "플러그인은 hooks.json을 두지 않는다"이다.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

import {
  readJson,
  readRepoFile,
  repoPath,
  listCommandFiles,
  listAgentFiles,
  parseFrontmatter,
} from './helpers/repo.mjs';

const plugin = readJson('.claude-plugin', 'plugin.json');
const marketplace = readJson('.claude-plugin', 'marketplace.json');

describe('plugin.json', () => {
  it('필수 필드를 갖는다', () => {
    for (const field of ['name', 'version', 'description', 'author', 'license']) {
      assert.ok(plugin[field], `plugin.json에 ${field}가 없습니다`);
    }
  });

  it('버전이 semver다', () => {
    assert.match(plugin.version, /^\d+\.\d+\.\d+$/);
  });

  it('스키마를 선언해 에디터 검증이 걸린다', () => {
    assert.ok(plugin.$schema, 'plugin.json에 $schema가 없습니다');
  });

  it('선언한 라이선스가 LICENSE 파일과 일치한다', () => {
    assert.equal(plugin.license, 'MIT');
    assert.match(readRepoFile('LICENSE'), /MIT License/);
  });
});

describe('marketplace.json', () => {
  it('필수 필드를 갖는다', () => {
    assert.ok(marketplace.name);
    assert.ok(marketplace.owner?.name);
    assert.ok(Array.isArray(marketplace.plugins) && marketplace.plugins.length > 0);
  });

  it('등재된 플러그인이 실재하는 source를 가리킨다', () => {
    for (const entry of marketplace.plugins) {
      assert.ok(entry.name, 'plugins[].name 누락');
      assert.ok(entry.source, 'plugins[].source 누락');
      assert.ok(existsSync(repoPath(entry.source)), `source 경로가 없습니다: ${entry.source}`);
    }
  });

  it('버전이 plugin.json과 일치한다 — 드리프트가 조용히 남지 않게', () => {
    const entry = marketplace.plugins.find((p) => p.name === plugin.name);
    assert.ok(entry, `marketplace.json에 ${plugin.name} 항목이 없습니다`);
    assert.equal(entry.version, plugin.version);
  });
});

describe('플러그인 구조 불변식', () => {
  // CLAUDE.md의 최우선 규칙이자 PRINCIPLES ⑩의 명시적 기각 대안.
  // hooks.json이 존재하면 플러그인 enable만으로 모든 소비 레포에서 훅이 자동 발화한다.
  it('플러그인은 hooks.json을 두지 않는다 (zero-hook)', () => {
    for (const candidate of ['hooks/hooks.json', '.claude-plugin/hooks.json', 'hooks.json']) {
      assert.ok(!existsSync(repoPath(candidate)), `${candidate}가 존재하면 전 레포 자동 발화가 일어납니다`);
    }
  });

  it('훅 스크립트 정본은 templates/hooks/에만 있다', () => {
    for (const script of ['check-design-tokens.mjs', 'check-story-exists.mjs']) {
      assert.ok(existsSync(repoPath('templates', 'hooks', script)));
    }
  });
});

describe('commands/*.md frontmatter', () => {
  const commands = listCommandFiles();

  it('커맨드가 존재한다', () => {
    assert.ok(commands.length > 0);
  });

  for (const file of commands) {
    describe(file, () => {
      const fm = parseFrontmatter(readRepoFile('commands', file));

      it('frontmatter를 갖는다', () => {
        assert.ok(fm, `${file}에 frontmatter가 없습니다`);
      });

      it('description을 갖는다', () => {
        assert.ok(fm.description?.length > 0);
      });

      it('allowed-tools를 명시한다 — 최소권한은 선언으로 강제된다', () => {
        assert.ok(fm['allowed-tools']?.length > 0, `${file}에 allowed-tools 선언이 없습니다`);
      });

      it('네임스페이스 규칙을 지킨다 (/omj 또는 /omj-*)', () => {
        assert.match(file, /^omj(-[a-z-]+)?\.md$/);
      });
    });
  }
});

describe('agents/*.md frontmatter', () => {
  for (const file of listAgentFiles()) {
    describe(file, () => {
      const fm = parseFrontmatter(readRepoFile('agents', file));

      it('name이 파일명과 일치한다', () => {
        assert.ok(fm, `${file}에 frontmatter가 없습니다`);
        assert.equal(fm.name, file.replace(/\.md$/, ''));
      });

      it('description과 tools를 갖는다', () => {
        assert.ok(fm.description?.length > 0);
        assert.ok(fm.tools?.length > 0);
      });
    });
  }
});

describe('skills/frontend-fundamentals', () => {
  const fm = parseFrontmatter(readRepoFile('skills', 'frontend-fundamentals', 'SKILL.md'));

  it('name·description·license를 갖는다', () => {
    assert.equal(fm.name, 'frontend-fundamentals');
    assert.ok(fm.description?.length > 0);
    assert.equal(fm.license, 'MIT');
  });

  it('SKILL.md가 참조하는 references/ 파일이 모두 실재한다', () => {
    const source = readRepoFile('skills', 'frontend-fundamentals', 'SKILL.md');
    const referenced = [...source.matchAll(/\(references\/([\w-]+\.md)\)/g)].map((m) => m[1]);
    assert.ok(referenced.length > 0, 'references 링크를 찾지 못했습니다');

    for (const name of new Set(referenced)) {
      assert.ok(
        existsSync(repoPath('skills', 'frontend-fundamentals', 'references', name)),
        `references/${name}가 없습니다`,
      );
    }
  });
});

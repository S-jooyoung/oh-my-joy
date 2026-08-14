/**
 * Behavioral tests for scripts/validate-plugin.mjs.
 *
 * A validator that is never shown a broken manifest is indistinguishable from one
 * that always exits 0 — and this one guards the surface where mistakes are silent
 * (Claude Code ignores unrecognized manifest fields at load time). So each check
 * is exercised against a fixture that violates exactly it.
 *
 * Fixtures are built in temp directories and passed via `--root`; `--skip-cli`
 * isolates the built-in layer, since layer 1's verdicts belong to the CLI, not to
 * this repo. The real manifests still go through both layers in CI.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { repoPath } from './helpers/repo.mjs';

const SCRIPT = repoPath('scripts', 'validate-plugin.mjs');

function runValidator(root) {
  try {
    const stdout = execFileSync('node', [SCRIPT, '--root', root, '--skip-cli'], { encoding: 'utf8' });
    return { code: 0, output: stdout };
  } catch (error) {
    return { code: error.status ?? 1, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

const VALID_PLUGIN = {
  name: 'fixture-plugin',
  version: '1.0.0',
  description: 'A fixture',
  author: { name: 'Fixture Author' },
  license: 'MIT',
};

const VALID_MARKETPLACE = {
  name: 'fixture-market',
  owner: { name: 'Fixture Author' },
  plugins: [{ name: 'fixture-plugin', source: './', description: 'A fixture', version: '1.0.0' }],
};

/**
 * Builds a minimal valid plugin tree, then applies `mutate` to break exactly one
 * thing. Returns the root path; the caller cleans up.
 */
function makeFixture(mutate = () => {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'omj-validate-'));
  const tree = {
    plugin: structuredClone(VALID_PLUGIN),
    marketplace: structuredClone(VALID_MARKETPLACE),
    commands: { 'demo.md': '---\ndescription: A demo command\nargument-hint: "<x>"\nallowed-tools: Read\n---\n\nBody.\n' },
    agents: { 'demo-agent.md': '---\nname: demo-agent\ndescription: A demo agent\ntools: Read, Grep\n---\n\nBody.\n' },
    skills: { demo: '---\nname: demo\ndescription: A demo skill\n---\n\nBody.\n' },
    extraFiles: {},
  };

  mutate(tree);

  mkdirSync(path.join(root, '.claude-plugin'), { recursive: true });
  writeFileSync(path.join(root, '.claude-plugin/plugin.json'), JSON.stringify(tree.plugin, null, 2));
  writeFileSync(path.join(root, '.claude-plugin/marketplace.json'), JSON.stringify(tree.marketplace, null, 2));

  for (const [dir, files] of [['commands', tree.commands], ['agents', tree.agents]]) {
    mkdirSync(path.join(root, dir), { recursive: true });
    for (const [file, body] of Object.entries(files)) writeFileSync(path.join(root, dir, file), body);
  }
  for (const [name, body] of Object.entries(tree.skills)) {
    mkdirSync(path.join(root, 'skills', name), { recursive: true });
    if (body !== null) writeFileSync(path.join(root, 'skills', name, 'SKILL.md'), body);
  }
  for (const [relative, body] of Object.entries(tree.extraFiles)) {
    mkdirSync(path.join(root, path.dirname(relative)), { recursive: true });
    writeFileSync(path.join(root, relative), body);
  }
  return root;
}

/** Asserts the validator rejects `mutate`'s damage, naming it in the output. */
function assertRejects(mutate, expected) {
  const root = makeFixture(mutate);
  try {
    const { code, output } = runValidator(root);
    assert.equal(code, 1, `expected a non-zero exit\n${output}`);
    assert.match(output, expected, `rejection did not name the cause\n${output}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('validate-plugin: accepts a conforming plugin', () => {
  it('a minimal valid tree exits 0', () => {
    const root = makeFixture();
    try {
      const { code, output } = runValidator(root);
      assert.equal(code, 0, output);
      assert.match(output, /validate-plugin: OK/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('the real repo passes its own built-in checks', () => {
    const { code, output } = runValidator(repoPath());
    assert.equal(code, 0, output);
  });
});

describe('validate-plugin: manifest violations', () => {
  it('rejects an unknown plugin.json field', () => {
    assertRejects((t) => { t.plugin.keywordz = ['typo']; }, /unknown field "keywordz"/);
  });

  it('rejects an unknown marketplace.json field', () => {
    assertRejects((t) => { t.marketplace.plugin = []; }, /unknown field "plugin"/);
  });

  it('rejects an unknown marketplace plugin-entry field', () => {
    assertRejects((t) => { t.marketplace.plugins[0].catagory = 'x'; }, /unknown field "catagory"/);
  });

  it('rejects a non-kebab-case plugin name', () => {
    assertRejects((t) => { t.plugin.name = 'Fixture_Plugin'; }, /must be kebab-case/);
  });

  it('rejects a missing owner.name', () => {
    assertRejects((t) => { delete t.marketplace.owner; }, /owner\.name is required/);
  });

  it('rejects a version disagreement between the two manifests', () => {
    assertRejects((t) => { t.marketplace.plugins[0].version = '9.9.9'; }, /version mismatch/);
  });

  it('rejects a marketplace entry that does not name the plugin', () => {
    assertRejects(
      (t) => { t.marketplace.plugins[0].name = 'someone-else'; },
      /no entry named "fixture-plugin"/,
    );
  });

  it('rejects a source path that does not exist', () => {
    assertRejects((t) => { t.marketplace.plugins[0].source = './nowhere'; }, /does not exist/);
  });
});

describe('validate-plugin: component violations', () => {
  it('rejects a mistyped command frontmatter key', () => {
    assertRejects(
      (t) => { t.commands['demo.md'] = '---\ndescription: x\nargumenthint: "<x>"\n---\n\nBody.\n'; },
      /unknown frontmatter field "argumenthint"/,
    );
  });

  it('rejects a command with no frontmatter at all', () => {
    assertRejects((t) => { t.commands['demo.md'] = '# Just a heading\n'; }, /missing YAML frontmatter/);
  });

  it('rejects a command missing description', () => {
    assertRejects(
      (t) => { t.commands['demo.md'] = '---\nallowed-tools: Read\n---\n\nBody.\n'; },
      /"description" is required/,
    );
  });

  it('rejects permissionMode on a plugin-shipped agent', () => {
    assertRejects(
      (t) => {
        t.agents['demo-agent.md'] =
          '---\nname: demo-agent\ndescription: x\npermissionMode: bypassPermissions\ntools: Read\n---\n\nBody.\n';
      },
      /"permissionMode" is not allowed on a plugin-shipped agent/,
    );
  });

  it('rejects hooks/mcpServers on a plugin-shipped agent', () => {
    assertRejects(
      (t) => {
        t.agents['demo-agent.md'] = '---\nname: demo-agent\ndescription: x\nmcpServers: ./x.json\n---\n\nBody.\n';
      },
      /"mcpServers" is not allowed on a plugin-shipped agent/,
    );
  });

  it('rejects a skill directory with no SKILL.md', () => {
    assertRejects((t) => { t.skills.demo = null; }, /SKILL\.md is missing/);
  });

  it('rejects an unknown SKILL.md frontmatter field', () => {
    assertRejects(
      (t) => { t.skills.demo = '---\nname: demo\ndescription: x\nversion: 1.0.0\n---\n\nBody.\n'; },
      /unknown frontmatter field "version"/,
    );
  });
});

describe('validate-plugin: repo invariants', () => {
  it('rejects a shipped hooks/hooks.json', () => {
    assertRejects(
      (t) => { t.extraFiles['hooks/hooks.json'] = '{}'; },
      /must never ship auto-firing hooks/,
    );
  });
});

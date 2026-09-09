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

const VALID_CODEX_PLUGIN = {
  name: 'fixture-plugin',
  version: '1.0.0',
  description: 'A fixture',
  author: { name: 'Fixture Author' },
  license: 'MIT',
  skills: './skills/',
};

const WORKFLOW_SKILLS = ['deep-interview', 'spec', 'ralplan', 'ultragoal', 'review', 'verify', 'fix', 'sync', 'setup', 'ship'];
const ROLE_SKILLS = ['critic', 'implementer', 'design-qa'];

function validSkill(name) {
  let body = 'Follow the provider-neutral workflow contract.\n';
  if (['deep-interview', 'spec', 'ralplan'].includes(name)) {
    body += 'This workflow is read-only and must not modify repository source files.\n';
  }
  if (['review', 'verify'].includes(name)) {
    body += 'This workflow is report-only and must not modify repository source files.\n';
  }
  if (name === 'ship') {
    body += 'Run only when explicitly requested by the user. Complete verification before push. Never push directly from a shared branch.\n';
  }
  const invocation = name === 'frontend-fundamentals' ? ''
    : 'user-invocable: false\ndisable-model-invocation: true\n';
  return `---\nname: ${name}\ndescription: ${name} fixture\n${invocation}---\n\n${body}`;
}

/**
 * Builds a minimal valid plugin tree, then applies `mutate` to break exactly one
 * thing. Returns the root path; the caller cleans up.
 */
function makeFixture(mutate = () => {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'omj-validate-'));
  const tree = {
    plugin: structuredClone(VALID_PLUGIN),
    codexPlugin: structuredClone(VALID_CODEX_PLUGIN),
    marketplace: structuredClone(VALID_MARKETPLACE),
    commands: { 'demo.md': '---\ndescription: A demo command\nargument-hint: "<x>"\nallowed-tools: Read\n---\n\nBody.\n' },
    agents: { 'demo-agent.md': '---\nname: demo-agent\ndescription: A demo agent\ntools: Read, Grep\n---\n\nBody.\n' },
    skills: { 'frontend-fundamentals': validSkill('frontend-fundamentals') },
    codexSkills: Object.fromEntries(
      [...WORKFLOW_SKILLS, ...ROLE_SKILLS].map((name) => [name, validSkill(name)]),
    ),
    extraFiles: {},
  };

  mutate(tree);

  mkdirSync(path.join(root, '.claude-plugin'), { recursive: true });
  writeFileSync(path.join(root, '.claude-plugin/plugin.json'), JSON.stringify(tree.plugin, null, 2));
  writeFileSync(path.join(root, '.claude-plugin/marketplace.json'), JSON.stringify(tree.marketplace, null, 2));
  if (tree.codexPlugin !== null) {
    mkdirSync(path.join(root, '.codex-plugin'), { recursive: true });
    writeFileSync(path.join(root, '.codex-plugin/plugin.json'), JSON.stringify(tree.codexPlugin, null, 2));
  }

  for (const [dir, files] of [['commands', tree.commands], ['agents', tree.agents]]) {
    mkdirSync(path.join(root, dir), { recursive: true });
    for (const [file, body] of Object.entries(files)) writeFileSync(path.join(root, dir, file), body);
  }
  for (const [name, body] of Object.entries(tree.skills)) {
    mkdirSync(path.join(root, 'skills', name), { recursive: true });
    if (body !== null) writeFileSync(path.join(root, 'skills', name, 'SKILL.md'), body);
  }
  for (const [name, body] of Object.entries(tree.codexSkills)) {
    mkdirSync(path.join(root, 'skills', name), { recursive: true });
    if (body !== null) writeFileSync(path.join(root, 'skills', name, 'SKILL.md'), body);
  }
  for (const [relative, body] of Object.entries(tree.extraFiles)) {
    mkdirSync(path.join(root, path.dirname(relative)), { recursive: true });
    if (body !== null) writeFileSync(path.join(root, relative), body);
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

  it('rejects a missing Codex plugin manifest', () => {
    assertRejects(
      (t) => { t.codexPlugin = null; },
      /\.codex-plugin\/plugin\.json is required/,
    );
  });

  it('rejects an unknown Codex plugin manifest field', () => {
    assertRejects((t) => { t.codexPlugin.skillz = './skills/'; }, /unknown field "skillz"/);
  });

  it('rejects a Claude and Codex version disagreement', () => {
    assertRejects((t) => { t.codexPlugin.version = '9.9.9'; }, /version mismatch: Claude plugin/);
  });

  it('rejects a Codex manifest that points outside the canonical skill tree', () => {
    assertRejects((t) => { t.codexPlugin.skills = './codex-skills/'; }, /must be "\.\/skills\/"/);
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
    assertRejects((t) => { t.codexSkills.critic = null; }, /SKILL\.md is missing/);
  });

  it('rejects an unknown SKILL.md frontmatter field', () => {
    assertRejects(
      (t) => { t.codexSkills.critic = '---\nname: critic\ndescription: x\nversion: 1.0.0\n---\n\nBody.\n'; },
      /unknown frontmatter field "version"/,
    );
  });

  it('rejects a Codex skill without a name', () => {
    assertRejects(
      (t) => { t.codexSkills.critic = '---\ndescription: x\n---\n\nBody.\n'; },
      /"name" is required for Codex discovery/,
    );
  });

  it('rejects a Codex skill whose name differs from its directory', () => {
    assertRejects(
      (t) => { t.codexSkills.critic = '---\nname: reviewer\ndescription: x\n---\n\nBody.\n'; },
      /name "reviewer" must match its directory/,
    );
  });

  it('rejects a missing expected Codex workflow skill', () => {
    assertRejects((t) => { delete t.codexSkills.fix; }, /expected exactly/);
  });

  it('rejects an unexpected Codex skill', () => {
    assertRejects((t) => { t.codexSkills.surprise = validSkill('surprise'); }, /expected exactly/);
  });

  it('rejects a missing shared frontend-fundamentals skill', () => {
    assertRejects((t) => { delete t.skills['frontend-fundamentals']; }, /skills\/: expected exactly/);
  });

  for (const token of [
    'AskUserQuestion',
    'ExitPlanMode',
    'CLAUDE_PLUGIN_ROOT',
    'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS',
    'mcp__plugin_oh_my_joy__figma',
  ]) {
    it(`rejects the Claude-only runtime token ${token}`, () => {
      assertRejects(
        (t) => { t.codexSkills.fix = validSkill('fix') + `\nInvoke ${token}.\n`; },
        /Claude-only runtime token/,
      );
    });
  }
});

describe('validate-plugin: host invocation boundaries', () => {
  const flags = { 'user-invocable': 'false', 'disable-model-invocation': 'true' };

  for (const name of [...WORKFLOW_SKILLS, ...ROLE_SKILLS]) {
    for (const [key, value] of Object.entries(flags)) {
      it(`rejects ${name} without ${key}`, () => {
        assertRejects((t) => {
          t.codexSkills[name] = validSkill(name).replace(`${key}: ${value}\n`, '');
        }, new RegExp(`${key}.*must be ${value}`));
      });
    }
  }

  for (const [key, value] of Object.entries(flags)) {
    for (const wrong of [value === 'true' ? 'false' : 'true', `"${value}"`, 'null', '']) {
      it(`rejects ${key} with non-boolean or wrong value ${JSON.stringify(wrong)}`, () => {
        assertRejects((t) => {
          t.codexSkills.critic = validSkill('critic').replace(`${key}: ${value}`, `${key}: ${wrong}`);
        }, new RegExp(`${key}.*must be ${value}`));
      });
    }

    it(`rejects duplicate ${key} declarations`, () => {
      assertRejects((t) => {
        t.codexSkills.critic = validSkill('critic').replace(`${key}: ${value}\n`, `${key}: ${value}\n${key}: ${value}\n`);
      }, new RegExp(`${key}.*must be ${value}`));
    });

    it(`rejects a conflicting ${key} with whitespace before the colon`, () => {
      assertRejects((t) => {
        const opposite = value === 'true' ? 'false' : 'true';
        t.codexSkills.critic = validSkill('critic').replace(`${key}: ${value}\n`, `${key}: ${value}\n${key} : ${opposite}\n`);
      }, new RegExp(`${key}.*must be ${value}`));
    });

    it(`does not accept ${key} in the body instead of frontmatter`, () => {
      assertRejects((t) => {
        t.codexSkills.critic = validSkill('critic').replace(`${key}: ${value}\n`, '') + `\n${key}: ${value}\n`;
      }, new RegExp(`${key}.*must be ${value}`));
    });

    it(`keeps ${key} absent from the shared rubric`, () => {
      assertRejects((t) => {
        t.skills['frontend-fundamentals'] = validSkill('frontend-fundamentals').replace('---\n', `---\n${key}: ${value}\n`);
      }, new RegExp(`frontend-fundamentals.*${key}.*must be absent`));
    });
  }
});

describe('validate-plugin: Codex safety boundaries', () => {
  for (const name of ['spec', 'ralplan', 'deep-interview']) {
    it(`rejects ${name} without a non-mutating source boundary`, () => {
      assertRejects(
        (t) => { t.codexSkills[name] = validSkill(name).replace(/This workflow[^\n]+\n/, 'Inspect the project.\n'); },
        /must explicitly preserve a non-mutating/,
      );
    });
  }

  for (const name of ['review', 'verify']) {
    it(`rejects ${name} without its report-only boundary`, () => {
      assertRejects(
        (t) => { t.codexSkills[name] = validSkill(name).replace('report-only', 'observational'); },
        /must explicitly be report-only/,
      );
    });
  }

  it('rejects ship without an explicit user-request gate', () => {
    assertRejects(
      (t) => { t.codexSkills.ship = validSkill('ship').replace('explicitly requested by the user', 'the workflow is ready'); },
      /must require an explicit user request/,
    );
  });

  it('rejects ship when verification is not ordered before push', () => {
    assertRejects(
      (t) => { t.codexSkills.ship = validSkill('ship').replace('Complete verification before push.', 'Record the evidence.'); },
      /verification must complete before push/,
    );
  });

  it('rejects ship without a shared-branch guard', () => {
    assertRejects(
      (t) => { t.codexSkills.ship = validSkill('ship').replace('Never push directly from a shared branch.', 'Prepare the branch.'); },
      /guard against direct shipping/,
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

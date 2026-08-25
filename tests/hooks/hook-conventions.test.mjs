/**
 * Hook template conventions — risk class declaration and the fail-open contract.
 *
 * Every hook shipped in templates/hooks/ must declare its risk class in the header
 * and, when advisory, guarantee that even an unexpected crash cannot block the
 * session (uncaughtException → exit 0). Each hook's own test file covers behavioral
 * failure paths; this suite pins the convention itself so a new hook cannot ship
 * without stating what happens when it fails.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { listTrackedFiles, readRepoFile } from '../helpers/repo.mjs';

const RISK_CLASSES = ['advisory', 'destructive-mutation', 'security-boundary'];

describe('Hook template conventions', () => {
  const hookFiles = listTrackedFiles('templates/hooks/*.mjs');

  it('enumeration covers the shipped hooks — never silently empty', () => {
    assert.ok(hookFiles.length >= 2, `only ${hookFiles.length} hook templates enumerated`);
  });

  for (const file of hookFiles) {
    const source = readRepoFile(file);

    it(`${file} declares its risk class`, () => {
      const match = source.match(/Risk class: ([a-z-]+)/);
      assert.ok(match, `no "Risk class:" declaration in the header`);
      assert.ok(RISK_CLASSES.includes(match[1]), `unknown risk class "${match[1]}"`);
    });

    it(`${file} guards crashes with a fail-open exit 0 when advisory`, () => {
      if (!/Risk class: advisory/.test(source)) return;
      const start = source.indexOf("process.on('uncaughtException'");
      assert.ok(start !== -1, 'advisory hook has no uncaughtException guard');
      const handler = source.slice(start, source.indexOf('});', start));
      assert.match(handler, /process\.exit\(0\)/, 'crash guard must exit 0 (fail-open)');
    });
  }
});

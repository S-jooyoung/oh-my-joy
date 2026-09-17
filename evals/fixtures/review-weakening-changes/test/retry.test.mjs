import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { retry } from '../src/lib/retry.mjs';

describe('retry', () => {
  it('returns the first successful result', async () => {
    let calls = 0;
    const value = await retry(async () => {
      calls += 1;
      if (calls < 2) throw new Error('flaky');
      return 'ok';
    });
    assert.ok(value);
  });

  it.skip('stops after the configured number of attempts', async () => {
    let calls = 0;
    await assert.rejects(retry(async () => { calls += 1; throw new Error('down'); }, { attempts: 3 }));
    assert.equal(calls, 3);
  });
});

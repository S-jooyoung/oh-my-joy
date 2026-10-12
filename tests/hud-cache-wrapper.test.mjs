/**
 * Behavior tests for hud/omj-hud-cache.sh — the cached statusLine wrapper.
 *
 * The wrapper's render lock, temp files, and sweep decide whether a frame shows the
 * latest render. These tests pin ownership by the live render shell, the lock age
 * ceiling, the kept stderr log, and that a sweep never removes a running render's
 * output. Each runs under `sh` and, when installed, `dash` (CI's `sh`).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { REPO_ROOT } from './helpers/repo.mjs';

const WRAPPER = 'hud/omj-hud-cache.sh';
const SHELLS = ['sh', ...(spawnSync('sh', ['-c', 'command -v dash']).status === 0 ? ['dash'] : [])];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readIfExists = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : null);

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Fresh cache/home/config dirs plus fake HUD scripts, removed after background renders end. */
function makeSandbox() {
  const root = mkdtempSync(path.join(tmpdir(), 'omj-hud-wrapper-'));
  const dirs = { cache: path.join(root, 'cache'), home: path.join(root, 'home'), config: path.join(root, 'config') };
  Object.values(dirs).forEach((dir) => mkdirSync(dir, { recursive: true }));

  const fake = (name, body) => {
    const file = path.join(root, `${name}.mjs`);
    writeFileSync(file, body);
    return file;
  };

  const cacheFile = (name) => path.join(dirs.cache, name);

  function run(shell, hud, sessionId, extraEnv = {}) {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('OMJ_HUD_')));
    Object.assign(env, {
      PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH}`,
      HOME: dirs.home,
      CLAUDE_CONFIG_DIR: dirs.config,
      OMJ_HUD_CACHE_DIR: dirs.cache,
      OMJ_HUD_MIN_REFRESH_SECONDS: '0',
      ...extraEnv,
    });
    const child = spawn(shell, [WRAPPER, hud], { cwd: REPO_ROOT, env, stdio: ['pipe', 'pipe', 'ignore'] });
    child.stdin.end(`{"session_id":"${sessionId}"}\n`);
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    const exited = new Promise((resolve) => child.on('exit', (code) => resolve({ code, stdout })));
    return { pid: child.pid, exited };
  }

  async function cleanup() {
    const deadline = Date.now() + 10_000;
    const hasLock = () => readdirSync(dirs.cache).some((name) => /^render\..*\.lock$/.test(name));
    while (hasLock() && Date.now() < deadline) await delay(100);
    rmSync(root, { recursive: true, force: true });
  }

  return { fake, cacheFile, run, cleanup };
}

for (const shell of SHELLS) {
  describe(`hud cache wrapper (${shell})`, () => {
    it('records the live render shell pid in the render lock', async () => {
      const box = makeSandbox();
      try {
        const hud = box.fake('slow', 'await new Promise((r) => setTimeout(r, 2000));\nconsole.log("fresh");\n');
        writeFileSync(box.cacheFile('statusline.t1.txt'), 'old\n');

        const wrapper = box.run(shell, hud, 't1');
        await wrapper.exited;

        const pidFile = box.cacheFile('render.t1.lock/pid');
        const deadline = Date.now() + 1500;
        let lockPid = null;
        let owned = false;
        while (Date.now() < deadline) {
          lockPid = Number.parseInt(readIfExists(pidFile) ?? '', 10);
          if (Number.isInteger(lockPid) && lockPid !== wrapper.pid && isAlive(lockPid)) {
            owned = true;
            break;
          }
          await delay(50);
        }
        assert.ok(owned, `render lock pid ${lockPid} should be the live render shell, not the exited wrapper ${wrapper.pid}`);
      } finally {
        await box.cleanup();
      }
    });

    it("reclaims a live pid's lock past the age ceiling", async () => {
      const box = makeSandbox();
      const lockDir = box.cacheFile('render.t2.lock');
      try {
        const hud = box.fake('fresh', 'console.log("fresh");\n');
        writeFileSync(box.cacheFile('statusline.t2.txt'), 'old\n');
        mkdirSync(lockDir);
        writeFileSync(path.join(lockDir, 'pid'), `${process.pid}\n`);
        const past = new Date(Date.now() - 5000);
        utimesSync(lockDir, past, past);

        await box.run(shell, hud, 't2', { OMJ_HUD_LOCK_MAX_SECONDS: '1', OMJ_HUD_SYNC_REFRESH: '1' }).exited;

        assert.equal(readIfExists(box.cacheFile('statusline.t2.txt')), 'fresh\n');
      } finally {
        if (readIfExists(path.join(lockDir, 'pid')) === `${process.pid}\n`) rmSync(lockDir, { recursive: true, force: true });
        await box.cleanup();
      }
    });

    it("keeps a failing render's stderr and the last good output", async () => {
      const box = makeSandbox();
      try {
        const failing = box.fake('failing', 'process.stderr.write("boom\\n");\nprocess.exit(1);\n');
        const succeeding = box.fake('succeeding', 'console.log("fresh");\n');
        const output = box.cacheFile('statusline.t3.txt');
        const stderrLog = box.cacheFile('stderr.t3.log');
        writeFileSync(output, 'old\n');

        await box.run(shell, failing, 't3', { OMJ_HUD_SYNC_REFRESH: '1' }).exited;

        assert.equal(readIfExists(output), 'old\n');
        assert.match(readIfExists(stderrLog) ?? '', /boom/, 'stderr.<key>.log should keep the failing render stderr');
        const errFiles = readdirSync(box.cacheFile('')).filter((name) => /^statusline\..*\.err$/.test(name));
        assert.deepEqual(errFiles, []);

        await box.run(shell, succeeding, 't3', { OMJ_HUD_SYNC_REFRESH: '1' }).exited;

        assert.equal(readIfExists(output), 'fresh\n');
        assert.equal(existsSync(stderrLog), false, 'a clean successful render should remove stderr.<key>.log');
      } finally {
        await box.cleanup();
      }
    });

    it("does not sweep a running render's temp file", async () => {
      const box = makeSandbox();
      try {
        const slow = box.fake('slow', 'await new Promise((r) => setTimeout(r, 3000));\nconsole.log("ok");\n');
        const quick = box.fake('quick', 'console.log("b");\n');
        const sweepEnv = { OMJ_HUD_LOCK_STALE_SECONDS: '0', OMJ_HUD_SWEEP_INTERVAL_SECONDS: '0' };

        const sessionA = box.run(shell, slow, 'a', sweepEnv);
        await delay(1500);
        await box.run(shell, quick, 'b', sweepEnv).exited;
        await sessionA.exited;

        assert.equal(readIfExists(box.cacheFile('statusline.a.txt')), 'ok\n', "session a's render output should survive session b's sweep");
      } finally {
        await box.cleanup();
      }
    });
  });
}

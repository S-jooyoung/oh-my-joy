/**
 * fake-claude.mjs — a stand-in for the `claude` CLI used by tests/eval-runner.test.mjs.
 *
 * It answers the three calls the fallback runner makes, judged by argv:
 *   `plugin eval`                       → "early access", so the runner falls back
 *   `-p … --output-format stream-json`  → one canned run: a Read tool call, then a
 *                                          result whose text and cost come from
 *                                          FAKE_RUN_TEXT / FAKE_RUN_COST
 *   `-p … --output-format json`         → one judge reply; FAKE_JUDGE_SEQUENCE is a
 *                                          comma-separated list of `ok` / `garbage`
 *                                          consumed in order, counted in a file
 *                                          under FAKE_STATE_DIR so separate
 *                                          processes see the same sequence
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);

if (argv[0] === 'plugin' && argv[1] === 'eval') {
  process.stdout.write('plugin eval is currently in early access\n');
  process.exit(1);
}

const format = argv[argv.indexOf('--output-format') + 1];

if (format === 'stream-json') {
  const text = process.env.FAKE_RUN_TEXT ?? '## Critique\n\nCritique: ready\n';
  const cost = Number(process.env.FAKE_RUN_COST ?? '1.8');
  const events = [
    { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'src/server.mjs' } }] } },
    { type: 'assistant', message: { content: [{ type: 'text', text }] } },
    { type: 'result', result: text, total_cost_usd: cost },
  ];
  process.stdout.write(`${events.map((e) => JSON.stringify(e)).join('\n')}\n`);
  process.exit(0);
}

if (format === 'json') {
  const sequence = (process.env.FAKE_JUDGE_SEQUENCE ?? 'ok').split(',');
  const stateDir = process.env.FAKE_STATE_DIR ?? process.cwd();
  mkdirSync(stateDir, { recursive: true });
  const counterPath = path.join(stateDir, 'judge-calls');
  const n = existsSync(counterPath) ? Number(readFileSync(counterPath, 'utf8')) : 0;
  writeFileSync(counterPath, String(n + 1));
  const kind = sequence[Math.min(n, sequence.length - 1)];
  const reply = kind === 'ok' ? '{"pass": true, "reason": "the answer meets the rubric"}' : 'I could not reach a verdict about this answer.';
  process.stdout.write(`${JSON.stringify([{ type: 'system' }, { type: 'result', result: reply, total_cost_usd: 0.01 }])}\n`);
  process.exit(0);
}

process.stderr.write(`fake-claude: unexpected argv ${JSON.stringify(argv)}\n`);
process.exit(64);

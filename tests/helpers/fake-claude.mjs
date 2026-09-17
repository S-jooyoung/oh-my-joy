/**
 * fake-claude.mjs — a stand-in for the `claude` CLI used by tests/eval-runner.test.mjs.
 *
 * It answers the three calls the fallback runner makes, judged by argv:
 *   `plugin eval`                       → "early access", so the runner falls back;
 *                                          with FAKE_NATIVE=1 it succeeds and records a
 *                                          run's argv and times as FAKE_STATE_DIR/native-<case>.json
 *                                          after FAKE_NATIVE_DELAY_MS, with an aggregate
 *                                          costing FAKE_NATIVE_COST
 *   `-p … --output-format stream-json`  → one canned run: a Read tool call, then a
 *                                          result whose text and cost come from
 *                                          FAKE_RUN_TEXT / FAKE_RUN_COST
 *   `-p … --output-format json`         → one judge reply; FAKE_JUDGE_SEQUENCE is a
 *                                          comma-separated list of `ok` / `fail` / `garbage`
 *                                          consumed in order, counted in a file
 *                                          under FAKE_STATE_DIR so separate
 *                                          processes see the same sequence
 *   every stream-json call records its argv as FAKE_STATE_DIR/argv-N.json;
 *   FAKE_RUN_EVENTS=N adds N main-thread text messages before the final one,
 *   and one subagent message is always emitted to prove it stays out of the trace
 *   FAKE_JUDGE_ECHO=1 makes the judge copy its prompt into FAKE_STATE_DIR/judge-N.txt
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);

if (argv[0] === 'plugin' && argv[1] === 'eval') {
  if (process.env.FAKE_NATIVE) {
    // Native mode: the bare detection probe succeeds; a real run records its
    // argv and start/end times under its case name, so overlapping runs never
    // share a file, then writes an aggregate costing FAKE_NATIVE_COST.
    if (argv.length <= 2) {
      process.stdout.write('No eval cases found under this directory.\n');
      process.exit(0);
    }
    if (!process.env.FAKE_STATE_DIR) process.exit(0);
    mkdirSync(process.env.FAKE_STATE_DIR, { recursive: true });
    const caseName = argv[argv.indexOf('--case') + 1];
    const record = path.join(process.env.FAKE_STATE_DIR, `native-${caseName}.json`);
    const startedAt = Date.now();
    writeFileSync(record, JSON.stringify({ argv, startedAt }));
    await new Promise((resolve) => setTimeout(resolve, Number(process.env.FAKE_NATIVE_DELAY_MS ?? 0)));
    writeFileSync(record, JSON.stringify({ argv, startedAt, endedAt: Date.now() }));
    if (argv.includes('--output-dir')) {
      const outputDir = argv[argv.indexOf('--output-dir') + 1];
      mkdirSync(outputDir, { recursive: true });
      const cost = Number(process.env.FAKE_NATIVE_COST ?? '0.5');
      writeFileSync(path.join(outputDir, 'aggregate-result.json'), JSON.stringify({ schemaVersion: 1, costUsd: cost, durationSeconds: 1, cases: [], aggregates: { casesTotal: 1, casesPassed: 1, overallScore: 1, overallPassRate: 1 } }));
    }
    process.exit(0);
  }
  process.stdout.write('plugin eval is currently in early access\n');
  process.exit(1);
}

const format = argv[argv.indexOf('--output-format') + 1];

if (format === 'stream-json' && process.env.FAKE_STATE_DIR) {
  mkdirSync(process.env.FAKE_STATE_DIR, { recursive: true });
  const runsPath = path.join(process.env.FAKE_STATE_DIR, 'run-calls');
  const n = existsSync(runsPath) ? Number(readFileSync(runsPath, 'utf8')) : 0;
  writeFileSync(runsPath, String(n + 1));
  writeFileSync(path.join(process.env.FAKE_STATE_DIR, `argv-${n + 1}.json`), JSON.stringify(argv));
}

if (format === 'stream-json') {
  const text = process.env.FAKE_RUN_TEXT ?? '## Critique\n\nCritique: ready\n';
  const cost = Number(process.env.FAKE_RUN_COST ?? '1.8');
  const extra = Number(process.env.FAKE_RUN_EVENTS ?? 0);
  const events = [
    { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'src/server.mjs' } }] } },
    ...Array.from({ length: extra }, (_, i) => ({ type: 'assistant', message: { content: [{ type: 'text', text: `message-${String(i + 1).padStart(2, '0')}` }] } })),
    { type: 'assistant', parent_tool_use_id: 'sub-1', message: { content: [{ type: 'text', text: 'subagent-only text' }] } },
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
  if (process.env.FAKE_JUDGE_ECHO) writeFileSync(path.join(stateDir, `judge-${n + 1}.txt`), argv[argv.indexOf('-p') + 1] ?? '');
  const kind = sequence[Math.min(n, sequence.length - 1)];
  const replies = {
    ok: '{"pass": true, "reason": "the answer meets the rubric"}',
    fail: '{"pass": false, "reason": "the answer misses the rubric"}',
  };
  const reply = replies[kind] ?? 'I could not reach a verdict about this answer.';
  process.stdout.write(`${JSON.stringify([{ type: 'system' }, { type: 'result', result: reply, total_cost_usd: 0.01 }])}\n`);
  process.exit(0);
}

process.stderr.write(`fake-claude: unexpected argv ${JSON.stringify(argv)}\n`);
process.exit(64);

// node app/web/js/tools/rag-eval/logic.test.mjs [--write-json]
// Parity: report() vs skills/evaluating-rag-quality/scripts/score_eval.py on the two samples + 40 random result sets
// (with baselines, half-even rounding cases, unclassified causes). Needs python3; writes temp files in the OS temp dir.
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { evaluate, report, resultsCsv, METRICS, CAUSES } from './logic.js';
import { toCsv } from '../uat-tracker/csv.js';
import { SAMPLES } from './samples.js';

const SCRIPT = fileURLToPath(new URL('../../../../../skills/evaluating-rag-quality/scripts/score_eval.py', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'rag-parity-'));
let fail = 0, n = 0;
const py = (rows, base) => {
  const head = ['id', 'category', 'type', 'risk', ...METRICS, 'failure_cause', 'note'];
  const w = (name, rs) => { const p = join(dir, name); writeFileSync(p, toCsv([head, ...rs.map((r) => head.map((k) => r[k] ?? ''))])); return p; };
  const args = [SCRIPT, w('r.csv', rows), ...(base ? ['--baseline', w('b.csv', base)] : [])];
  return execFileSync('python3', args, { encoding: 'utf8' });
};
const check = (name, rows, base) => {
  n++;
  const want = py(rows, base);
  const got = report(rows, base) + '\n'; // print() adds a newline
  if (want !== got) { fail++; console.log('FAIL', name); const a = want.split('\n'), b = got.split('\n'); for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { console.log('  py:', a[i], '\n  js:', b[i]); break; } }
};
for (const lang of ['en', 'fr']) { const r = evaluate(SAMPLES[lang][0].state); check('sample ' + lang, r.rows); }
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];
for (let k = 0; k < 40; k++) {
  const mk = () => Array.from({ length: 1 + Math.floor(rnd() * 16) }, (_, i) => ({ id: `Q-${String(Math.floor(rnd() * 90)).padStart(3, '0')}`, category: pick(['Disputes', 'Refunds', 'Cards', 'Fraud']),
    type: pick(['answerable', 'must_refuse', 'must_escalate']), risk: pick(['high', 'medium', 'low', '']),
    ...Object.fromEntries(METRICS.map((m) => [m, pick(['1', '1', '1', '0', ''])])), failure_cause: pick(['', ...CAUSES, 'other']), note: pick(['', 'x']) }));
  check('random ' + k, mk(), rnd() < 0.5 ? mk() : null);
}
rmSync(dir, { recursive: true, force: true });
console.log(`${fail ? 'FAIL' : 'PASS'} score_eval.py parity: ${n - fail} / ${n} reports identical`);
const s = evaluate(SAMPLES.en[0].state);
const ok = !s.pass && s.overallOk && s.highFails.map((i) => i.id).join() === 'DSP-02';
console.log(`${ok ? 'PASS' : 'FAIL'} EN sample: overall ${s.overall.toFixed(1)} % ≥ ${s.threshold} % but blocked by DSP-02 (180-day window)`);
if (!ok) fail++;
if (process.argv.includes('--write-json')) { writeFileSync(new URL('./samples.json', import.meta.url), JSON.stringify(SAMPLES, null, 1) + '\n'); console.log('samples.json written'); }
process.exitCode = fail ? 1 : 0;
void resultsCsv;

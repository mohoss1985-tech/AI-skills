// node app/web/js/tools/wsjf-planner/logic.test.mjs [--write-json]
import { writeFileSync } from 'fs';
import { runParity } from './compare.js';
import { SAMPLES } from './samples.js';
import { compute, itemsFromCsv, round2 } from './logic.js';
import { ROUND } from './fixtures.js';

let fail = 0;
// V3 deliberately deviates from wsjf.py for items with blank/0 points (not estimated, never committed): see below.
for (const r of runParity().filter((x) => x.id !== 'quotes')) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id}: ${r.label}`);
  if (!r.ok) { fail++; for (const [n, ok] of r.checks) if (!ok) console.log('   x', n); }
}
const eq = (name, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, ok ? '' : `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
const it = (id, bv, tc, rr, size, points, extra = {}) => ({ id, title: id, type: 'Story', business_value: bv, time_criticality: tc, risk_reduction: rr, job_size: size, points, depends_on: '', deadline: '', ...extra });
// regression: new item (0/blank points) is not committed for free
let r = compute([it('A', 5, 5, 5, 5, 10), it('N', 1, 1, 1, 1, '')], 100);
eq('blank points: not committed', r.planned, ['A']);
eq('blank points: reason + flag', [r.out[0].reason.code, r.flags.N.map((f) => f.code)], ['unestimated', ['unestimated']]);
// regression: blank size does not rank first
r = compute([it('A', 5, 5, 5, 5, 10), it('B', 13, 13, 13, '', 10)], 100);
eq('blank size: unranked, last, no WSJF', [r.ranked.map((x) => x.id), r.ranked[1].wsjf, r.planned], [['A', 'B'], null, ['A']]);
eq('blank size: error code', r.errors.some((e) => e.code === 'nan' && e.field === 'job_size' && e.id === 'B'), true);
// regression: pasted rr=0 is reported, not silently 1
const pasted = compute(itemsFromCsv('id,title,business_value,time_criticality,risk_reduction,job_size,points\nA,x,5,5,0,3,10'), 50);
eq('csv rr=0 is flagged', pasted.errors.some((e) => e.field === 'risk_reduction'), true);
// regression: a smaller item fits below a miss: no single cut line, skipped flagged
r = compute([it('A', 13, 13, 13, 5, 60), it('B', 8, 8, 8, 5, 50), it('C', 5, 5, 5, 5, 40)], 105);
eq('skipped item is labelled, cut line suppressed', [r.planned, [...r.skipped], r.cleanCut], [['A', 'C'], ['B'], false]);
r = compute([it('A', 13, 13, 13, 5, 60), it('B', 8, 8, 8, 5, 50)], 100);
eq('clean cut when nothing is skipped', [r.planned, r.cleanCut], [['A'], true]);
// quotes case now: empty points = not estimated
const q = runParity().find((x) => x.id === 'quotes');
eq('quotes case: empty-points item not planned', q.got.planned.length < q.exp.json.planned.length, true);
// Python round() parity on every Fibonacci ratio.
const bad = ROUND.filter(([c, s, v]) => round2(c, s) !== v);
console.log(`${bad.length ? 'FAIL' : 'PASS'} round(): ${ROUND.length} ratios vs Python`);
fail += bad.length;
if (process.argv.includes('--write-json')) {
  writeFileSync(new URL('./samples.json', import.meta.url), JSON.stringify(SAMPLES, null, 1) + '\n');
  console.log('samples.json written');
}
console.log(fail ? `${fail} failing` : 'all wsjf.py parity checks pass');
process.exit(fail ? 1 : 0);

// node app/web/js/tools/use-case-scorer/logic.test.mjs [--write-json]
import { writeFileSync } from 'fs';
import { compute, score, scoresCsv, useCasesFromCsv } from './logic.js';
import { SAMPLES } from './samples.js';

let fail = 0;
const eq = (name, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, ok ? '' : `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
for (const lang of ['en', 'fr']) {
  const s = SAMPLES[lang][0].state;
  const r = compute(s.useCases, s.weights, s.rules);
  eq(`${lang} scores`, r.ranked.map((u) => [u.id, u.score]), [['UC-01', 4.5], ['UC-03', 4], ['UC-02', 3.8], ['UC-04', 3.3], ['UC-06', 2.3], ['UC-05', 2.2]]);
  eq(`${lang} lanes`, Object.fromEntries(Object.entries(r.lanes).map(([k, v]) => [k, v.map((u) => u.id)])), { now: ['UC-01', 'UC-02'], next: ['UC-03', 'UC-04'], later: ['UC-05'], excluded: ['UC-06'] });
  eq(`${lang} gates`, r.ranked.filter((u) => u.gates.length).map((u) => [u.id, u.gates]), [['UC-03', ['knowledge']], ['UC-04', ['risk']]]);
  eq(`${lang} csv round trip`, useCasesFromCsv(scoresCsv(r)).map((u) => [u.id, u.name, u.value, u.guardrail]), r.ranked.map((u) => [u.id, u.name, u.value, u.guardrail]));
}
eq('weights all on value', score({ value: 4, feasibility: 1, risk: 5 }, { value: 1, feasibility: 0, risk: 0 }), 4);
eq('zero weights', score({ value: 4, feasibility: 1, risk: 5 }, { value: 0, feasibility: 0, risk: 0 }), 0);
const s = SAMPLES.en[0].state;
eq('nowSlots 1', compute(s.useCases, s.weights, { ...s.rules, nowSlots: 1 }).lanes.now.map((u) => u.id), ['UC-01']);
if (process.argv.includes('--write-json')) { writeFileSync(new URL('./samples.json', import.meta.url), JSON.stringify(SAMPLES, null, 1) + '\n'); console.log('samples.json written'); }
console.log(fail ? `${fail} failing` : 'all use-case scorer checks pass');
process.exit(fail ? 1 : 0);

// node app/web/js/tools/use-case-scorer/logic.test.mjs [--write-json]
import { writeFileSync } from 'fs';
import { compute, ensureUids, nextId, score, scoresCsv, useCasesFromCsv } from './logic.js';
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
// regression: weight change must change scores (grid repaint relies on compute with the new weights), and ids stay unique after a delete
const base = SAMPLES.en[0].state;
eq('weights 20/20/60 change UC-01 score', compute(base.useCases, { value: 20, feasibility: 20, risk: 60 }, base.rules).ranked.find((u) => u.id === 'UC-01').score, 4.2);
eq('blank weights: nothing Now', compute(base.useCases, { value: 0, feasibility: 0, risk: 0 }, base.rules).lanes.now.length, 0);
const del = base.useCases.filter((u) => u.id !== 'UC-02');
eq('nextId after delete is unique', nextId(del), 'UC-07');
eq('nextId empty', nextId([]), 'UC-01');
eq('nextId skips used', nextId([{ id: 'UC-01' }, { id: 'UC-02' }]), 'UC-03');
const dup = ensureUids([{ id: 'UC-06', name: 'a', value: 5, feasibility: 5, risk: 1 }, { id: 'UC-06', name: 'b', value: 1, feasibility: 1, risk: 5 }]);
const dr = compute(dup, base.weights, base.rules);
eq('uids unique', new Set(dup.map((r) => r._uid)).size, 2);
eq('duplicate ids keep own scores (keyed by _uid)', dr.ranked.map((u) => [u.name, u.score]), [['a', 5], ['b', 1]]);
eq('ensureUids is stable', ensureUids(dup).map((r) => r._uid), dup.map((r) => r._uid));
if (process.argv.includes('--write-json')) { writeFileSync(new URL('./samples.json', import.meta.url), JSON.stringify(SAMPLES, null, 1) + '\n'); console.log('samples.json written'); }
console.log(fail ? `${fail} failing` : 'all use-case scorer checks pass');
process.exit(fail ? 1 : 0);

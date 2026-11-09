// node app/web/js/tools/impact-heatmap/logic.test.mjs [--write-json]
import { writeFileSync } from 'fs';
import { compute, cycle, parseAreas, heatmapCsv, gapsCsv, pruneScores } from './logic.js';
import { SAMPLES } from './samples.js';

let fail = 0;
const eq = (name, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, ok ? '' : `\n  got  ${JSON.stringify(a)}\n  want ${JSON.stringify(b)}`); };
const en = compute(SAMPLES.en[0].state);
eq('en totals', [en.rows.map((r) => r.total), en.colTotals, en.grand, en.max], [[7, 7, 8, 8, 8, 3, 6, 5], { people: 8, process: 12, data: 8, tech: 12, compliance: 12 }, 52, 120]);
eq('en top 3', en.top.slice(0, 3).map((t) => `${t.area}/${t.dim}`), ['Visa Exception File interface/tech', 'Block card process/process', 'Card management system/tech']);
eq('en flags', en.flags.map((f) => f.code + ':' + (f.vars.area)), ['flagNoGap:Card management system', 'flagNoOwner:Fraud operations']);
eq('en effort days', en.days, [354, 1260]);
const fr = compute(SAMPLES.fr[0].state);
eq('fr kinds parsed', parseAreas(SAMPLES.fr[0].state.areas).map((a) => a.kind), ['system', 'system', 'system', 'process', 'team', 'team', 'team', 'team']);
eq('fr flags', fr.flags.map((f) => f.code), ['flagNoGap', 'flagNoOwner']);
eq('cycle', [cycle(0), cycle(3), cycle(0, true), cycle(2, true)], [1, 0, 3, 1]);
eq('csv head', heatmapCsv(en).split('\n')[0], 'area,kind,owner,people,process,data,tech,compliance,total');
eq('gaps csv rows', gapsCsv(en).trim().split('\n').length, 8);
eq('prune', Object.keys(pruneScores({ areas: 'A, team, x', scores: { A: {}, B: {} } })), ['A']);
if (process.argv.includes('--write-json')) { writeFileSync(new URL('./samples.json', import.meta.url), JSON.stringify(SAMPLES, null, 1) + '\n'); console.log('samples.json written'); }
console.log(fail ? `${fail} failing` : 'all impact-heatmap checks pass');
process.exit(fail ? 1 : 0);

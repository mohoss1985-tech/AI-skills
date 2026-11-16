// node app/web/js/tools/uat-tracker/logic.test.mjs [--write-json]
// Parity with skills/running-uat/scripts/uat_report.py --json on the skill's example exports (figures + exit criteria),
// then the samples: day 8 of 10, NO-GO with CARD-301 (stolen card approved in stand-in) as the blocking defect.
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { compute, casesFromCsv, defectsFromCsv } from './logic.js';
import { SAMPLES } from './samples.js';

const root = (p) => fileURLToPath(new URL('../../../../../' + p, import.meta.url));
const ex = root('skills/running-uat/examples/executions.csv'), df = root('skills/running-uat/examples/defects.csv');
let fail = 0;
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) fail++; };
for (const [planned, days, day] of [[120, 10, 8], [112, 10, 10], [150, 12, 5]]) {
  const py = JSON.parse(execFileSync('python3', [root('skills/running-uat/scripts/uat_report.py'), ex, '--defects', df, '--planned', String(planned), '--days', String(days), '--day', String(day), '--json'], { encoding: 'utf8' }));
  const r = compute({ cases: casesFromCsv(readFileSync(ex, 'utf8')).cases, defects: defectsFromCsv(readFileSync(df, 'utf8')).defects, planned, days, day });
  const same = r.passed === py.passed && r.failed === py.failed && r.blocked === py.blocked && r.notRun === py.not_run && r.executedPct === py.executed_pct
    && r.passedPct === py.passed_pct && r.scheduleGap === py.schedule_gap_pts && JSON.stringify(r.criteria.filter((c) => c.id !== 'reqCovered').map((c) => c.met)) === JSON.stringify(py.exit_criteria.filter((c, i) => r.criteria[i] && r.criteria[i].id !== 'reqCovered').map((c) => c.met))
    && r.requirements.coveredPassed === py.requirements.covered_passed && r.defects.open === py.defects.open && r.defects.retest === py.defects.waiting_retest;
  check(`uat_report.py parity (planned ${planned}, day ${day}/${days})`, same);
}
for (const lang of ['en', 'fr']) {
  const r = compute(SAMPLES[lang][0].state);
  check(`${lang} sample: NO-GO, 0/5 criteria, blocking ${r.defects.blocking.map((d) => d.key)}`, r.verdict === 'nogo' && r.met === 0 && r.defects.blocking.length === 1 && r.rag === 'red');
}
// V3 regression: a requirement is covered only when ALL its tests passed
{
  const mk = (id, req, status) => ({ id, title: '', feature: 'F', req, tester: '', status, defect: '', evidence: 'x', day: 1, expected: '' });
  const r = compute({ planned: 5, days: 10, day: 5, criteria: { allRun: false, passRate: false, reqCovered: true, noBlocking: false, noMajor: false },
    cases: [mk('T1', 'R1', 'pass'), mk('T2', 'R1', 'pass'), mk('T3', 'R2', 'pass'), mk('T4', 'R2', 'fail'), mk('T5', 'R3', 'pass'), mk('T6', 'R3', 'notrun'), mk('T7', 'R4', 'blocked'), mk('T8', 'R5', 'notrun')], defects: [] });
  check('coverage: covered = R1 only', JSON.stringify(r.requirements.covered) === '["R1"]');
  check('coverage: at risk = failed or blocked (R2, R4)', JSON.stringify(r.requirements.atRisk) === '["R2","R4"]');
  check('coverage: not covered = nothing failed but not all passed (R3, R5)', JSON.stringify(r.requirements.notCovered) === '["R3","R5"]');
  check('coverage: legacy any-pass count unchanged (script parity)', r.requirements.coveredPassed === 3);
  check('coverage: exit criterion not met while any requirement is not covered', r.criteria.find((c) => c.id === 'reqCovered').met === false);
  const ok = compute({ planned: 2, days: 10, day: 5, criteria: { reqCovered: true }, cases: [mk('A', 'R1', 'pass'), mk('B', 'R1', 'pass')], defects: [] });
  check('coverage: all passed -> criterion met', ok.criteria.find((c) => c.id === 'reqCovered').met === true);
}
if (process.argv.includes('--write-json')) { writeFileSync(new URL('./samples.json', import.meta.url), JSON.stringify(SAMPLES, null, 1) + '\n'); console.log('samples.json written'); }
process.exitCode = fail ? 1 : 0;

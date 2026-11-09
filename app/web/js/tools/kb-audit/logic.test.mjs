// node app/web/js/tools/kb-audit/logic.test.mjs [--write-json]
import { writeFileSync } from 'fs';
import { audit, actionsCsv, auditCsv, coverageCsv, parseArticles } from './logic.js';
import { SAMPLES } from './samples.js';

let fail = 0;
const eq = (name, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, ok ? '' : `\n  got  ${JSON.stringify(a)}\n  want ${JSON.stringify(b)}`); };
for (const lang of ['en', 'fr']) {
  const r = audit(SAMPLES[lang][0].state);
  eq(`${lang} freshness`, r.summary.fresh, { fresh: 3, due: 1, stale: 5, never: 1 });
  eq(`${lang} owners`, r.articles.map((a) => a.ownerStatus).filter((s) => s !== 'ok'), ['none', 'left']);
  eq(`${lang} coverage`, r.questions.map((q) => q.coverage), ['ok', 'ok', 'gap', 'partial', 'stale', 'stale', 'stale', 'gap']);
  eq(`${lang} covered by volume`, [r.summary.coveredPct, r.summary.gapVolume, r.summary.weeks], [56, 8000, 2]);
  eq(`${lang} first actions`, r.actions.slice(0, 4).map((a) => `${a.type}:${a.ref}`), ['write:Q3', 'partial:Q4', 'review:KB-10', 'dedupe:Q4']);
  eq(`${lang} csv lines`, [actionsCsv(r).trim().split('\n').length, auditCsv(r).trim().split('\n').length, coverageCsv(r).trim().split('\n').length], [13, 11, 9]);
}
eq('comma inside brackets stays in the title', parseArticles('KB-04, Délais (13 mois, art. L133-24 CMF), X, 2026-01-01, faq, client')[0].title, 'Délais (13 mois, art. L133-24 CMF)');
const r = audit({ ...SAMPLES.en[0].state, asOf: '2026-11-09', cycles: { faq: 1000, procedure: 1000, tariff: 1000, policy: 1000, script: 1000 } });
eq('long cycles: only never-reviewed left', r.summary.fresh, { fresh: 9, due: 0, stale: 0, never: 1 });
eq('internal-only answer', audit({ articles: 'A1, x, P, 2026-11-01, script, internal', owners: 'P, t', questions: 'q, 10, A1, Y', asOf: '2026-11-09' }).questions[0].coverage, 'internal');
if (process.argv.includes('--write-json')) { writeFileSync(new URL('./samples.json', import.meta.url), JSON.stringify(SAMPLES, null, 1) + '\n'); console.log('samples.json written'); }
console.log(fail ? `${fail} failing` : 'all kb-audit checks pass');
process.exit(fail ? 1 : 0);

// node app/web/js/tools/kb-audit/logic.test.mjs [--write-json]
import { writeFileSync } from 'fs';
import { audit, actionsCsv, auditCsv, coverageCsv, parseArticles, validateInput, isoDate } from './logic.js';
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
// V3 regressions
eq('comma in title: reported', validateInput({ articles: 'A2, Apple Pay, how to add a card, Lea Martin, 2025-01-15, Procedure, Customer' }).map((i) => i.code), ['vCols', 'vDate']);   // the shifted date column is reported too
eq('DD/MM/YYYY accepted', [isoDate('15/03/2026'), isoDate('5.3.26'), isoDate('2026-03-15')], ['2026-03-15', '2026-03-05', '2026-03-15']);
eq('bad date reported', validateInput({ articles: 'A1, t, o, 31/02/2026, faq, customer\nA2, t, o, soon, faq, customer' }).map((i) => i.code), ['vDate', 'vDate']);
eq('dd/mm dates age correctly', audit({ articles: 'A1, t, o, 01/11/2026, faq, customer', owners: 'o, t', questions: 'q, 1, A1, Y', asOf: '2026-11-09' }).articles[0].age, 8);
eq('duplicate id reported', validateInput({ articles: 'A1, t, o, 2026-01-01, faq, customer\nA1, u, o, 2026-01-01, faq, customer' }).map((i) => i.code), ['vDupId']);
eq('non-numeric volume reported', validateInput({ questions: 'q1, abc, A1, Y\nq2, 1 200, A1, Y' }).map((i) => i.code), ['vVolume']);
eq('sample inputs are clean', [validateInput(SAMPLES.en[0].state).length, validateInput(SAMPLES.fr[0].state).length], [0, 0]);
const unk = audit({ articles: 'A1, t, Nobody, 2026-11-01, faq, customer', owners: 'P, t', questions: 'q, 1, A1, Y', asOf: '2026-11-09' }).actions.find((a) => a.type === 'owner');
eq('unknown owner is not "left"', unk.vars.status, 'unknown');
if (process.argv.includes('--write-json')) { writeFileSync(new URL('./samples.json', import.meta.url), JSON.stringify(SAMPLES, null, 1) + '\n'); console.log('samples.json written'); }
console.log(fail ? `${fail} failing` : 'all kb-audit checks pass');
process.exit(fail ? 1 : 0);

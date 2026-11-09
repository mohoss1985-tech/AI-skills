/* UAT tracker · pure logic (no DOM; node logic.test.mjs). Owner G.
   Figures and exit criteria follow skills/running-uat/scripts/uat_report.py (same counting rules, same criteria):
     executed = passed + failed; not run = not-run cases + (planned − cases in the grid); blocked counts apart;
     run % and passed % are of PLANNED tests; a defect is "live" when open or waiting re-test.
   Case:   {id, title, feature, req, tester, status: notrun|pass|fail|blocked, defect, evidence, day, expected}
   Defect: {key, summary, severity: blocking|major|minor|enhancement, status: open|retest|closed|rejected, feature, created (day), workaround}
   Criteria: {allRun, passRate (bool), passRateMin (number), reqCovered, noBlocking, noMajor} */
import { parseCsv, pickCol, toCsv } from './csv.js';

export const STATUSES = ['notrun', 'pass', 'fail', 'blocked'];
export const SEVERITIES = ['blocking', 'major', 'minor', 'enhancement'];
export const DSTATES = ['open', 'retest', 'closed', 'rejected'];
export const DEFAULT_CRITERIA = { allRun: true, passRate: true, passRateMin: 95, reqCovered: true, noBlocking: true, noMajor: true };
export const CRITERIA = ['allRun', 'passRate', 'reqCovered', 'noBlocking', 'noMajor'];

const round1 = (x) => Math.round(x * 10) / 10;
export const reqsOf = (s) => String(s || '').replace(/;/g, ',').split(',').map((x) => x.trim()).filter(Boolean);
const live = (d) => d.status === 'open' || d.status === 'retest';

export function compute(state) {
  const cases = (state.cases || []).filter((c) => c && (c.id || c.title));
  const defects = (state.defects || []).filter((d) => d && d.key);
  const crit = { ...DEFAULT_CRITERIA, ...(state.criteria || {}) };
  const planned = Math.max(+state.planned || 0, cases.length) || 0;
  const days = Math.max(1, +state.days || 1);
  const day = Math.min(days, Math.max(1, +state.day || 1));
  const s = { pass: 0, fail: 0, blocked: 0, notrun: 0 };
  for (const c of cases) s[STATUSES.includes(c.status) ? c.status : 'notrun']++;
  const executed = s.pass + s.fail;
  const notRun = s.notrun + Math.max(0, planned - cases.length);
  const pct = (n) => (planned ? round1((100 * n) / planned) : 0);
  const res = {
    planned, inGrid: cases.length, passed: s.pass, failed: s.fail, blocked: s.blocked, notRun, executed,
    executedPct: pct(executed), passedPct: pct(s.pass), passRateOfExecuted: executed ? round1((100 * s.pass) / executed) : 0,
    day, days, expectedPct: round1((100 * day) / days),
  };
  res.scheduleGap = round1(res.executedPct - res.expectedPct);

  // burn-up: cumulative run / passed per day (cases carry the day they were run), plan line
  res.burn = [];
  for (let d = 1; d <= days; d++) {
    const upto = cases.filter((c) => (c.status === 'pass' || c.status === 'fail') && (+c.day || day) <= d);
    res.burn.push({ day: d, plan: round1((planned * d) / days), run: d <= day ? upto.length : null, passed: d <= day ? upto.filter((c) => c.status === 'pass').length : null });
  }

  // features
  const feats = new Map();
  for (const c of cases) {
    const f = (c.feature || '').trim() || '—';
    if (!feats.has(f)) feats.set(f, { feature: f, pass: 0, fail: 0, blocked: 0, notrun: 0 });
    feats.get(f)[STATUSES.includes(c.status) ? c.status : 'notrun']++;
  }
  res.features = [...feats.values()];

  // requirements
  const reqs = new Map();
  for (const c of cases) for (const q of reqsOf(c.req)) { if (!reqs.has(q)) reqs.set(q, new Set()); reqs.get(q).add(c.status); }
  res.requirements = { total: reqs.size, coveredPassed: [...reqs.values()].filter((v) => v.has('pass')).length,
    notPassed: [...reqs.keys()].filter((q) => !reqs.get(q).has('pass')).sort() };

  // defects
  const lv = defects.filter(live);
  const bySev = { blocking: 0, major: 0, minor: 0, enhancement: 0 };
  const closedBySev = { blocking: 0, major: 0, minor: 0, enhancement: 0 };
  for (const d of defects) (live(d) ? bySev : closedBySev)[SEVERITIES.includes(d.severity) ? d.severity : 'minor']++;
  res.defects = {
    total: defects.length, open: defects.filter((d) => d.status === 'open').length, retest: defects.filter((d) => d.status === 'retest').length,
    closed: defects.filter((d) => d.status === 'closed').length, rejected: defects.filter((d) => d.status === 'rejected').length,
    bySev, closedBySev,
    blocking: lv.filter((d) => d.severity === 'blocking'),
    majorNoWa: lv.filter((d) => d.severity === 'major' && !d.workaround),
    majorWa: lv.filter((d) => d.severity === 'major' && d.workaround),
    minor: lv.filter((d) => d.severity === 'minor'),
    enhancements: lv.filter((d) => d.severity === 'enhancement'),
    list: defects.map((d) => ({ ...d, age: d.created !== '' && d.created != null && !isNaN(+d.created) ? day - +d.created : null,
      cases: cases.filter((c) => (c.defect || '').split(/[,\s]+/).includes(d.key)).map((c) => c.id) })),
  };

  // flags on cases
  const keys = new Set(defects.map((d) => d.key));
  res.flags = {};
  for (const c of cases) {
    const f = [];
    const refs = (c.defect || '').split(/[,\s]+/).filter(Boolean);
    if (c.status === 'fail' && !refs.length) f.push('failNoDefect');
    if (refs.some((k) => !keys.has(k))) f.push('unknownDefect');
    if ((c.status === 'pass' || c.status === 'fail') && !String(c.evidence || '').trim()) f.push('noEvidence');
    if (f.length) res.flags[c.id] = f;
  }

  // exit criteria (uat_report.py order), only the ones switched on
  const all = [
    { id: 'allRun', met: notRun === 0 && s.blocked === 0, vars: { run: executed, planned, blocked: s.blocked, notRun } },
    { id: 'passRate', met: res.passedPct >= +crit.passRateMin, vars: { pct: res.passedPct, min: +crit.passRateMin } },
    { id: 'reqCovered', met: !res.requirements.notPassed.length, vars: { ok: res.requirements.coveredPassed, total: res.requirements.total, list: res.requirements.notPassed.join(', ') } },
    { id: 'noBlocking', met: res.defects.blocking.length === 0, vars: { n: res.defects.blocking.length, list: res.defects.blocking.map((d) => d.key).join(', ') } },
    { id: 'noMajor', met: res.defects.majorNoWa.length === 0, vars: { n: res.defects.majorNoWa.length, list: res.defects.majorNoWa.map((d) => d.key).join(', ') } },
  ];
  res.criteria = all.filter((c) => crit[c.id] !== false);
  res.met = res.criteria.filter((c) => c.met).length;
  const reservations = [...res.defects.majorWa, ...res.defects.minor];
  res.reservations = reservations;
  res.verdict = res.met === res.criteria.length ? (reservations.length ? 'goRes' : 'go') : 'nogo';
  // one-line status (skill §3): red = a blocking defect is live or the plan slips > 10 pts; amber = not met yet; green = met
  res.rag = res.defects.blocking.length || res.scheduleGap < -10 ? 'red' : res.verdict === 'nogo' ? 'amber' : 'green';
  res.forecast = day < days; // the decision is "if it were today"
  return res;
}

/* ---------------------------------------------------------------- CSV in (uat_report.py column aliases) */
const COLS = {
  test: ['test', 'test key', 'test id', 'test case', 'cas de test', 'id', 'key', 'clé', 'name', 'nom'],
  summary: ['summary', 'résumé', 'resume', 'titre', 'title'],
  status: ['status', 'statut', 'execution status', 'test run status', 'résultat', 'result', 'état', 'etat'],
  feature: ['feature', 'fonctionnalité', 'fonctionnalite', 'component', 'components', 'composant', 'module', 'folder', 'dossier', 'epic'],
  requirement: ['requirement', 'requirements', 'exigence', 'exigences', 'story', 'user story', 'covers', 'linked issues'],
  tester: ['tester', 'testeur', 'assignee', 'executed by', 'exécuté par'],
  defect: ['defect', 'defects', 'anomalie', 'anomalies', 'bug'],
  evidence: ['evidence', 'comment', 'commentaire', 'preuve', 'note'],
  day: ['day', 'jour'],
  key: ['key', 'issue key', 'clé', 'id', 'defect id', 'anomalie', 'defect'],
  severity: ['severity', 'sévérité', 'severite', 'gravité', 'gravite', 'priority', 'priorité', 'priorite'],
  created: ['created', 'créé', 'cree', 'creation date', 'date de création', 'detected on date', 'date'],
  workaround: ['workaround', 'contournement', 'solution de contournement'],
};
const RUN = { PASS: 'pass', PASSED: 'pass', OK: 'pass', SUCCESS: 'pass', 'SUCCÈS': 'pass', SUCCES: 'pass', 'RÉUSSI': 'pass', REUSSI: 'pass',
  FAIL: 'fail', FAILED: 'fail', KO: 'fail', 'ÉCHEC': 'fail', ECHEC: 'fail', BLOCKED: 'blocked', 'BLOQUÉ': 'blocked', BLOQUE: 'blocked',
  UNTESTABLE: 'blocked' };
const SEV = { blocker: 'blocking', blocking: 'blocking', bloquant: 'blocking', bloquante: 'blocking', critical: 'blocking', critique: 'blocking',
  highest: 'blocking', major: 'major', majeur: 'major', majeure: 'major', high: 'major', haute: 'major', minor: 'minor', mineur: 'minor',
  mineure: 'minor', medium: 'minor', moyenne: 'minor', low: 'minor', lowest: 'minor', basse: 'minor', trivial: 'minor', cosmetic: 'minor',
  enhancement: 'enhancement', 'évolution': 'enhancement', evolution: 'enhancement' };
const CLOSED = ['closed', 'done', 'clos', 'close', 'fermé', 'ferme', 'fermée', 'validated', 'validé', 'verified', 'terminé'];
const REJECTED = ['rejected', 'rejeté', 'rejete', 'not a bug', "won't fix", 'wont fix', 'duplicate', 'doublon', 'cancelled', 'annulé'];
const RETEST = ['resolved', 'fixed', 'ready for retest', 'to retest', 'à retester', 'a retester', 'corrigé', 'corrige', 'livré', 'delivered', 'in test'];
const YES = ['yes', 'y', 'oui', 'true', '1', 'accepted', 'accepté', 'accepte'];

export function casesFromCsv(text) {
  const { header, rows } = parseCsv(text);
  const c = Object.fromEntries(Object.entries(COLS).map(([k, a]) => [k, pickCol(header, a)]));
  if (!c.status) return { error: 'noStatus', cases: [] };
  const unknown = {};
  const cases = rows.map((r, i) => {
    const raw = (r[c.status] || '').trim().toUpperCase();
    const st = RUN[raw] || 'notrun';
    if (!RUN[raw] && !['TODO', 'NOT RUN', 'NO RUN', 'NON EXÉCUTÉ', 'NON EXECUTE', 'READY', 'EXECUTING', 'EN COURS', 'N/A', ''].includes(raw)) unknown[raw] = (unknown[raw] || 0) + 1;
    return { id: (c.test && r[c.test]) || `UAT-${String(i + 1).padStart(2, '0')}`, title: (c.summary && r[c.summary]) || '',
      feature: (c.feature && r[c.feature]) || '', req: (c.requirement && r[c.requirement]) || '', tester: (c.tester && r[c.tester]) || '',
      status: st, defect: (c.defect && r[c.defect]) || '', evidence: (c.evidence && r[c.evidence]) || '', day: c.day && r[c.day] ? +r[c.day] || '' : '', expected: '' };
  });
  return { cases, unknown };
}

export function defectsFromCsv(text, today) {
  const { header, rows } = parseCsv(text);
  const c = Object.fromEntries(Object.entries(COLS).map(([k, a]) => [k, pickCol(header, a)]));
  if (!c.key) return { error: 'noKey', defects: [] };
  const unknownSev = new Set();
  const defects = rows.map((r) => {
    const st = (r[c.status] || '').trim().toLowerCase();
    const sevRaw = (r[c.severity] || '').trim().toLowerCase();
    if (!SEV[sevRaw]) unknownSev.add(sevRaw);
    return { key: r[c.key], summary: (c.summary && r[c.summary]) || '', severity: SEV[sevRaw] || 'minor',
      status: REJECTED.includes(st) ? 'rejected' : CLOSED.includes(st) ? 'closed' : RETEST.includes(st) ? 'retest' : 'open',
      feature: (c.feature && r[c.feature]) || '', created: c.created && /^\d+$/.test(r[c.created] || '') ? +r[c.created] : (today || ''),
      workaround: YES.includes((r[c.workaround] || '').trim().toLowerCase()) };
  });
  return { defects, unknownSev: [...unknownSev] };
}

/* ---------------------------------------------------------------- CSV out */
export function runsCsv(state) {
  const rows = [['Test ID', 'Summary', 'Feature', 'Requirement', 'Tester', 'Status', 'Defect', 'Evidence', 'Day', 'Expected Result']];
  const S = { notrun: 'TODO', pass: 'PASSED', fail: 'FAILED', blocked: 'BLOCKED' };
  for (const c of state.cases || []) rows.push([c.id, c.title, c.feature, c.req, c.tester, S[c.status] || 'TODO', c.defect, c.evidence, c.day ?? '', c.expected || '']);
  return toCsv(rows);
}
export function defectsCsv(state) {
  const rows = [['Key', 'Summary', 'Severity', 'Status', 'Feature', 'Created (day)', 'Workaround']];
  const SV = { blocking: 'Blocker', major: 'Major', minor: 'Minor', enhancement: 'Enhancement' };
  const ST = { open: 'Open', retest: 'Ready for retest', closed: 'Closed', rejected: 'Rejected' };
  for (const d of state.defects || []) rows.push([d.key, d.summary, SV[d.severity] || d.severity, ST[d.status] || d.status, d.feature, d.created ?? '', d.workaround ? 'yes' : 'no']);
  return toCsv(rows);
}

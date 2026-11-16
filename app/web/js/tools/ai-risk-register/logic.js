/* AI risk register: pure logic (skill governing-ai-risk). No DOM. Tested by logic.test.mjs.
   EU AI Act tier screening as an explicit decision tree. Legal basis read on the Official Journal text (16 Nov 2026):
   Regulation (EU) 2024/1689, as amended by Regulation (EU) 2026/1744 (Digital Omnibus on AI, OJ L 24.7.2026).

     Gate 1  Art. 5             any "yes" → PROHIBITED (stop)
     Gate 2  Art. 6(1)/Annex I   "yes" → HIGH-RISK (no derogation exists for Annex I)
             Art. 6(2)/Annex III "yes" → HIGH-RISK, unless the Art. 6(3) derogation is positively established:
               · never for credit scoring (Annex III 5(b)): evaluating a person's creditworthiness is profiling
               · never when profiling is "yes", "unsure" OR unanswered (Art. 6(3), third subparagraph)
               · only when profiling is an explicit "no" AND one of the conditions (a)–(d) is an explicit "yes"
             Annex III 5(b) fraud exception: only removes a system that does NOT score credit. Credit scoring that
             also serves fraud detection stays high-risk.
     Gate 3  Art. 50             any "yes" → TRANSPARENCY duties. Also listed on top of high-risk (Art. 50(6)).
     Else    MINIMAL             only when every relevant question has an answer.

   A gate with no "yes" and a blank answer is undecided: the tier is INCOMPLETE, never "minimal".
   "Unsure" never clears a gate silently: the item goes *to confirm* and the worst case is reported.
   Screening aid, not legal advice: verify with counsel. */
import { csv, csvObjects } from '../workshop-kit/jshared.js';

export const ANSWERS = ['yes', 'no', 'unsure'];
export const ROLES = ['provider', 'deployer', 'both'];
export const NIST = ['Govern', 'Map', 'Measure', 'Manage'];
export const STATUS = ['open', 'mitigating', 'accepted', 'closed'];
export const TIERS = ['incomplete', 'minimal', 'limited', 'high', 'prohibited'];

/** Legal basis and application dates (ISO). Source: Art. 113 and Art. 111 of Regulation (EU) 2024/1689 as amended. */
export const LEGAL = {
  act: 'Regulation (EU) 2024/1689', amendedBy: 'Regulation (EU) 2026/1744', amendedOj: '2026-07-24', amendedInForce: '2026-07-27', checked: '2026-11-16',
  dates: {
    prohibitions: { iso: '2025-02-02', ref: 'Art. 113(a)' },       // Chapters I and II (Art. 4, Art. 5)
    newProhibitions: { iso: '2026-12-02', ref: 'Art. 113(a)' },    // Art. 5(1)(ba), (bb), 5(1a), 5(1b)
    transparency: { iso: '2026-08-02', ref: 'Art. 113' },          // Art. 50, general date of application
    marking: { iso: '2026-12-02', ref: 'Art. 111(4)' },            // Art. 50(2), systems placed on the market before 2 Aug 2026
    annex3: { iso: '2027-12-02', ref: 'Art. 113(c)(i)' },          // Art. 6(2) + Annex III
    annex1: { iso: '2028-08-02', ref: 'Art. 113(c)(ii)' },         // Art. 6(1) + Annex I
  },
};

/** Wizard questions. `ref` is printed as is in both languages. `optional`: never blocks the result.
    `derogation`: shown only when the Art. 6(3) derogation can be examined. */
export const QUESTIONS = [
  { id: 'p1', step: 'prohibited', ref: 'Art. 5(1)(a)' },             // subliminal / manipulative / deceptive techniques, significant harm
  { id: 'p2', step: 'prohibited', ref: 'Art. 5(1)(b)' },             // exploits vulnerabilities (age, disability, social or economic situation)
  { id: 'p3', step: 'prohibited', ref: 'Art. 5(1)(c)' },             // social scoring with detrimental treatment
  { id: 'p4', step: 'prohibited', ref: 'Art. 5(1)(d)' },             // predicting criminal offences solely from profiling
  { id: 'p5', step: 'prohibited', ref: 'Art. 5(1)(e)–(h)' },         // facial scraping, emotion inference at work / school, sensitive biometric categorisation, real-time RBI (law enforcement)
  { id: 'p6', step: 'prohibited', ref: 'Art. 5(1)(ba)–(bb)' },       // non-consensual intimate material, child sexual abuse material (from 2 Dec 2026)
  { id: 'hA', step: 'high', ref: 'Art. 6(1), Annex I' },             // safety component of a regulated product with third-party conformity assessment
  { id: 'h1', step: 'high', ref: 'Annex III 5(b)' },                 // creditworthiness / credit score of natural persons
  { id: 'h2', step: 'high', ref: 'Annex III 5(b)', optional: true }, // used for the purpose of detecting financial fraud (exception)
  { id: 'h3', step: 'high', ref: 'Annex III 5(c)' },                 // life / health insurance risk assessment and pricing
  { id: 'h4', step: 'high', ref: 'Annex III 4' },                    // employment: recruitment, promotion, termination, task allocation, monitoring
  { id: 'h5', step: 'high', ref: 'Annex III 1, 5(a), 5(d)' },        // biometrics, essential public benefits, emergency triage
  { id: 'h8', step: 'high', ref: 'Annex III 2, 3, 6, 7, 8' },        // critical infrastructure, education, law enforcement, migration, justice
  { id: 'h7', step: 'high', ref: 'Art. 6(3)', derogation: true },    // profiling of natural persons (derogation never applies)
  { id: 'h6', step: 'high', ref: 'Art. 6(3)(a)–(d)', derogation: true }, // one of the four conditions, no material influence
  { id: 't1', step: 'transparency', ref: 'Art. 50(1)' },             // interacts directly with natural persons
  { id: 't2', step: 'transparency', ref: 'Art. 50(2)' },             // generates synthetic audio, image, video or text
  { id: 't3', step: 'transparency', ref: 'Art. 50(3)' },             // emotion recognition / biometric categorisation (deployer duty)
  { id: 't4', step: 'transparency', ref: 'Art. 50(4)' },             // deep fakes / text published to inform the public
];
export const STEPS = ['prohibited', 'high', 'transparency'];
const PRO = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
const ANNEX3 = ['h1', 'h3', 'h4', 'h5', 'h8'];
const DEROGABLE = ['h3', 'h4', 'h5', 'h8'];   // Annex III hits for which Art. 6(3) can be examined (never h1)
const TR = ['t1', 't2', 't3', 't4'];
const A = (ans, id) => { const v = (ans || {})[id]; return ANSWERS.includes(v) ? v : ''; };
const REF = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.ref]));
const rank = (t) => TIERS.indexOf(t);

/** Can the Art. 6(3) derogation be examined at all? Only for an Annex III hit other than credit scoring, without an Annex I hit. */
export function derogationOpen(ans) {
  return A(ans, 'hA') !== 'yes' && A(ans, 'h1') !== 'yes' && DEROGABLE.some((id) => A(ans, id) === 'yes');
}
/** Ids of the questions to show now (h7 / h6 appear only when the derogation can be examined). */
export function visibleQuestions(ans) {
  const der = derogationOpen(ans);
  return QUESTIONS.filter((q) => !q.derogation || der).map((q) => q.id);
}

/** → { tier: 'prohibited'|'high'|'limited'|'minimal'|'incomplete', status: 'final'|'provisional'|'incomplete',
        atLeast, worstCase, reasons: [{id, ref, key}], confirm: [{id, ref, why}], open: [ids], path: [{gate, outcome, refs}],
        transparency: [ids], annex1, annex3: [ids], carveOut, derogation: bool, derogationState, fria: bool } */
export function classify(ans) {
  const yes = (id) => A(ans, id) === 'yes', no = (id) => A(ans, id) === 'no', uns = (id) => A(ans, id) === 'unsure', blank = (id) => !A(ans, id);
  const reasons = [], confirm = [], path = [];
  const why = (id, key) => confirm.push({ id, ref: REF[id], why: key || 'c_' + id });
  const because = (id, key) => reasons.push({ id, ref: REF[id], key: key || 'r_' + id });
  const refs = (ids) => [...new Set(ids.map((id) => REF[id]))];

  // ---- Gate 1 · Art. 5 prohibited practices
  const proHits = PRO.filter(yes), proUns = PRO.filter(uns), proOpen = PRO.filter(blank);
  proUns.forEach((id) => why(id));
  if (proHits.length) {
    proHits.forEach((id) => because(id));
    path.push({ gate: 'art5', outcome: 'hit', refs: refs(proHits) }, { gate: 'result', outcome: 'prohibited', refs: [] });
    return { tier: 'prohibited', status: confirm.length ? 'provisional' : 'final', atLeast: null, worstCase: null, reasons, confirm, open: [], path,
      transparency: [], annex1: false, annex3: [], carveOut: false, derogation: false, derogationState: 'na', fria: false,
      newProhibition: proHits.includes('p6'), oldProhibition: proHits.some((id) => id !== 'p6') };
  }
  path.push({ gate: 'art5', outcome: proOpen.length ? 'open' : proUns.length ? 'confirm' : 'clear', refs: refs(proOpen.length ? proOpen : proUns) });

  // ---- Gate 2 · high-risk: Art. 6(1) + Annex I, Art. 6(2) + Annex III, Art. 6(3) derogation
  const annex1 = yes('hA');
  const a3 = ANNEX3.filter(yes), a3Uns = ANNEX3.filter(uns);
  const highOpen = ['hA', ...ANNEX3].filter(blank);
  if (uns('hA')) why('hA');
  for (const id of a3Uns) why(id, id === 'h1' && yes('h2') ? 'c_h1_fraud' : undefined);
  // Annex III 5(b) fraud exception: it exists only for a system that does not evaluate creditworthiness.
  const carveOut = no('h1') && yes('h2');
  if (annex1) because('hA');
  for (const id of a3) because(id);
  if (yes('h1') && yes('h2')) reasons.push({ id: 'h2', ref: REF.h2, key: 'r_h1_fraud' });
  if (carveOut) reasons.push({ id: 'h2', ref: REF.h2, key: 'r_carve' });
  if (no('h1') && uns('h2')) why('h2');

  const derOpen = [];
  let derogationState = 'na';
  if (a3.length && !annex1) {
    if (yes('h1')) derogationState = 'excluded_credit';
    else if (yes('h7')) derogationState = 'denied_profiling';
    else if (blank('h7')) { derogationState = 'not_assessed'; derOpen.push('h7'); }
    else if (uns('h7')) { derogationState = 'unclear_profiling'; why('h7'); }
    else if (yes('h6')) derogationState = 'granted';                          // profiling is an explicit "no" here
    else if (no('h6')) derogationState = 'denied_conditions';
    else if (uns('h6')) { derogationState = 'unclear_conditions'; why('h6'); }
    else { derogationState = 'not_assessed'; derOpen.push('h6'); }
  }
  const derogation = derogationState === 'granted';
  const isHigh = annex1 || (a3.length > 0 && !derogation);
  if (annex1) path.push({ gate: 'annex1', outcome: 'hit', refs: [REF.hA] });
  if (a3.length) path.push({ gate: 'annex3', outcome: 'hit', refs: refs(a3) });
  if (!annex1 && !a3.length) {
    const u = [...(uns('hA') ? ['hA'] : []), ...a3Uns];
    path.push({ gate: 'annex3', outcome: highOpen.length ? 'open' : u.length ? 'confirm' : 'clear', refs: refs(highOpen.length ? highOpen : u) });
  }
  if (carveOut) path.push({ gate: 'fraud', outcome: 'exception', refs: [REF.h2] });
  if (yes('h1') && yes('h2')) path.push({ gate: 'fraud', outcome: 'no_exception', refs: [REF.h2] });
  if (derogationState !== 'na') {
    path.push({ gate: 'art63', outcome: derogationState, refs: [derogation ? REF.h6 : REF.h7] });
    because(derogation ? 'h6' : 'h7', 'r_der_' + derogationState);
  }
  const g2Open = !isHigh && highOpen.length > 0;

  // ---- Gate 3 · Art. 50 transparency (cumulative with high-risk, Art. 50(6))
  const trHits = TR.filter(yes), trUns = TR.filter(uns), trOpen = TR.filter(blank);
  trUns.forEach((id) => why(id));
  trHits.forEach((id) => because(id));
  path.push({ gate: 'art50', outcome: trHits.length ? 'hit' : trOpen.length ? 'open' : trUns.length ? 'confirm' : 'clear', refs: refs(trHits.length ? trHits : trOpen.length ? trOpen : trUns) });

  // ---- Decision: the first decisive gate wins; an undecided gate above it makes the result incomplete.
  let tier, atLeast = null;
  if (proOpen.length) { tier = 'incomplete'; atLeast = isHigh ? 'high' : trHits.length ? 'limited' : null; }
  else if (isHigh) tier = 'high';
  else if (g2Open) { tier = 'incomplete'; atLeast = trHits.length ? 'limited' : null; }
  else if (trHits.length) tier = 'limited';
  else if (trOpen.length) tier = 'incomplete';
  else tier = 'minimal';
  path.push({ gate: 'result', outcome: tier, refs: [] });

  const open = [...proOpen, ...highOpen, ...derOpen, ...trOpen];
  let worstCase = null;
  if (proUns.length) worstCase = 'prohibited';
  else if (!isHigh && (a3Uns.length || uns('hA'))) worstCase = 'high';
  else if (!isHigh && !trHits.length && trUns.length) worstCase = 'limited';
  if (worstCase && tier !== 'incomplete' && rank(worstCase) <= rank(tier)) worstCase = null;
  const status = tier === 'incomplete' ? 'incomplete' : (confirm.length || open.length) ? 'provisional' : 'final';
  return { tier, status, atLeast, worstCase, reasons, confirm, open, path, transparency: trHits, annex1, annex3: isHigh ? a3 : [], carveOut, derogation, derogationState,
    fria: isHigh && (yes('h1') || yes('h3')), newProhibition: false, oldProhibition: false };
}

/** Obligations for the result, filtered by role ('provider' | 'deployer' | 'both' | ''; blank = show all).
    → [{id, ref, who: 'provider'|'deployer'|'all', date}] where date is a key of LEGAL.dates (or null). */
export function obligations(c, role) {
  const out = [];
  const mine = (who) => who === 'all' || !ROLES.includes(role) || role === 'both' || role === who;
  const add = (id, ref, who, date = null) => { if (mine(who)) out.push({ id, ref, who, date }); };
  const eff = c.tier === 'incomplete' ? c.atLeast : c.tier;
  if (c.tier === 'prohibited') { add('stop', 'Art. 5, Art. 99(3)', 'all', c.oldProhibition ? 'prohibitions' : 'newProhibitions'); return out; }
  if (eff === 'high') {
    const d = c.annex3.length ? 'annex3' : 'annex1';
    add('p_req', 'Art. 9–15', 'provider', d);
    add('p_qms', 'Art. 16–17', 'provider', d);
    add('p_conf', 'Art. 43, 47–49', 'provider', d);
    add('p_pms', 'Art. 72–73', 'provider', d);
    add('d_use', 'Art. 26(1)–(6)', 'deployer', d);
    add('d_inform', 'Art. 26(7), 26(11), Art. 86', 'deployer', d);
    if (c.fria) add('d_fria', 'Art. 27', 'deployer', d);
  }
  if (c.derogation) add('p_derog', 'Art. 6(4), Art. 49(2)', 'provider', 'annex3');
  if (c.transparency.includes('t1')) add('t1', 'Art. 50(1), 50(5)', 'provider', 'transparency');
  if (c.transparency.includes('t2')) add('t2', 'Art. 50(2), Art. 111(4)', 'provider', 'marking');
  if (c.transparency.includes('t3')) add('t3', 'Art. 50(3)', 'deployer', 'transparency');
  if (c.transparency.includes('t4')) add('t4', 'Art. 50(4)', 'deployer', 'transparency');
  if (c.carveOut) add('carve', 'Annex III 5(b)', 'all');
  if (eff) { add('literacy', 'Art. 4', 'all', 'prohibitions'); add('other', 'GDPR, DORA', 'all'); }
  return out;
}

/** Application dates that matter for the result → [{key, iso, ref, applies}] (applies = already applicable on `today`). */
export function keyDates(c, today = new Date().toISOString().slice(0, 10)) {
  const keys = [];
  const eff = c.tier === 'incomplete' ? c.atLeast : c.tier;
  if (c.tier === 'prohibited') { if (c.oldProhibition) keys.push('prohibitions'); if (c.newProhibition) keys.push('newProhibitions'); }
  if (eff === 'high') { if (c.annex3.length) keys.push('annex3'); if (c.annex1) keys.push('annex1'); }
  if (c.derogation && !keys.includes('annex3')) keys.push('annex3');
  if (c.transparency.length) keys.push('transparency');
  if (c.transparency.includes('t2')) keys.push('marking');
  return keys.map((key) => ({ key, ...LEGAL.dates[key], applies: LEGAL.dates[key].iso <= today }));
}

export const score = (r) => (+r.likelihood || 0) * (+r.impact || 0);
export const level = (s) => (s >= 15 ? 'high' : s >= 8 ? 'medium' : 'low');

/** Register checks (skill §7): every high risk has a control and a test; every risk has an owner. */
export function registerChecks(risks) {
  const out = [];
  const rs = risks || [];
  const highNoCtl = rs.filter((r) => level(score(r)) === 'high' && !String(r.control || '').trim());
  const highNoTest = rs.filter((r) => level(score(r)) === 'high' && !String(r.test || '').trim());
  const noOwner = rs.filter((r) => !String(r.owner || '').trim());
  const nist = NIST.filter((f) => !rs.some((r) => r.nist === f));
  if (highNoCtl.length) out.push({ level: 'bad', key: 'chkHighCtl', ids: highNoCtl.map((r) => r.id) });
  if (highNoTest.length) out.push({ level: 'warn', key: 'chkHighTest', ids: highNoTest.map((r) => r.id) });
  if (noOwner.length) out.push({ level: 'warn', key: 'chkOwner', ids: noOwner.map((r) => r.id) });
  if (rs.length && nist.length) out.push({ level: 'warn', key: 'chkNist', ids: nist });
  if (rs.length && !out.length) out.push({ level: 'ok', key: 'chkAllOk', ids: [] });
  return out;
}
/** 5×5 heat grid: cells[impact-1][likelihood-1] = [ids]. */
export function heat(risks) {
  const cells = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => []));
  for (const r of risks || []) {
    const l = +r.likelihood, i = +r.impact;
    if (l >= 1 && l <= 5 && i >= 1 && i <= 5) cells[i - 1][l - 1].push(r.id);
  }
  return cells;
}
export const nextRid = (risks) => {
  let m = 0; for (const r of risks || []) { const k = String(r.id).match(/^R-(\d+)$/); if (k) m = Math.max(m, +k[1]); }
  return 'R-' + String(m + 1).padStart(2, '0');
};
/** Add rows without duplicating a risk that is already in the register (same text). → {risks, added} */
export function addUnique(risks, rows) {
  const out = [...(risks || [])];
  const norm = (s) => String(s || '').trim().toLowerCase();
  let added = 0;
  for (const r of rows || []) {
    if (out.some((x) => norm(x.risk) === norm(r.risk))) continue;
    out.push({ ...r, id: nextRid(out) }); added++;
  }
  return { risks: out, added };
}

export function registerCsv(risks) {
  return csv([['id', 'risk', 'category', 'likelihood', 'impact', 'score', 'level', 'owner', 'control', 'test', 'nist', 'status'],
    ...(risks || []).map((r) => [r.id, r.risk, r.category, r.likelihood, r.impact, score(r), level(score(r)), r.owner, r.control, r.test, r.nist, r.status])]);
}
/** risk,category,likelihood,impact,owner,control,test,nist,status → risks (for AI answers pasted back). */
export function risksFromCsv(text, existing = []) {
  const out = [...existing];
  for (const o of csvObjects(text)) {
    if (!o.risk) continue;
    const nist = NIST.find((n) => n.toLowerCase() === String(o.nist || '').toLowerCase()) || 'Manage';
    const status = STATUS.includes(String(o.status || '').toLowerCase()) ? o.status.toLowerCase() : 'open';
    out.push({ id: nextRid(out), risk: o.risk, category: o.category || '', likelihood: Math.min(5, Math.max(1, +o.likelihood || 3)), impact: Math.min(5, Math.max(1, +o.impact || 3)), owner: o.owner || '', control: o.control || '', test: o.test || '', nist, status });
  }
  return out;
}

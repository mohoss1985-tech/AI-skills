/* AI risk register: pure logic (skill governing-ai-risk). No DOM. Tested by logic.test.mjs.
   EU AI Act (Regulation (EU) 2024/1689) tier wizard: Art. 5 prohibited practices → Annex III high-risk (with the
   Art. 6(3) derogation and the fraud-detection carve-out of Annex III point 5(b)) → Art. 50 transparency → minimal.
   Every answer is yes / no / unsure; "unsure" never decides a tier on its own, it puts the item *to confirm*.
   This is a screening aid for the Product Owner, not legal advice: the result is always to confirm with Legal. */
import { csv, csvObjects } from '../workshop-kit/jshared.js';

export const ANSWERS = ['yes', 'no', 'unsure'];
export const NIST = ['Govern', 'Map', 'Measure', 'Manage'];
export const STATUS = ['open', 'mitigating', 'accepted', 'closed'];

/** Wizard questions. `ref` is printed as is in both languages. */
export const QUESTIONS = [
  { id: 'p1', step: 'prohibited', ref: 'Art. 5(1)(a)' },   // subliminal / manipulative techniques causing significant harm
  { id: 'p2', step: 'prohibited', ref: 'Art. 5(1)(b)' },   // exploits vulnerabilities (age, disability, social or economic situation)
  { id: 'p3', step: 'prohibited', ref: 'Art. 5(1)(c)' },   // social scoring with detrimental treatment
  { id: 'p4', step: 'prohibited', ref: 'Art. 5(1)(d)' },   // predicting criminal offences solely from profiling
  { id: 'p5', step: 'prohibited', ref: 'Art. 5(1)(e)–(h)' }, // facial scraping, emotion recognition at work/school, sensitive biometric categorisation, real-time RBI
  { id: 'h1', step: 'high', ref: 'Annex III 5(b)' },       // creditworthiness / credit score of natural persons
  { id: 'h2', step: 'high', ref: 'Annex III 5(b)' },       // purpose = detecting financial fraud (carve-out)
  { id: 'h3', step: 'high', ref: 'Annex III 5(c)' },       // life / health insurance risk and pricing
  { id: 'h4', step: 'high', ref: 'Annex III 4' },          // employment: recruitment, promotion, termination, monitoring
  { id: 'h5', step: 'high', ref: 'Annex III 1, 5(a), 5(d)' }, // biometrics, essential public services, emergency triage
  { id: 'h6', step: 'high', ref: 'Art. 6(3)' },            // narrow procedural / preparatory task, no material influence
  { id: 'h7', step: 'high', ref: 'Art. 6(3)' },            // profiling of natural persons (derogation never applies)
  { id: 't1', step: 'transparency', ref: 'Art. 50(1)' },   // interacts directly with natural persons
  { id: 't2', step: 'transparency', ref: 'Art. 50(2)' },   // generates synthetic audio, image, video or text
  { id: 't3', step: 'transparency', ref: 'Art. 50(3)' },   // emotion recognition / biometric categorisation (deployer duty)
  { id: 't4', step: 'transparency', ref: 'Art. 50(4)' },   // deep fakes / text published to inform the public
];
export const STEPS = ['prohibited', 'high', 'transparency'];
const A = (ans, id) => (ans || {})[id] || '';

/** → {tier: 'prohibited'|'high'|'limited'|'minimal', confirm: [{id, ref, why}], reasons: [{id, ref, key}], carveOut, derogation, open} */
export function classify(ans) {
  const reasons = [], confirm = [];
  let carveOut = false, derogation = false;
  const yes = (id) => A(ans, id) === 'yes', uns = (id) => A(ans, id) === 'unsure';
  const ref = (id) => QUESTIONS.find((q) => q.id === id).ref;
  // Art. 5
  const pro = ['p1', 'p2', 'p3', 'p4', 'p5'];
  for (const id of pro) { if (yes(id)) reasons.push({ id, ref: ref(id), key: 'r_' + id }); if (uns(id)) confirm.push({ id, ref: ref(id), why: 'c_' + id }); }
  if (reasons.length) return finish('prohibited');
  // Annex III
  const highHits = [];
  if (yes('h1')) {
    if (yes('h2')) carveOut = true;
    else { highHits.push('h1'); if (uns('h2')) confirm.push({ id: 'h2', ref: ref('h2'), why: 'c_h2' }); }
  } else if (uns('h1')) confirm.push({ id: 'h1', ref: ref('h1'), why: yes('h2') ? 'c_h1_fraud' : 'c_h1' });
  for (const id of ['h3', 'h4', 'h5']) { if (yes(id)) highHits.push(id); if (uns(id)) confirm.push({ id, ref: ref(id), why: 'c_' + id }); }
  if (highHits.length) {
    if (yes('h6') && !yes('h7')) {
      derogation = true;
      if (uns('h7')) confirm.push({ id: 'h7', ref: ref('h7'), why: 'c_h7' });
    } else if (uns('h6')) confirm.push({ id: 'h6', ref: ref('h6'), why: 'c_h6' });
  }
  if (carveOut) reasons.push({ id: 'h2', ref: ref('h2'), key: 'r_carve' });
  if (highHits.length && !derogation) { for (const id of highHits) reasons.push({ id, ref: ref(id), key: 'r_' + id }); return finish('high'); }
  if (derogation) reasons.push({ id: 'h6', ref: ref('h6'), key: 'r_derogation' });
  // Art. 50
  const tr = ['t1', 't2', 't3', 't4'];
  let lim = false;
  for (const id of tr) { if (yes(id)) { lim = true; reasons.push({ id, ref: ref(id), key: 'r_' + id }); } if (uns(id)) confirm.push({ id, ref: ref(id), why: 'c_' + id }); }
  return finish(lim ? 'limited' : 'minimal');

  function finish(tier) {
    const open = QUESTIONS.filter((q) => !A(ans, q.id)).map((q) => q.id);
    return { tier, reasons, confirm, carveOut, derogation, open };
  }
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

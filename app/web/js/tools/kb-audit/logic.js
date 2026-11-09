/* KB audit logic (skill curating-knowledge-bases). Pure, node-testable: `node logic.test.mjs`.
   state: articles text "id, title, owner, last review YYYY-MM-DD, type, audience" per line
          owners   text "name, team, status (active | left)"
          questions text "question, monthly volume, article ids (space or | separated), full answer Y | P | N"
          asOf (YYYY-MM-DD), cycles {faq, procedure, tariff, policy, script} in days, dueWindow (days),
          writers, perWriter (articles a week each). */
import { parseList, toCsv } from '../mapping-grid/csv.js';

export const TYPES = ['faq', 'procedure', 'tariff', 'policy', 'script'];
export const DEFAULT_CYCLES = { faq: 180, procedure: 90, tariff: 30, policy: 365, script: 90 };
const TYPE_ALIAS = { faq: 'faq', procedure: 'procedure', 'procédure': 'procedure', process: 'procedure', tariff: 'tariff', tarif: 'tariff', fees: 'tariff',
  policy: 'policy', politique: 'policy', script: 'script' };
const AUD_ALIAS = { customer: 'customer', customers: 'customer', client: 'customer', clients: 'customer', advisor: 'advisor', advisors: 'advisor', conseiller: 'advisor', conseillers: 'advisor', internal: 'internal', interne: 'internal' };
const EFFORT = { write: 1, partial: 0.5, review: 0.5, dedupe: 0.5, internal: 1, owner: 0 };

const dayMs = 86400000;
const toDay = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; };

export function parseArticles(text) {
  return parseList(text, ['id']).map((r) => ({
    id: r[0] || '', title: r[1] || '', owner: r[2] || '', last: r[3] || '',
    type: TYPE_ALIAS[(r[4] || '').toLowerCase()] || 'faq', audience: AUD_ALIAS[(r[5] || '').toLowerCase()] || 'customer',
  })).filter((a) => a.id);
}
export function parseOwners(text) {
  return parseList(text, ['name', 'nom', 'owner']).map((r) => ({ name: r[0] || '', team: r[1] || '', left: /^(left|parti|partie|gone|inactive|inactif)$/i.test(r[2] || '') })).filter((o) => o.name);
}
export function parseQuestions(text) {
  return parseList(text, ['question']).map((r, i) => ({
    id: 'Q' + (i + 1), text: r[0] || '', volume: Math.max(0, parseInt(String(r[1] || '').replace(/[\s ,.]/g, ''), 10) || 0),
    refs: String(r[2] || '').split(/[\s|;]+/).map((x) => x.trim()).filter(Boolean),
    answer: ({ Y: 'full', YES: 'full', O: 'full', OUI: 'full', P: 'partial', PARTIAL: 'partial', PARTIEL: 'partial', N: 'no', NO: 'no', NON: 'no' })[(r[3] || 'Y').toUpperCase()] || 'full',
  })).filter((q) => q.text);
}

export function audit(state) {
  const asOf = toDay(state.asOf) ?? toDay(new Date().toISOString());
  const cycles = { ...DEFAULT_CYCLES, ...(state.cycles || {}) };
  const due = +state.dueWindow >= 0 && state.dueWindow !== '' && state.dueWindow != null ? +state.dueWindow : 30;
  const owners = parseOwners(state.owners);
  const oIdx = Object.fromEntries(owners.map((o) => [o.name.toLowerCase(), o]));
  const questions = parseQuestions(state.questions);
  const articles = parseArticles(state.articles).map((a) => {
    const d = toDay(a.last);
    const age = d == null ? null : Math.max(0, Math.round((asOf - d) / dayMs));
    const cycle = +cycles[a.type] || DEFAULT_CYCLES.faq;
    const bucket = age == null ? 'never' : age > cycle ? 'stale' : age > cycle - due ? 'due' : 'fresh';
    const o = a.owner ? oIdx[a.owner.toLowerCase()] : null;
    const ownerStatus = !a.owner ? 'none' : !o ? 'unknown' : o.left ? 'left' : 'ok';
    return { ...a, age, cycle, bucket, ownerStatus, questions: [], volume: 0, daysLeft: age == null ? null : cycle - age };
  });
  const aIdx = Object.fromEntries(articles.map((a) => [a.id.toUpperCase(), a]));
  for (const q of questions) {
    q.articles = q.refs.map((r) => aIdx[r.toUpperCase()]).filter(Boolean);
    q.unknown = q.refs.filter((r) => !aIdx[r.toUpperCase()]);
    for (const a of q.articles) { a.questions.push(q.id); a.volume += q.volume; }
    const usable = q.articles.filter((a) => a.audience !== 'internal');
    const fresh = usable.filter((a) => a.bucket === 'fresh' || a.bucket === 'due');
    q.dup = usable.length >= 2;
    q.coverage = !q.articles.length ? 'gap' : !usable.length ? 'internal' : !fresh.length ? 'stale' : q.answer !== 'full' ? 'partial' : 'ok';
  }
  // owners view
  const ownerRows = owners.map((o) => {
    const mine = articles.filter((a) => a.owner.toLowerCase() === o.name.toLowerCase());
    return { ...o, n: mine.length, stale: mine.filter((a) => a.bucket === 'stale' || a.bucket === 'never').length, volume: mine.reduce((s, a) => s + a.volume, 0) };
  });
  // actions, highest volume first
  const actions = [];
  const act = (type, ref, vars, volume, owner = '') => actions.push({ type, ref, vars, volume, owner, effort: EFFORT[type] });
  for (const q of questions) {
    if (q.coverage === 'gap') act('write', q.id, { q: q.text }, q.volume);
    else if (q.coverage === 'internal') act('internal', q.id, { q: q.text, ids: q.articles.map((a) => a.id).join(', ') }, q.volume);
    else if (q.coverage === 'partial') act('partial', q.id, { q: q.text, ids: q.articles.filter((a) => a.audience !== 'internal').map((a) => a.id).join(', ') }, q.volume, q.articles[0].owner);
    if (q.dup) act('dedupe', q.id, { q: q.text, ids: q.articles.filter((a) => a.audience !== 'internal').map((a) => a.id).join(' + ') }, q.volume, q.articles[0].owner);
  }
  for (const a of articles) {
    if (a.bucket === 'stale' || a.bucket === 'never') act('review', a.id, { id: a.id, t: a.title, age: a.age ?? '—' }, a.volume, a.ownerStatus === 'ok' ? a.owner : '');
    if (a.ownerStatus !== 'ok') act('owner', a.id, { id: a.id, t: a.title, who: a.owner }, a.volume);
  }
  const order = { write: 0, internal: 1, partial: 2, review: 3, dedupe: 4, owner: 5 };
  actions.sort((x, y) => y.volume - x.volume || order[x.type] - order[y.type]);
  const perWeek = Math.max(0, (+state.writers || 0) * (+state.perWriter || 0));
  let used = 0;
  for (const a of actions) {
    if (!a.effort) { a.week = 0; continue; }
    a.week = perWeek ? Math.floor(used / perWeek) + 1 : null;
    used += a.effort;
  }
  actions.forEach((a, i) => { a.n = i + 1; });
  const totalVol = questions.reduce((s, q) => s + q.volume, 0);
  const vol = (c) => questions.filter((q) => c.includes(q.coverage)).reduce((s, q) => s + q.volume, 0);
  const fresh = Object.fromEntries(['fresh', 'due', 'stale', 'never'].map((b) => [b, articles.filter((a) => a.bucket === b).length]));
  const summary = {
    articles: articles.length, questions: questions.length, fresh,
    owned: articles.filter((a) => a.ownerStatus === 'ok').length,
    gaps: questions.filter((q) => q.coverage === 'gap').length,
    coveredPct: totalVol ? Math.round((100 * vol(['ok'])) / totalVol) : 0,
    gapVolume: vol(['gap']), totalVol, weeks: perWeek ? Math.ceil(used / perWeek) : null, effort: used, perWeek,
  };
  return { articles, questions, owners: ownerRows, actions, summary, cycles, asOf: new Date(asOf).toISOString().slice(0, 10) };
}

export function actionsCsv(r, label = (a) => a.type) {
  return toCsv([['n', 'action', 'ref', 'detail', 'monthly_volume', 'effort_articles', 'week', 'owner'],
    ...r.actions.map((a) => [a.n, a.type, a.ref, label(a), a.volume, a.effort, a.week ?? '', a.owner])]);
}
export function auditCsv(r) {
  return toCsv([['id', 'title', 'owner', 'owner_status', 'type', 'audience', 'last_review', 'age_days', 'cycle_days', 'freshness', 'questions', 'monthly_volume'],
    ...r.articles.map((a) => [a.id, a.title, a.owner, a.ownerStatus, a.type, a.audience, a.last, a.age ?? '', a.cycle, a.bucket, a.questions.join(' '), a.volume])]);
}
export function coverageCsv(r) {
  return toCsv([['id', 'question', 'monthly_volume', 'articles', 'answer', 'coverage'],
    ...r.questions.map((q) => [q.id, q.text, q.volume, q.refs.join(' '), q.answer, q.coverage])]);
}

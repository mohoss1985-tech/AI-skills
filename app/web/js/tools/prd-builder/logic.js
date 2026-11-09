/* PRD builder · pure logic (no DOM). Node-testable: `node --input-type=module -e "import('./logic.js')"`.
   Method from skills/writing-prds: problem before solution, every requirement traces to a goal, every goal has a
   metric, metrics have a baseline, at least one guardrail, explicit non-goals, testable requirements, owned questions. */

export const PRIORITIES = ['Must', 'Should', 'Could', "Won't"];
export const METRIC_TYPES = ['primary', 'guardrail', 'secondary'];
export const RISK_TYPES = ['risk', 'assumption', 'issue', 'dependency'];

/** Words that make a requirement untestable (EN + FR). */
export const VAGUE = ['fast', 'quick', 'easy', 'easily', 'intuitive', 'user-friendly', 'simple', 'seamless', 'robust',
  'flexible', 'efficient', 'as soon as possible', 'asap', 'etc', 'rapide', 'rapidement', 'facile', 'facilement',
  'intuitif', 'intuitive', 'convivial', 'fluide', 'performant', 'efficace', 'dès que possible'];

/** "G1, G2" / ["G1"] / "g1 g2" → ['G1', 'G2'] (upper-cased, deduplicated). */
export function parseIds(v) {
  const list = Array.isArray(v) ? v : String(v ?? '').split(/[\s,;]+/);
  return [...new Set(list.map((s) => String(s).trim().toUpperCase()).filter(Boolean))];
}

/** Find vague words in a text; returns the words found (lower case). */
export function vagueWords(text) {
  const s = ' ' + String(text || '').toLowerCase().replace(/[.,;:!?()«»"']/g, ' ') + ' ';
  return VAGUE.filter((w) => s.includes(' ' + w + ' '));
}

/** Next free id with a prefix: nextId(['G1','G3'], 'G') → 'G4'; nextId(['FR-2'], 'FR-') → 'FR-3'. */
export function nextId(ids, prefix) {
  let n = 0;
  for (const id of ids) {
    const m = String(id).match(/(\d+)\s*$/);
    if (m && String(id).toUpperCase().startsWith(prefix.toUpperCase())) n = Math.max(n, +m[1]);
  }
  return prefix + (n + 1);
}

/** Id prefixes per language (EN: G / M / FR-, FR: O / I / EX-, as in the V1 seeds). */
export const PREFIX = { en: { goal: 'G', metric: 'M', req: 'FR-' }, fr: { goal: 'O', metric: 'I', req: 'EX-' } };

export function emptyState(lang = 'en') {
  return {
    lang, problem: '', users: '', goalMetric: '', scope: '',
    title: '', owner: '', status: 'draft', format: 'one-pager', deadline: '',
    tldr: '', evidence: '',
    goals: [], nonGoals: [], metrics: [], personas: [], reqs: [], risks: [], questions: [],
    built: false,
  };
}

const lines = (s) => String(s || '').split(/\r?\n|;(?=\s)/).map((l) => l.replace(/^\s*[-*•\d.)]+\s*/, '').trim()).filter(Boolean);

/** Parse "Share of blocks in the app: 38% → 70%" into {name, baseline, target}. */
export function parseMetric(text) {
  const s = String(text || '').trim();
  const m = s.match(/^(.*?)(?:[:=]\s*|\s+from\s+|\s+de\s+)([^→>]+?)\s*(?:→|->|>|\bto\b|\bà\b)\s*(.+)$/i);
  if (m) return { name: m[1].trim(), baseline: m[2].trim(), target: m[3].trim() };
  return { name: s, baseline: '', target: '' };
}

/** Build the skeleton from the four command-bar inputs. Existing section content is kept (only empty lists fill). */
export function buildDraft(state) {
  const s = structuredClone(state);
  const P = PREFIX[s.lang] || PREFIX.en;
  const goalLines = lines(s.goalMetric);
  if (!s.personas.length) s.personas = lines(String(s.users || '').replace(/,\s*/g, '\n')).map((name) => ({ name, job: '' }));
  if (!s.goals.length && goalLines.length) {
    s.goals = goalLines.map((g, i) => ({ id: P.goal + (i + 1), text: parseMetric(g).name }));
  }
  if (!s.metrics.length && goalLines.length) {
    s.metrics = goalLines.map((g, i) => {
      const m = parseMetric(g);
      return { id: P.metric + (i + 1), name: m.name, type: i === 0 ? 'primary' : 'secondary', baseline: m.baseline, target: m.target, how: '', goal: P.goal + (i + 1) };
    });
  }
  if (!s.reqs.length) {
    const g1 = s.goals[0] ? s.goals[0].id : '';
    s.reqs = lines(s.scope).map((text, i) => ({ id: P.req + (i + 1), text, priority: 'Must', goal: g1, notes: '' }));
  }
  s.built = true;
  return s;
}

/** Trace matrix: one row per goal, with the requirements and metrics that point at it. */
export function traceMatrix(state) {
  const goalIds = new Set(state.goals.map((g) => g.id.toUpperCase()));
  const rows = state.goals.map((g) => {
    const id = g.id.toUpperCase();
    return {
      goal: g,
      reqs: state.reqs.filter((r) => parseIds(r.goal).includes(id)).map((r) => r.id),
      metrics: state.metrics.filter((m) => parseIds(m.goal).includes(id)).map((m) => m.id),
    };
  });
  const orphanReqs = state.reqs.filter((r) => !parseIds(r.goal).some((x) => goalIds.has(x)));
  const orphanMetrics = state.metrics.filter((m) => !parseIds(m.goal).some((x) => goalIds.has(x)));
  const unknownRefs = [];
  for (const r of [...state.reqs, ...state.metrics]) for (const x of parseIds(r.goal)) if (!goalIds.has(x)) unknownRefs.push({ id: r.id, ref: x });
  return { rows, orphanReqs, orphanMetrics, unknownRefs };
}

/**
 * Live checks behind the trace meter. Each check: {id, ok, level: 'block'|'warn', key, vars, section, fix}.
 * key/vars are i18n keys so the UI and the Markdown stay bilingual. `trace` checks drive the meter.
 */
export function check(state) {
  const out = [];
  const add = (id, ok, level, key, vars = {}, section = '', trace = false) => out.push({ id, ok, level, key, vars, section, trace });
  const tm = traceMatrix(state);

  add('problem', String(state.problem || '').trim().length >= 20, 'block', 'chk.problem', {}, 'problem');
  add('evidence', /\d/.test(String(state.problem || '') + ' ' + String(state.evidence || '')), 'warn', 'chk.evidence', {}, 'problem');
  add('users', state.personas.length > 0, 'block', 'chk.users', {}, 'users');
  add('goals', state.goals.length > 0, 'block', 'chk.goals', {}, 'goals', true);
  for (const r of tm.rows) {
    add('g-req-' + r.goal.id, r.reqs.length > 0, 'block', 'chk.goalNoReq', { id: r.goal.id }, 'goals', true);
    add('g-met-' + r.goal.id, r.metrics.length > 0, 'block', 'chk.goalNoMetric', { id: r.goal.id }, 'metrics', true);
  }
  for (const r of tm.orphanReqs) add('orph-' + r.id, false, 'block', 'chk.orphanReq', { id: r.id }, 'reqs', true);
  if (!tm.orphanReqs.length && state.reqs.length) add('orph', true, 'block', 'chk.noOrphans', { n: state.reqs.length }, 'reqs', true);
  for (const m of tm.orphanMetrics) add('orphm-' + m.id, false, 'warn', 'chk.orphanMetric', { id: m.id }, 'metrics', true);
  add('reqs', state.reqs.length > 0, 'block', 'chk.reqs', {}, 'reqs', true);
  add('guardrail', state.metrics.some((m) => m.type === 'guardrail'), 'warn', 'chk.guardrail', {}, 'metrics');
  const noBase = state.metrics.filter((m) => !String(m.baseline || '').trim());
  add('baseline', !noBase.length, 'warn', 'chk.baseline', { ids: noBase.map((m) => m.id).join(', ') }, 'metrics');
  const noTarget = state.metrics.filter((m) => !String(m.target || '').trim());
  add('target', !noTarget.length, 'block', 'chk.target', { ids: noTarget.map((m) => m.id).join(', ') }, 'metrics');
  const vague = state.reqs.map((r) => ({ id: r.id, w: vagueWords(r.text) })).filter((x) => x.w.length);
  add('testable', !vague.length, 'warn', 'chk.testable', { list: vague.map((x) => `${x.id} "${x.w.join('", "')}"`).join('; ') }, 'reqs');
  add('nongoals', state.nonGoals.filter((x) => String(x).trim()).length > 0, 'warn', 'chk.nonGoals', {}, 'scope');
  const unowned = state.questions.filter((q) => String(q.q || '').trim() && !String(q.owner || '').trim());
  add('owners', !unowned.length, 'warn', 'chk.owners', { n: unowned.length }, 'questions');
  const musts = state.reqs.filter((r) => r.priority === 'Must').length;
  add('must', !state.reqs.length || musts / state.reqs.length <= 0.8 || state.reqs.length < 4, 'warn', 'chk.mustShare', { n: musts, total: state.reqs.length }, 'reqs');
  return out;
}

/** Meter summary: trace score (0–100), counts, verdict (ready | fixes | not-ready). */
export function meter(state) {
  const checks = check(state);
  const trace = checks.filter((c) => c.trace);
  const okTrace = trace.filter((c) => c.ok).length;
  const pct = trace.length ? Math.round((okTrace / trace.length) * 100) : 0;
  const blocks = checks.filter((c) => !c.ok && c.level === 'block');
  const warns = checks.filter((c) => !c.ok && c.level === 'warn');
  const verdict = blocks.length ? 'not-ready' : warns.length ? 'fixes' : 'ready';
  const tm = traceMatrix(state);
  const goalsOk = tm.rows.filter((r) => r.reqs.length && r.metrics.length).length;
  return { pct, okTrace, totalTrace: trace.length, blocks, warns, verdict, checks, goalsOk, goals: tm.rows.length, orphans: tm.orphanReqs.length };
}

/** Offline critique (skill §6 review mode): Section · Issue · Why it matters · Suggested rewrite. */
export function critique(state, T) {
  return meter(state).checks.filter((c) => !c.ok).map((c) => ({
    section: T('sec.' + c.section), issue: T(c.key, c.vars), why: T('why.' + c.key.split('.')[1]), fix: T('fix.' + c.key.split('.')[1], c.vars),
    level: c.level,
  }));
}

/* ---------- Markdown ---------- */
const cell = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
export const mdTable = (head, rows) => [`| ${head.map(cell).join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');

/** The PRD in the skill's template, in the state's language. T(key, vars) gives the labels. */
export function toMarkdown(state, T) {
  const s = state;
  const m = meter(s);
  const out = [];
  const c = s.lang === 'fr' ? ' :' : ':';
  out.push(`# ${s.title || T('md.untitled')}`);
  const meta = [`**${T('md.status')}${c}** ${T('status.' + (s.status || 'draft'))}`];
  if (s.owner) meta.push(`**${T('md.owner')}${c}** ${s.owner}`);
  if (s.deadline) meta.push(`**${T('md.target')}${c}** ${s.deadline}`);
  meta.push(`**${T('md.trace')}${c}** ${m.pct} % · ${T('verdict.' + m.verdict)}`);
  out.push(meta.join(' · '), '');
  if (s.tldr) out.push(`## ${T('md.tldr')}`, s.tldr, '');
  out.push(`## 1. ${T('sec.problem')}`, s.problem || '⟨TBD⟩', '');
  if (s.evidence) out.push(s.evidence, '');
  out.push(`## 2. ${T('sec.goals')}`);
  out.push(`**${T('md.goals')}**`, ...(s.goals.length ? s.goals.map((g) => `- **${g.id}**${c} ${g.text}`) : ['- ⟨TBD⟩']), '');
  out.push(`**${T('md.nonGoals')}**`, ...(s.nonGoals.length ? s.nonGoals.map((g) => `- ${g}`) : ['- ⟨TBD⟩']), '');
  out.push(`## 3. ${T('sec.metrics')}`);
  out.push(mdTable([T('col.id'), T('col.metric'), T('col.type'), T('col.baseline'), T('col.target'), T('col.how'), T('col.goal')],
    s.metrics.map((x) => [x.id, x.name, T('mtype.' + x.type), x.baseline || '⟨TBD⟩', x.target, x.how, parseIds(x.goal).join(', ')])), '');
  out.push(`## 4. ${T('sec.users')}`);
  out.push(...(s.personas.length ? s.personas.map((p) => `- **${p.name}**${p.job ? c + ' ' + p.job : ''}`) : ['- ⟨TBD⟩']), '');
  out.push(`## 5. ${T('sec.reqs')}`);
  out.push(mdTable([T('col.id'), T('col.req'), T('col.priority'), T('col.goal'), T('col.notes')],
    s.reqs.map((r) => [r.id, r.text, r.priority, parseIds(r.goal).join(', ') || '—', r.notes])), '');
  if (s.risks.length) {
    out.push(`## 6. ${T('sec.risks')}`);
    out.push(mdTable([T('col.type'), T('col.item'), T('col.mitigation')], s.risks.map((r) => [T('rtype.' + r.type), r.item, r.mitigation])), '');
  }
  out.push(`## 7. ${T('sec.questions')}`);
  out.push(s.questions.length ? mdTable(['#', T('col.question'), T('col.owner'), T('col.due')], s.questions.map((q, i) => [i + 1, q.q, q.owner, q.due])) : '—', '');
  out.push(`## ${T('md.traceTitle')}`);
  const tm = traceMatrix(s);
  out.push(mdTable([T('col.goal'), T('col.reqs'), T('col.metrics'), T('col.state')],
    tm.rows.map((r) => [r.goal.id, r.reqs.join(', ') || '—', r.metrics.join(', ') || '—', r.reqs.length && r.metrics.length ? '✓' : '✗'])));
  if (tm.orphanReqs.length) out.push('', `${T('md.orphans')}${c} ${tm.orphanReqs.map((r) => r.id).join(', ')}`);
  return out.join('\n');
}

/* Story builder · pure logic (no DOM). Method from skills/writing-user-stories: Example Mapping (story · rules ·
   examples · questions) → Gherkin scenarios under `Rule:`, INVEST with plain reasons, Definition of Ready,
   SPIDR splitting (offline: split by rule). Exports: Jira CSV (BOM, repeated Labels), .feature (EN / FR), Markdown. */

export const KINDS = ['happy', 'fail', 'edge'];
export const POINTS = ['', 1, 2, 3, 5, 8, 13, 20];
export const PRIORITIES = ['High', 'Medium', 'Low'];

/** Gherkin keywords. FR = `# language: fr` (cucumber.io/docs/gherkin/languages). */
export const KW = {
  en: { feature: 'Feature', rule: 'Rule', scenario: 'Scenario', given: 'Given', when: 'When', then: 'Then', and: 'And' },
  fr: { feature: 'Fonctionnalité', rule: 'Règle', scenario: 'Scénario', given: 'Soit', when: 'Quand', then: 'Alors', and: 'Et' },
};

/** Words that describe the UI or the implementation instead of the need (Negotiable) or the outcome (Then). */
export const IMPL = ['button', 'click', 'dropdown', 'drop-down', 'checkbox', 'modal', 'popup', 'screen', 'api', 'endpoint',
  'database', 'table', 'json', 'http', 'status code', 'returns 200', 'bouton', 'cliquer', 'clique', 'liste déroulante',
  'case à cocher', 'écran', 'base de données', 'requête', 'renvoie 200'];
export const VAGUE = ['valid', 'invalid', 'some', 'correct', 'appropriate', 'etc', 'quelques', 'valide', 'correct', 'approprié', 'adéquat'];

const words = (text, list) => {
  const s = ' ' + String(text || '').toLowerCase().replace(/[.,;:!?()«»"']/g, ' ') + ' ';
  return list.filter((w) => s.includes(' ' + w + ' '));
};
export const splitLines = (s) => String(s || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const bullets = (s) => splitLines(s).map((l) => l.replace(/^\s*[-*•\d.)]+\s*/, '').trim()).filter(Boolean);

export function nextId(ids, prefix) {
  let n = 0;
  for (const id of ids) { const m = String(id).match(/^\D*(\d+)$/); if (m && String(id).startsWith(prefix)) n = Math.max(n, +m[1]); }
  return prefix + (n + 1);
}

export function emptyState(lang = 'en') {
  return { lang, feature: '', persona: '', rulesText: '', epic: '', labels: '', project: '', stories: [], active: '', built: false };
}
export const newExample = (id, kind = 'happy', name = '') => ({ id, kind, name, given: '', when: '', then: '' });
export const newRule = (id, text = '') => ({ id, text, examples: [] });
export function newStory(id, { title = '', want = '', soThat = '', rules = [] } = {}) {
  return { id, title, want, soThat, points: '', priority: 'Medium', dependsOn: '', source: '', checklist: '', rules, questions: [] };
}

const allRuleIds = (state) => state.stories.flatMap((s) => s.rules.map((r) => r.id));
const allExampleIds = (state) => state.stories.flatMap((s) => s.rules.flatMap((r) => r.examples.map((e) => e.id)));
export const ids = { rule: (st) => nextId(allRuleIds(st), 'R'), example: (st) => nextId(allExampleIds(st), 'E'), story: (st) => nextId(st.stories.map((s) => s.id), 'S') };

/** Command-bar run: turn Feature · Persona · Rules into a first map (one story holding every rule).
    Rules already on the board are kept; new rule lines are added to the active story. */
export function buildMap(state) {
  const s = structuredClone(state);
  const lines = bullets(s.rulesText);
  if (!s.stories.length) {
    s.stories.push(newStory('S1', { title: s.feature, want: lowerFirst(s.feature) }));
    s.active = 'S1';
  }
  const story = s.stories.find((x) => x.id === s.active) || s.stories[0];
  const known = new Set(s.stories.flatMap((x) => x.rules.map((r) => r.text.trim().toLowerCase())));
  const imported = new Set((s.imported || []).map((x) => x.toLowerCase()));
  for (const text of lines) {
    if (known.has(text.toLowerCase()) || imported.has(text.toLowerCase())) continue;
    imported.add(text.toLowerCase());
    story.rules.push(newRule(ids.rule(s), text));
  }
  s.imported = [...imported, ...lines.map((l) => l.toLowerCase())].filter((x, i, a) => a.indexOf(x) === i);
  s.built = true;
  return s;
}
const lowerFirst = (t) => String(t || '').replace(/^\p{Lu}(?!\p{Lu})/u, (c) => c.toLowerCase());

/** SPIDR "Rules" split, done offline: every rule after the first becomes its own story. */
export function splitByRule(state, storyId) {
  const s = structuredClone(state);
  const i = s.stories.findIndex((x) => x.id === storyId);
  if (i < 0) return s;
  const story = s.stories[i];
  const [keep, ...rest] = story.rules;
  if (!rest.length) return s;
  story.rules = keep ? [keep] : [];
  const added = rest.map((r) => {
    const n = newStory(ids.story(s), { title: r.text, want: lowerFirst(r.text), soThat: story.soThat, rules: [r] });
    n.priority = story.priority; n.source = story.source;
    s.stories.push(n);
    return n;
  });
  s.stories.splice(i + 1, 0, ...s.stories.splice(s.stories.length - added.length, added.length));
  return s;
}

/** Offline "Generate examples": a happy and a failing stub per rule that has none. */
export function stubExamples(state, storyId, T) {
  const s = structuredClone(state);
  const story = s.stories.find((x) => x.id === storyId);
  if (!story) return s;
  for (const r of story.rules) {
    if (r.examples.length) continue;
    r.examples.push({ ...newExample(ids.example(s), 'happy', T('stub.happy', { rule: r.text })), given: T('stub.given', { persona: s.persona || T('persona') }) });
    r.examples.push({ ...newExample(ids.example(s), 'fail', T('stub.fail', { rule: r.text })), given: T('stub.given', { persona: s.persona || T('persona') }) });
  }
  return s;
}

/* ---------- Checks ---------- */

/** Lint one example (scenario): exactly one When, a Then, concrete values, observable outcome. */
export function lintExample(e) {
  const out = [];
  const w = splitLines(e.when), g = splitLines(e.given), t = splitLines(e.then);
  if (!String(e.name || '').trim()) out.push({ key: 'lint.name' });
  if (!w.length) out.push({ key: 'lint.noWhen' });
  if (w.length > 1) out.push({ key: 'lint.oneWhen', vars: { n: w.length } });
  if (!t.length) out.push({ key: 'lint.noThen' });
  const all = [e.given, e.when, e.then].join(' ');
  if ((g.length || w.length || t.length) && !/[\d"«“]/.test(all)) out.push({ key: 'lint.concrete' });
  const impl = words(e.then, IMPL);
  if (impl.length) out.push({ key: 'lint.impl', vars: { w: impl.join(', ') } });
  const vague = words(all, VAGUE);
  if (vague.length) out.push({ key: 'lint.vague', vars: { w: vague.join(', ') } });
  return out;
}

/** INVEST for one story, with plain reasons. Each item: {letter, ok, level: 'fail'|'warn', key, vars}. */
export function invest(story, state) {
  const res = [];
  const add = (letter, ok, key, vars = {}, level = 'fail') => res.push({ letter, ok, key, vars, level });
  const deps = String(story.dependsOn || '').split(/[\s,;]+/).filter(Boolean).filter((d) => d !== story.id);
  add('I', !deps.length, deps.length ? 'inv.I.dep' : 'inv.I.ok', { ids: deps.join(', ') }, 'warn');
  const impl = words(story.want, IMPL);
  add('N', !impl.length, impl.length ? 'inv.N.ui' : 'inv.N.ok', { w: impl.join(', ') });
  const hasValue = String(story.soThat || '').trim().length > 3;
  add('V', hasValue, hasValue ? 'inv.V.ok' : 'inv.V.none');
  const open = story.questions.filter((q) => String(q.text || '').trim() && !String(q.answer || '').trim());
  add('E', !open.length, open.length ? 'inv.E.open' : 'inv.E.ok', { n: open.length });
  const nEx = story.rules.reduce((a, r) => a + r.examples.length, 0);
  const pts = +story.points || 0;
  const big = pts > 8 ? 'inv.S.points' : story.rules.length > 4 ? 'inv.S.rules' : nEx > 10 ? 'inv.S.examples' : '';
  add('S', !big, big || 'inv.S.ok', { pts, n: story.rules.length, e: nEx });
  const noEx = story.rules.filter((r) => !r.examples.length).map((r) => r.id);
  const noFail = story.rules.length && !story.rules.some((r) => r.examples.some((e) => e.kind !== 'happy'));
  const lintBad = story.rules.flatMap((r) => r.examples.filter((e) => lintExample(e).some((l) => ['lint.noWhen', 'lint.noThen', 'lint.oneWhen'].includes(l.key))).map((e) => e.id));
  const tKey = !story.rules.length ? 'inv.T.norules' : noEx.length ? 'inv.T.noex' : lintBad.length ? 'inv.T.lint' : noFail ? 'inv.T.nofail' : 'inv.T.ok';
  add('T', tKey === 'inv.T.ok', tKey, { ids: noEx.join(', '), ex: lintBad.join(', ') }, tKey === 'inv.T.nofail' ? 'warn' : 'fail');
  return res;
}

/** Definition of Ready: INVEST has no fail, no open question, persona + goal + value set. */
export function readiness(story, state) {
  const inv = invest(story, state);
  const fails = inv.filter((x) => !x.ok && x.level === 'fail');
  const warns = inv.filter((x) => !x.ok && x.level === 'warn');
  const basics = String(state.persona || '').trim() && String(story.want || '').trim();
  const ready = !fails.length && basics;
  return { ready: !!ready, fails, warns, invest: inv, score: inv.filter((x) => x.ok).length };
}

export function summary(state) {
  const stories = state.stories.map((s) => ({ s, r: readiness(s, state) }));
  const scenarios = state.stories.reduce((a, s) => a + s.rules.reduce((b, r) => b + r.examples.length, 0), 0);
  const questions = state.stories.reduce((a, s) => a + s.questions.filter((q) => q.text && !q.answer).length, 0);
  return { stories: stories.length, ready: stories.filter((x) => x.r.ready).length, scenarios, questions, rules: allRuleIds(state).length, list: stories };
}

/* ---------- Gherkin ---------- */

export function storyLine(story, persona, lang) {
  const p = persona || (lang === 'fr' ? 'utilisateur' : 'user');
  const so = String(story.soThat || '').trim();
  if (lang === 'fr') {
    const afin = !so ? '' : /^qu(e|')/i.test(so) ? `, afin ${so}` : /^[aeiouyéèêàh]/i.test(so) ? `, afin d'${so}` : `, afin de ${so}`;
    return `En tant que ${p}, je veux ${story.want || '…'}${afin}.`;
  }
  return `As ${/^[aeiou]/i.test(p) ? 'an' : 'a'} ${p}, I want ${story.want || '…'}${so ? `, so that ${so}` : ''}.`;
}

function steps(kw, block, out, indent) {
  block.forEach(([k, text]) => splitLines(text).forEach((line, i) => out.push(`${indent}${i ? kw.and : kw[k]} ${line}`)));
}

/** Scenarios of one rule as Gherkin lines (indent = spaces before `Scenario`). */
export function scenarioLines(rule, story, lang, indent = '    ') {
  const kw = KW[lang] || KW.en;
  const out = [];
  for (const e of rule.examples) {
    out.push(`${indent}@${story.id} @${e.kind}`, `${indent}${kw.scenario}: ${e.name || e.id}`);
    steps(kw, [['given', e.given], ['when', e.when], ['then', e.then]], out, indent + '  ');
    out.push('');
  }
  return out;
}

/** One .feature for the whole map: Feature → Rule (per rule) → Scenario (per example), tagged with the story id. */
export function toFeature(state, onlyStory) {
  const lang = state.lang === 'fr' ? 'fr' : 'en';
  const kw = KW[lang];
  const out = lang === 'fr' ? ['# language: fr'] : [];
  out.push(`${kw.feature}: ${state.feature || state.stories[0]?.title || '…'}`);
  const list = onlyStory ? state.stories.filter((s) => s.id === onlyStory) : state.stories;
  for (const s of list) out.push(`  ${storyLine(s, state.persona, lang)}`);
  out.push('');
  for (const s of list) {
    for (const r of s.rules) {
      out.push(`  ${kw.rule}: ${r.text}`, '');
      if (r.examples.length) out.push(...scenarioLines(r, s, lang));
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/* ---------- Exports ---------- */
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const toCsv = (rows) => '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');

/** Jira Cloud CSV import (research/05): Summary, Issue Type, Description, Priority, Labels ×2, Story Points, Parent.
    Acceptance criteria go in the Description (custom-field names differ per site). */
export function toJiraCsv(state, T) {
  const lang = state.lang === 'fr' ? 'fr' : 'en';
  const labels = String(state.labels || '').split(/[\s,;]+/).filter(Boolean).map((l) => l.replace(/\s+/g, '-'));
  const rows = [['Summary', 'Issue Type', 'Description', 'Priority', 'Labels', 'Labels', 'Story Points', 'Parent']];
  for (const s of state.stories) {
    const gh = s.rules.flatMap((r) => [`${KW[lang].rule}: ${r.text}`, ...scenarioLines(r, s, lang, '  ').filter((l) => !l.trim().startsWith('@'))]);
    const desc = [storyLine(s, state.persona, lang), '', `*${T('md.ac')}*`, ...gh];
    if (String(s.checklist || '').trim()) desc.push('', `*${T('md.checklist')}*`, ...splitLines(s.checklist).map((c) => '* ' + c));
    if (s.source) desc.push('', `${T('md.source')}: ${s.source}`);
    rows.push([s.title, 'Story', desc.join('\n').trim(), s.priority || 'Medium', labels[0] || '', labels[1] || '', s.points ?? '', state.epic || '']);
  }
  return toCsv(rows);
}

/** Markdown: story map table, then per story the story, example map, Gherkin, checklist, INVEST and readiness. */
export function toMarkdown(state, T) {
  const lang = state.lang === 'fr' ? 'fr' : 'en';
  const c = lang === 'fr' ? ' :' : ':';
  const sum = summary(state);
  const out = [`# ${state.feature || T('md.untitled')}`, '',
    `${T('md.persona')}${c} **${state.persona || '—'}** · ${T('md.stories')}${c} ${sum.stories} · ${T('md.ready')}${c} ${sum.ready}/${sum.stories} · ${T('md.scenarios')}${c} ${sum.scenarios}`, ''];
  for (const { s, r } of sum.list) {
    out.push('---', '', `### ${s.id} · ${s.title || '…'}`);
    const meta = [state.epic && `${T('md.epic')}${c} ${state.epic}`, s.priority && `${T('md.priority')}${c} ${T('prio.' + s.priority)}`, s.points && `${T('md.points')}${c} ${s.points}`, s.source && `${T('md.source')}${c} ${s.source}`].filter(Boolean);
    if (meta.length) out.push(meta.join(' · '));
    out.push('', storyLine(s, state.persona, lang), '');
    out.push(`**${T('md.map')}**`);
    for (const rule of s.rules) {
      out.push(`- *${T('card.rule')}${c}* ${rule.text}`);
      for (const e of rule.examples) out.push(`  - *${T('kind.' + e.kind)}${c}* ${e.name}`);
    }
    for (const q of s.questions) out.push(`- *${T('card.question')}${c}* ${q.text}${q.answer ? ` → **${T('md.answered')}${c} ${q.answer}**` : ''}`);
    const gh = s.rules.flatMap((rule) => (rule.examples.length ? [`${KW[lang].rule}: ${rule.text}`, ...scenarioLines(rule, s, lang, '  ').filter((l) => !l.trim().startsWith('@'))] : []));
    if (gh.length) out.push('', '```gherkin', ...(lang === 'fr' ? ['# language: fr'] : []), ...gh.map((l) => l.trimEnd()), '```');
    if (String(s.checklist || '').trim()) out.push('', `**${T('md.checklist')}**`, ...splitLines(s.checklist).map((x) => `- [ ] ${x}`));
    const inv = r.invest.map((x) => `${x.letter} ${x.ok ? '✓' : x.level === 'warn' ? '⚠' : '✗'}`).join(' · ');
    const why = r.invest.filter((x) => !x.ok).map((x) => `${x.letter}: ${T(x.key, x.vars)}`).join('; ');
    out.push('', `**INVEST${c}** ${inv}${why ? ` (${why})` : ''} → **${r.ready ? T('ready') : T('notReady')}**`, '');
  }
  return out.join('\n');
}

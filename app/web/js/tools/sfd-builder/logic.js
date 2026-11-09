/* SFD builder · pure logic (no DOM). Method from skills/writing-functional-specs (AMOA SFG/SFD): numbered business
   rules RG-01…, one rule = one behaviour with an example; a field list (name · type · mandatory · validation · source ·
   rule); screens and flow; messages MSG-01…; traceability story → rule → screen/field → test idea. */

export const TYPES = ['text', 'number', 'amount', 'date', 'datetime', 'choice', 'boolean', 'list', 'button', 'id'];
export const VAGUE = ['should', 'ideally', 'etc', 'as usual', 'if possible', 'normally', 'quickly', 'appropriate',
  'devrait', 'idéalement', 'comme d\'habitude', 'si possible', 'normalement', 'rapidement', 'approprié', 'etc.'];

const TYPE_WORDS = [
  ['amount', /\b(amount|montant|€|eur)\b/i], ['datetime', /\b(datetime|timestamp|horodatage|date-heure|date et heure)\b/i],
  ['date', /\b(date)\b/i], ['number', /\b(number|nombre|integer|entier|numeric|numérique)\b/i],
  ['boolean', /\b(boolean|booléen|checkbox|case à cocher|yes\/no|oui\/non)\b/i], ['button', /\b(button|bouton)\b/i],
  ['list', /\b(list|liste|table)\b/i], ['choice', /\b(choice|choix|select|enum|liste de valeurs)\b/i], ['id', /\b(id|identifier|identifiant)\b/i],
  ['text', /\b(text|texte|string|chaîne)\b/i],
];
const MANDATORY = /\b(mandatory|required|obligatoire|requis)\b/i;
const OPTIONAL = /\b(optional|facultatif|optionnel)\b/i;

const pad = (n) => String(n).padStart(2, '0');
export const rgId = (n) => `RG-${pad(n)}`;
export const msgId = (n) => `MSG-${pad(n)}`;
export const parseIds = (v) => [...new Set(String(v ?? '').split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean))];
const lines = (s) => String(s || '').split(/\r?\n/).map((l) => l.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean);

export function vagueWords(text) {
  const s = ' ' + String(text || '').toLowerCase().replace(/[,;:!?()«»"]/g, ' ').replace(/\.(\s|$)/g, ' ') + ' ';
  return [...new Set(VAGUE.map((w) => w.replace(/\.$/, '')).filter((w) => s.includes(' ' + w + ' ')))];
}
export const toConfirm = (text) => /to confirm|à confirmer|tbd|⟨tbd/i.test(String(text || ''));

export function nextNum(ids) { let n = 0; for (const id of ids) { const m = String(id).match(/(\d+)$/); if (m) n = Math.max(n, +m[1]); } return n + 1; }

export function emptyState(lang = 'en') {
  return {
    lang, feature: '', rulesText: '', fieldsText: '',
    level: 'SFD', version: '0.1', status: 'draft', author: '', reviewers: '', context: '', scopeIn: '', scopeOut: '',
    flow: '', errorPath: '', nfr: '',
    rules: [], fields: [], screens: [], messages: [], stories: [], openPoints: [], imported: [], built: false,
  };
}

/** "Card | choice | mandatory | cards of the cardholder | CMS" or "Reason: choice, mandatory, lost / stolen" → field. */
export function parseField(line, screen = '') {
  const raw = String(line).trim();
  let name, rest;
  if (raw.includes('|')) {
    const [n, type = '', mand = '', validation = '', source = '', rule = ''] = raw.split('|').map((x) => x.trim());
    const t = TYPES.includes(type.toLowerCase()) ? type.toLowerCase() : detectType(type) || 'text';
    return { screen, name: n, type: t, mandatory: !OPTIONAL.test(mand) && (MANDATORY.test(mand) || /^(y|yes|oui|o|true|1|x)$/i.test(mand)), validation, source, rule: parseIds(rule).join(', ') };
  }
  const i = raw.indexOf(':');
  if (i > 0) { name = raw.slice(0, i).trim(); rest = raw.slice(i + 1).trim(); } else { name = raw; rest = ''; }
  const parts = rest.split(',').map((x) => x.trim()).filter(Boolean);
  let type = '', mandatory = false, rule = '';
  const other = [];
  for (const p of parts) {
    if (!type && (TYPES.includes(p.toLowerCase()) || (detectType(p) && p.split(/\s+/).length <= 2))) { type = TYPES.includes(p.toLowerCase()) ? p.toLowerCase() : detectType(p); continue; }
    if (MANDATORY.test(p) && p.split(/\s+/).length <= 2) { mandatory = true; continue; }
    if (OPTIONAL.test(p) && p.split(/\s+/).length <= 2) continue;
    if (/^RG-\d+$/i.test(p)) { rule = p.toUpperCase(); continue; }
    other.push(p);
  }
  return { screen, name, type: type || detectType(name) || 'text', mandatory, validation: other.join(', '), source: '', rule };
}
function detectType(text) { for (const [t, re] of TYPE_WORDS) if (re.test(text)) return t; return ''; }

/** Command-bar run: number the rule lines (RG-01…) and parse the field lines. Rows already present are kept. */
export function buildTables(state) {
  const s = structuredClone(state);
  // lines already imported once are skipped, so editing a rule in the table and running again never duplicates it
  const imported = new Set((s.imported || []).map((x) => x.toLowerCase()));
  const known = new Set(s.rules.map((r) => r.text.trim().toLowerCase()));
  for (const l of lines(s.rulesText)) {
    if (imported.has(l.toLowerCase())) continue;
    imported.add(l.toLowerCase());
    const m = l.match(/^(RG-\d+)\s*[:·.-]?\s*(.*)$/i);
    const text = (m ? m[2] : l).trim();
    if (!text || known.has(text.toLowerCase())) continue;
    let id = m ? m[1].toUpperCase() : rgId(nextNum(s.rules.map((r) => r.id)));
    if (s.rules.some((r) => r.id === id)) id = rgId(nextNum(s.rules.map((r) => r.id)));
    s.rules.push({ id, text, example: '', source: '', msg: '', stories: '' });
    known.add(text.toLowerCase());
  }
  const knownF = new Set(s.fields.map((f) => f.name.trim().toLowerCase()));
  let screen = s.screens[0] ? s.screens[0].id : '';
  for (const l of lines(s.fieldsText)) {
    if (imported.has('field:' + l.toLowerCase())) continue;
    imported.add('field:' + l.toLowerCase());
    const sm = l.match(/^(E-\d+)\s*[:·.-]\s*(.*)$/i);
    if (sm && !sm[2].includes(':') && !sm[2].includes('|')) {           // "E-02: Unrecognised payments" = a screen header
      screen = sm[1].toUpperCase();
      if (!s.screens.some((x) => x.id === screen)) s.screens.push({ id: screen, name: sm[2], purpose: '' });
      continue;
    }
    const f = parseField(l, screen);
    if (!f.name || knownF.has(f.name.toLowerCase())) continue;
    s.fields.push(f); knownF.add(f.name.toLowerCase());
  }
  if (s.fields.length && !s.screens.length) s.screens.push({ id: 'E-01', name: s.feature, purpose: '' });
  for (const f of s.fields) if (!f.screen && s.screens[0]) f.screen = s.screens[0].id;
  s.imported = [...imported];
  s.built = true;
  return s;
}

/** Checks: {id, ok, level 'block'|'warn', key, vars, where}. */
export function check(state) {
  const out = [];
  const add = (id, ok, level, key, vars = {}, where = 'rules') => out.push({ id, ok, level, key, vars, where });
  const ruleIds = new Set(state.rules.map((r) => r.id.toUpperCase()));
  const msgIds = new Set(state.messages.map((m) => m.id.toUpperCase()));
  const storyIds = new Set(state.stories.map((m) => m.id.toUpperCase()));
  const screenIds = new Set(state.screens.map((m) => m.id.toUpperCase()));
  add('rules', state.rules.length > 0, 'block', 'chk.rules');
  const seen = new Set();
  for (const r of state.rules) {
    const id = r.id.toUpperCase();
    if (seen.has(id)) add('dup-' + id, false, 'block', 'chk.dup', { id });
    seen.add(id);
    if (!String(r.example || '').trim()) add('ex-' + id, false, 'warn', 'chk.noExample', { id });
    const v = vagueWords(r.text);
    if (v.length) add('vague-' + id, false, 'block', 'chk.vague', { id, w: v.join(', ') });
    const st = parseIds(r.stories);
    if (state.stories.length && !st.length) add('trace-' + id, false, 'warn', 'chk.noStory', { id }, 'trace');
    for (const x of st) if (!storyIds.has(x)) add(`ust-${id}-${x}`, false, 'block', 'chk.unknownStory', { id, ref: x }, 'trace');
    for (const x of parseIds(r.msg)) if (!msgIds.has(x)) add(`umsg-${id}-${x}`, false, 'block', 'chk.unknownMsg', { id, ref: x }, 'rules');
  }
  for (const f of state.fields) {
    const n = f.name || '?';
    if (!f.type) add('ftype-' + n, false, 'block', 'chk.fieldType', { n }, 'fields');
    if (!String(f.validation || '').trim() && f.type !== 'button') add('fval-' + n, false, 'warn', 'chk.fieldFormat', { n }, 'fields');
    for (const x of parseIds(f.rule)) if (!ruleIds.has(x)) add(`frule-${n}-${x}`, false, 'block', 'chk.fieldRule', { n, ref: x }, 'fields');
    if (f.screen && screenIds.size && !screenIds.has(String(f.screen).toUpperCase())) add('fscr-' + n, false, 'warn', 'chk.fieldScreen', { n, ref: f.screen }, 'fields');
  }
  const usedMsgs = new Set(state.rules.flatMap((r) => parseIds(r.msg)));
  for (const m of state.messages) if (!usedMsgs.has(m.id.toUpperCase())) add('msg-' + m.id, false, 'warn', 'chk.msgUnused', { id: m.id }, 'screens');
  for (const s of state.stories) if (!state.rules.some((r) => parseIds(r.stories).includes(s.id.toUpperCase()))) add('story-' + s.id, false, 'warn', 'chk.storyNoRule', { id: s.id }, 'trace');
  if (state.fields.length) add('fields', true, 'block', 'chk.fieldsOk', { n: state.fields.length }, 'fields');
  else add('fields', false, 'warn', 'chk.noFields', {}, 'fields');
  return out;
}

export function review(state) {
  const checks = check(state);
  const blocks = checks.filter((c) => !c.ok && c.level === 'block');
  const warns = checks.filter((c) => !c.ok && c.level === 'warn');
  const traced = state.rules.filter((r) => parseIds(r.stories).length).length;
  const withEx = state.rules.filter((r) => String(r.example || '').trim()).length;
  const confirm = [...state.rules.map((r) => r.text + ' ' + r.example), ...state.fields.map((f) => f.validation), ...state.openPoints.map((p) => p.q)].filter(toConfirm).length;
  return {
    checks, blocks, warns, verdict: blocks.length ? 'not-ready' : warns.length ? 'fixes' : 'ready',
    rules: state.rules.length, fields: state.fields.length, screens: state.screens.length, messages: state.messages.length,
    open: state.openPoints.filter((p) => String(p.q || '').trim()).length, traced, withEx, confirm,
  };
}

/** Rule × story matrix plus the fields that apply each rule. */
export function traceMatrix(state) {
  return state.rules.map((r) => ({
    rule: r, stories: parseIds(r.stories),
    fields: state.fields.filter((f) => parseIds(f.rule).includes(r.id.toUpperCase())).map((f) => `${f.screen ? f.screen + ' · ' : ''}${f.name}`),
  }));
}

/** One acceptance test idea per rule (skill §3.13): the example, else the rule itself. */
export const testIdeas = (state, T) => state.rules.map((r) => ({ id: r.id, idea: r.example ? T('test.example', { ex: r.example }) : T('test.rule', { rule: r.text }) }));

/* ---------- Markdown + CSV ---------- */
const cell = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>').trim();
export const mdTable = (head, rows) => [`| ${head.map(cell).join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const toCsv = (rows) => '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');

/** Rules CSV (feeds the Xray builder and the UAT tracker): ID, Rule, Example, Source, Message, Stories, Test idea. */
export function rulesCsv(state, T) {
  const ideas = Object.fromEntries(testIdeas(state, T).map((x) => [x.id, x.idea]));
  return toCsv([['ID', 'Rule', 'Example', 'Source', 'Message', 'Stories', 'Test idea'],
    ...state.rules.map((r) => [r.id, r.text, r.example, r.source, parseIds(r.msg).join(' '), parseIds(r.stories).join(' '), ideas[r.id]])]);
}

export function toMarkdown(state, T) {
  const s = state, rv = review(s);
  const c = s.lang === 'fr' ? ' :' : ':';
  const out = [`## ${s.level} · ${s.feature || T('md.untitled')}`, ''];
  let n = 0;
  const h = (key) => out.push(`### ${++n} · ${T('h.' + key)}`);
  h('control');
  out.push(mdTable([T('col.version'), T('col.status'), T('col.author'), T('col.reviewers')], [[s.version, T('status.' + s.status), s.author, s.reviewers]]), '');
  if (s.context) { h('context'); out.push(s.context, ''); }
  if (s.scopeIn || s.scopeOut) {
    h('scope');
    if (s.scopeIn) out.push(`**${T('md.in')}${c}** ${s.scopeIn}`);
    if (s.scopeOut) out.push(`**${T('md.out')}${c}** ${s.scopeOut}`);
    out.push('');
  }
  if (s.flow || s.errorPath) {
    h('process');
    lines(s.flow).forEach((l, i) => out.push(`${i + 1}. ${l.replace(/^\d+[.)]\s*/, '')}`));
    if (s.errorPath) out.push('', `**${T('md.errorPath')}${c}** ${s.errorPath}`);
    out.push('');
  }
  h('rules');
  out.push(mdTable([T('col.id'), T('col.rule'), T('col.example'), T('col.source'), T('col.msg')],
    s.rules.map((r) => [r.id, r.text, r.example || '—', r.source, parseIds(r.msg).join(', ')])), '');
  h('screens');
  const screens = s.screens.length ? s.screens : [{ id: '', name: '' }];
  for (const sc of screens) {
    const fs = s.fields.filter((f) => (f.screen || '') === sc.id || (!sc.id && !f.screen));
    if (sc.id) out.push(`**${sc.id} · ${sc.name}**${sc.purpose ? ` · ${sc.purpose}` : ''}`);
    if (fs.length) out.push(mdTable([T('col.field'), T('col.type'), T('col.mandatory'), T('col.validation'), T('col.fsource'), T('col.rg')],
      fs.map((f) => [f.name, T('type.' + f.type), f.mandatory ? T('yes') : T('no'), f.validation || '—', f.source, parseIds(f.rule).join(', ')])));
    out.push('');
  }
  const orphanFields = s.fields.filter((f) => f.screen && !s.screens.some((x) => x.id === f.screen));
  if (orphanFields.length) out.push(mdTable([T('col.field'), T('col.type'), T('col.mandatory'), T('col.validation'), T('col.fsource'), T('col.rg')],
    orphanFields.map((f) => [f.name, T('type.' + f.type), f.mandatory ? T('yes') : T('no'), f.validation, f.source, f.rule])), '');
  if (s.messages.length) {
    h('messages');
    out.push(mdTable([T('col.id'), T('col.when'), T('col.text')], s.messages.map((m) => [m.id, m.when, m.text])), '');
  }
  if (s.nfr) { h('nfr'); out.push(...lines(s.nfr).map((l) => `- ${l}`), ''); }
  h('trace');
  out.push(mdTable([T('col.rule'), T('col.stories'), T('col.fieldsUsing'), T('col.test')],
    traceMatrix(s).map((x, i) => [x.rule.id, x.stories.join(', ') || '—', x.fields.join('; ') || '—', testIdeas(s, T)[i].idea])), '');
  if (s.stories.length) out.push(`${T('md.storyList')}${c} ${s.stories.map((x) => `${x.id} ${x.title}`).join(' · ')}`, '');
  if (s.openPoints.length) {
    h('open');
    out.push(mdTable([T('col.question'), T('col.owner'), T('col.due')], s.openPoints.map((p) => [p.q, p.owner, p.due])), '');
  }
  out.push(`> **${T('md.review')}${c}** ${T('md.reviewLine', rv)} · ${T('verdict.' + rv.verdict)}`);
  return out.join('\n');
}

/* Journey builder logic (owner E). Pure, no DOM: browser + node (logic.test.mjs).
   Steps (outline, see ../bpmn-editor/outline.js) → graph {nodes, edges}; layout; the walker the test chat uses;
   reply matching; design checks (fallback on every question, hand-off present, AI disclosure, no PIN/PAN asks…);
   Markdown / Mermaid / JSON exports.

   Step lines:  Say: text · Ask: question [Option 1 | Option 2] · Do: system action · Check: system condition?
                Handoff: to whom, with what · End: outcome            (FR: Dire · Demander · Faire · Vérifier · Transfert · Fin)
   Branches under Ask/Check: "  Lost / lost it / can't find → Do: Block card". Alternatives separated by "/" are what the
   customer may type. "*" (or other, else, autre, sinon) is the fallback branch for anything else. */
import { layer, norm, parseOutline, walkOutline } from '../bpmn-editor/outline.js';

export const TYPES = ['start', 'message', 'question', 'check', 'action', 'handoff', 'end'];
const KEYWORDS = {
  message: ['say', 'bot', 'message', 'dire', 'dit', 'assistant'],
  question: ['ask', 'question', 'demander', 'demande'],
  action: ['do', 'action', 'faire', 'system', 'système', 'systeme'],
  check: ['check', 'if', 'condition', 'vérifier', 'verifier', 'si'],
  handoff: ['handoff', 'hand-off', 'transfer', 'advisor', 'transfert', 'conseiller', 'human', 'humain'],
  end: ['end', 'fin', 'done', 'resolved'],
};
const KW = new Map(Object.entries(KEYWORDS).flatMap(([t, ks]) => ks.map((k) => [k, t])));
export const TERMINAL = new Set(['handoff', 'end']);
export const DECISION = new Set(['question', 'check']);
const FALLBACK = new Set(['*', 'other', 'otherwise', 'else', 'fallback', 'anything else', 'no match', 'autre', 'sinon', 'repli', 'autre chose', 'pas compris']);
export const isFallback = (label) => FALLBACK.has(String(label || '').trim().toLowerCase());

/** "Ask: What happened? [Lost | Stolen]" → {type, text, options} */
export function parseLine(body) {
  let s = String(body || '').trim(), type = null;
  const m = s.match(/^([\p{L}-]+)\s*:\s*(.*)$/u);
  if (m && KW.has(m[1].toLowerCase())) { type = KW.get(m[1].toLowerCase()); s = m[2].trim(); }
  let options = [];
  const o = s.match(/^(.*?)\s*\[([^\]]*\|[^\]]*|[^\]]+)\]\s*$/);
  if (o && (type === 'question' || (!type && o[1].trim().endsWith('?')))) { s = o[1].trim(); options = o[2].split('|').map((x) => x.trim()).filter(Boolean); }
  if (!type) type = s.endsWith('?') ? 'question' : 'message';
  return { type, text: s, options };
}
const isDecisionBody = (body) => DECISION.has(parseLine(String(body).replace(/^\[[\w.-]+\]\s*/, '')).type);

/** input = {intent, steps, solved}; words = {resolved} → {graph, problems} */
export function stepsToGraph(input, words = { resolved: 'Resolved' }) {
  const { items, problems } = parseOutline(input.steps, isDecisionBody);
  const nodes = [], edges = [];
  const byRef = new Map();
  let n = 0;
  const add = (node) => { nodes.push(node); return node; };
  const edge = (from, to, label) => edges.push({ id: 'e' + (edges.length + 1), from, to, label: label || '' });
  const start = add({ id: 'n' + ++n, type: 'start', text: String(input.intent || '').trim() || '…', options: [] });
  if (!items.length) return { graph: layout({ nodes, edges }), problems: [...problems, { code: 'noSteps' }] };
  const { tails, unresolved } = walkOutline(items, {
    node(it) {
      const p = parseLine(it.body);
      const nd = add({ id: 'n' + ++n, type: p.type, text: p.text, options: p.options, line: it.line });
      if (it.id) byRef.set('#' + it.id.toLowerCase(), nd.id);
      if (!byRef.has(norm(p.text))) byRef.set(norm(p.text), nd.id);
      return { id: nd.id, terminal: TERMINAL.has(nd.type), decision: DECISION.has(nd.type) };
    },
    edge,
    resolve(ref) {
      const r = ref.trim();
      if (byRef.has('#' + r.toLowerCase())) return byRef.get('#' + r.toLowerCase());
      if (byRef.has(norm(r))) return byRef.get(norm(r));
      const hit = nodes.find((x) => x.type !== 'start' && norm(x.text).startsWith(norm(r)));
      return hit ? hit.id : null;
    },
  }, [{ id: start.id, label: '' }]);
  for (const u of unresolved) problems.push({ code: 'gotoUnknown', line: u.line, ref: u.ref });
  if (tails.length) {
    const end = add({ id: 'n' + ++n, type: 'end', text: String(input.solved || '').trim() || words.resolved, options: [] });
    for (const t of tails) edge(t.id, end.id, t.label);
  }
  return { graph: layout({ nodes, edges }), problems };
}

/* ------------------------------------------------------------------ layout */
export const NODE_W = 208, COL_W = 264, ROW_H = 132, PAD = 24;
export function layout(graph) {
  const ids = graph.nodes.map((x) => x.id);
  const { col } = layer(ids, graph.edges, graph.nodes.filter((x) => x.type === 'start').map((x) => x.id));
  const rows = new Map();
  for (const nd of graph.nodes) {
    const c = col.get(nd.id) || 0;
    const r = rows.get(c) || 0;
    rows.set(c, r + 1);
    nd.x = PAD + c * COL_W;
    nd.y = PAD + r * ROW_H;
  }
  return graph;
}

/* ------------------------------------------------------------------ graph helpers */
export const outOf = (g, id) => g.edges.filter((e) => e.from === id);
export const nodeOf = (g, id) => g.nodes.find((x) => x.id === id);
export function nextId(g, prefix = 'n') {
  let i = g.nodes.length + g.edges.length + 1;
  const used = new Set([...g.nodes.map((x) => x.id), ...g.edges.map((x) => x.id)]);
  while (used.has(prefix + i)) i++;
  return prefix + i;
}

/* ------------------------------------------------------------------ test chat */
/** Walk from a node until input is needed or the journey stops.
    → {events: [{kind: 'user'|'bot'|'action'|'check'|'handoff'|'end'|'dead'|'loop', node}], wait: nodeId|null} */
export function walk(g, fromId, max = 40) {
  const events = [];
  let id = fromId, steps = 0;
  while (id) {
    const nd = nodeOf(g, id);
    if (!nd) break;
    if (++steps > max) { events.push({ kind: 'loop', node: nd }); return { events, wait: null }; }
    if (nd.type === 'start') events.push({ kind: 'user', node: nd });
    else if (nd.type === 'message') events.push({ kind: 'bot', node: nd });
    else if (nd.type === 'action') events.push({ kind: 'action', node: nd });
    else if (nd.type === 'question') { events.push({ kind: 'bot', node: nd }); return { events, wait: nd.id }; }
    else if (nd.type === 'check') { events.push({ kind: 'check', node: nd }); return { events, wait: nd.id }; }
    else if (nd.type === 'handoff') { events.push({ kind: 'handoff', node: nd }); return { events, wait: null }; }
    else if (nd.type === 'end') { events.push({ kind: 'end', node: nd }); return { events, wait: null }; }
    const outs = outOf(g, id);
    if (!outs.length) { events.push({ kind: 'dead', node: nd }); return { events, wait: null }; }
    id = (outs.find((e) => !e.label) || outs[0]).to;
  }
  return { events, wait: null };
}

const alts = (label) => String(label || '').split(/\s*[/|]\s*/).map(norm).filter(Boolean);
/** Customer reply at a question → {edge, fallback} (edge null = unhandled input). */
export function matchReply(g, nodeId, reply) {
  const outs = outOf(g, nodeId);
  const r = norm(reply);
  const rWords = new Set(r.split(' ').filter((w) => w.length >= 4));
  let best = null, bestScore = 0;
  for (const e of outs) {
    if (isFallback(e.label)) continue;
    for (const a of alts(e.label)) {
      let s = 0;
      if (r === a) s = 4;
      else if (r && (` ${r} `.includes(` ${a} `))) s = 3;
      else if (r.length >= 3 && a.includes(r)) s = 2;
      else if (a.split(' ').some((w) => w.length >= 4 && rWords.has(w))) s = 1;
      if (s > bestScore) { bestScore = s; best = e; }
    }
  }
  if (best) return { edge: best, fallback: false };
  const fb = outs.find((e) => isFallback(e.label));
  return { edge: fb || null, fallback: true };
}

/** The reply buttons to offer at a decision: its options, else the first alternative of each non-fallback branch. */
export function replyChoices(g, nd) {
  if (nd.options && nd.options.length) return nd.options;
  return outOf(g, nd.id).filter((e) => e.label && !isFallback(e.label)).map((e) => String(e.label).split(/\s*[/|]\s*/)[0]);
}

/* ------------------------------------------------------------------ checks */
const SENSITIVE = /\b(card number|full card|pan\b|pin\b|pin code|password|passcode|one[- ]time (pass)?code|otp|cvv|cvc|security code|numéro de (votre |la )?carte|code (confidentiel|secret|pin)|mot de passe|cryptogramme|code à usage unique)/i;
const AI_WORDS = /\b(ai|a\.i\.|virtual assistant|chatbot|bot|automated assistant|ia|assistant virtuel|intelligence artificielle|robot)\b/i;
const HUMAN = /\b(advisor|adviser|agent|human|person|someone|conseiller|conseillère|humain|quelqu'un)\b/i;

/** → [{code, level: 'bad'|'warn'|'info', ids, text?, n?}] — codes are i18n keys (chk_<code>). */
export function checkGraph(g, channel = 'chat') {
  const out = [];
  const starts = g.nodes.filter((x) => x.type === 'start');
  if (!starts.length) out.push({ code: 'noStart', level: 'bad', ids: [] });
  // unhandled input: every question needs a fallback branch
  for (const nd of g.nodes.filter((x) => x.type === 'question')) {
    const outs = outOf(g, nd.id);
    if (!outs.some((e) => isFallback(e.label))) out.push({ code: 'noFallback', level: 'bad', ids: [nd.id], text: nd.text });
    const unl = outs.filter((e) => !e.label).length;
    if (outs.length > 1 && unl) out.push({ code: 'unlabelled', level: 'warn', ids: [nd.id], text: nd.text, n: unl });
    const opts = replyChoices(g, nd).length;
    if (channel === 'voice' && opts > 3) out.push({ code: 'voiceOptions', level: 'warn', ids: [nd.id], text: nd.text, n: opts });
    else if (opts > 4) out.push({ code: 'tooManyOptions', level: 'warn', ids: [nd.id], text: nd.text, n: opts });
    for (const o of nd.options || []) if (!outs.some((e) => alts(e.label).includes(norm(o)))) out.push({ code: 'optionNoBranch', level: 'warn', ids: [nd.id], text: o });
    if (SENSITIVE.test(nd.text)) out.push({ code: 'sensitive', level: 'bad', ids: [nd.id], text: nd.text });
    // a fallback that comes straight back to the same question loops forever
    const fb = outs.find((e) => isFallback(e.label));
    if (fb && reaches(g, fb.to, nd.id, new Set(['handoff']))) out.push({ code: 'fallbackLoop', level: 'warn', ids: [nd.id], text: nd.text });
  }
  for (const nd of g.nodes.filter((x) => x.type === 'check')) {
    const outs = outOf(g, nd.id);
    if (outs.length < 2) out.push({ code: 'checkOneWay', level: 'warn', ids: [nd.id], text: nd.text });
    if (outs.some((e) => !e.label)) out.push({ code: 'unlabelled', level: 'warn', ids: [nd.id], text: nd.text, n: outs.filter((e) => !e.label).length });
  }
  if (!g.nodes.some((x) => x.type === 'handoff')) out.push({ code: 'noHandoff', level: 'bad', ids: [] });
  const firstBot = firstBotNode(g);
  if (firstBot && !AI_WORDS.test(firstBot.text)) out.push({ code: 'noDisclosure', level: 'warn', ids: [firstBot.id] });
  for (const nd of g.nodes) {
    if (!TERMINAL.has(nd.type) && !outOf(g, nd.id).length) out.push({ code: 'deadEnd', level: 'warn', ids: [nd.id], text: nd.text });
    if (nd.type !== 'start' && !nd.text.trim()) out.push({ code: 'emptyText', level: 'warn', ids: [nd.id] });
  }
  if (starts.length) {
    const seen = reachable(g, starts[0].id);
    const cut = g.nodes.filter((x) => !seen.has(x.id));
    if (cut.length) out.push({ code: 'unreachable', level: 'warn', ids: cut.map((x) => x.id), n: cut.length });
  }
  const humanEdge = g.edges.some((e) => HUMAN.test(e.label));
  if (g.nodes.some((x) => x.type === 'question') && !humanEdge) out.push({ code: 'noHumanReply', level: 'info', ids: [] });
  if (channel === 'voice') for (const nd of g.nodes.filter((x) => ['message', 'question'].includes(x.type) && x.text.split(/[.!?]\s/).length > 3)) out.push({ code: 'voiceLong', level: 'info', ids: [nd.id], text: nd.text });
  const rank = { bad: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}
function firstBotNode(g) {
  const s = g.nodes.find((x) => x.type === 'start');
  if (!s) return null;
  const seen = new Set(); let id = s.id;
  while (id && !seen.has(id)) {
    seen.add(id);
    const nd = nodeOf(g, id);
    if (nd && ['message', 'question'].includes(nd.type)) return nd;
    const o = outOf(g, id); id = o.length ? (o.find((e) => !e.label) || o[0]).to : null;
  }
  return null;
}
function reachable(g, from) {
  const seen = new Set([from]), q = [from];
  while (q.length) { const u = q.shift(); for (const e of outOf(g, u)) if (!seen.has(e.to)) { seen.add(e.to); q.push(e.to); } }
  return seen;
}
function reaches(g, from, target, stopTypes) {
  const seen = new Set(), q = [from];
  while (q.length) {
    const u = q.shift();
    if (u === target) return true;
    if (seen.has(u)) continue; seen.add(u);
    const nd = nodeOf(g, u);
    if (!nd || stopTypes.has(nd.type)) continue;
    if (DECISION.has(nd.type) && u !== from) continue; // another question gives the customer a new way out
    for (const e of outOf(g, u)) q.push(e.to);
  }
  return false;
}

/* ------------------------------------------------------------------ exports */
const mq = (s) => String(s || '').replace(/"/g, '#quot;').replace(/\n/g, ' ');
export function toMermaid(g) {
  const shape = { start: ['(["', '"])'], message: ['["', '"]'], question: ['{"', '"}'], check: ['{{"', '"}}'], action: ['[["', '"]]'], handoff: ['[/"', '"/]'], end: ['(["', '"])'] };
  const L = ['flowchart TD'];
  for (const nd of g.nodes) { const [a, b] = shape[nd.type] || shape.message; L.push(`  ${nd.id}${a}${mq(nd.text)}${b}`); }
  for (const e of g.edges) L.push(e.label ? `  ${e.from} -->|"${mq(e.label)}"| ${e.to}` : `  ${e.from} --> ${e.to}`);
  return L.join('\n');
}
export function toJson(state, g) {
  return JSON.stringify({
    format: 'analyst-kit/journey', version: 1,
    intent: state.intent, channel: state.channel, solved: state.solved || '', handoffRule: state.handoff || '',
    utterances: String(state.utterances || '').split('\n').map((x) => x.trim()).filter(Boolean),
    nodes: g.nodes.map(({ id, type, text, options, x, y }) => ({ id, type, text, options: options || [], x, y })),
    edges: g.edges.map(({ id, from, to, label }) => ({ id, from, to, label, fallback: isFallback(label) })),
  }, null, 2);
}
/** Parse an exported journey back (Import JSON). Throws on a wrong file. */
export function fromJson(text) {
  const d = JSON.parse(text);
  if (!d || !Array.isArray(d.nodes) || !Array.isArray(d.edges)) throw new Error('not-journey');
  const nodes = d.nodes.filter((x) => x && x.id && TYPES.includes(x.type)).map((x) => ({ id: String(x.id), type: x.type, text: String(x.text || ''), options: Array.isArray(x.options) ? x.options.map(String) : [], x: +x.x || 0, y: +x.y || 0 }));
  const ids = new Set(nodes.map((x) => x.id));
  const edges = d.edges.filter((e) => e && ids.has(String(e.from)) && ids.has(String(e.to))).map((e, i) => ({ id: String(e.id || 'e' + (i + 1)), from: String(e.from), to: String(e.to), label: String(e.label || '') }));
  return { meta: { intent: d.intent || '', channel: ['chat', 'voice', 'app'].includes(d.channel) ? d.channel : 'chat', solved: d.solved || '', handoff: d.handoffRule || '', utterances: (d.utterances || []).join('\n') }, graph: { nodes, edges } };
}

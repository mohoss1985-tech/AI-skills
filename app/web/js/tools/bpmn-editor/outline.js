/* Indented step outline → tree. Shared by the BPMN editor and the Journey builder (owner E). Pure, no DOM.

   One step per line. A decision (a line the tool recognises as a question) can have branches on the lines below it,
   indented, written "Label → step" (also "->" or "=>"). Branch steps chain in order: either repeat the label
   ("Yes → step 2") or indent the next line deeper than the branch line. Branches nest. An empty step after the arrow
   ("Yes →") means "go on with the next step below". "@name" or "@id" jumps to a step defined elsewhere (loops, retries).
   "[id] step" gives a step an id for such jumps. Lines starting with "#" or "//" are comments.

     Merchant terminal: Send authorisation request
     VisaNet: Issuer available?
       Yes → Issuer: Check card status, funds, limits, fraud
       No → VisaNet: Stand-In Processing
       No → VisaNet: Send STIP advice to issuer
     VisaNet: Approved?

   parseOutline(text, isDecision(body) → bool) → {items, problems}
     item = {line, body, id, goto, branches: [{label, items}]}
   walkOutline(items, hooks) builds a graph from the tree with the tail/merge logic both tools use. */

const ARROW = /^(.*?)\s*(?:→|->|=>)\s*(.*)$/;

export function tokenize(text) {
  const out = [];
  String(text || '').replace(/\r\n?/g, '\n').split('\n').forEach((raw, i) => {
    if (!raw.trim()) return;
    const lead = raw.match(/^[\t ]*/)[0];
    let indent = 0;
    for (const ch of lead) indent += ch === '\t' ? 2 : 1;
    let s = raw.trim();
    if (/^(#|\/\/)/.test(s)) return;
    let bullet = false;
    const b = s.match(/^[-•]\s+(.*)$/);
    if (b) { s = b[1]; bullet = true; }
    let label = null;
    if (indent > 0 || bullet) {
      const m = s.match(ARROW);
      if (m) { label = m[1].trim(); s = m[2].trim(); }
    }
    out.push({ line: i + 1, indent, label, body: s });
  });
  return out;
}

function splitBody(body) {
  let s = body, id = null, goto = null;
  const g = s.match(/^@\s*(.+)$/);
  if (g) return { id, goto: g[1].trim(), body: '' };
  const m = s.match(/^\[([\w.-]{1,32})\]\s*(.*)$/);
  if (m) { id = m[1]; s = m[2]; }
  return { id, goto, body: s.trim() };
}

export function parseOutline(text, isDecision) {
  const problems = [];
  const items = [];
  const stack = [{ indent: -1, items, kind: 'root' }];
  for (const tok of tokenize(text)) {
    const parts = splitBody(tok.body);
    const mk = () => ({ line: tok.line, ...parts, branches: [] });
    if (tok.label !== null) {
      while (stack.length > 1 && stack[stack.length - 1].indent > tok.indent) stack.pop();
      let top = stack[stack.length - 1];
      const same = (c) => c.kind === 'branch' && c.indent === tok.indent;
      if (same(top) && top.label.toLowerCase() === tok.label.toLowerCase()) {
        if (parts.body || parts.goto) top.items.push(mk());   // repeated label: next step of the same branch
        continue;
      }
      let owner;
      if (same(top)) { stack.pop(); owner = top.owner; top = stack[stack.length - 1]; } // sibling branch
      else owner = top.items[top.items.length - 1];
      if (!owner || owner.goto || !isDecision(owner.body)) {
        problems.push({ code: 'branchNoDecision', line: tok.line, label: tok.label });
        if (parts.body || parts.goto) top.items.push(mk());
        continue;
      }
      let br = owner.branches.find((x) => x.label.toLowerCase() === tok.label.toLowerCase());
      if (!br) { br = { label: tok.label, items: [] }; owner.branches.push(br); }
      stack.push({ indent: tok.indent, items: br.items, kind: 'branch', label: tok.label, owner });
      if (parts.body || parts.goto) br.items.push(mk());
    } else {
      while (stack.length > 1 && stack[stack.length - 1].indent >= tok.indent) stack.pop();
      if (!parts.body && !parts.goto) continue;
      stack[stack.length - 1].items.push(mk());
    }
  }
  return { items, problems };
}

/** Walk the tree and wire a graph.
    hooks.node(item) → {id, terminal, decision}   create the node for an item (terminal = end/hand-off: closes the path)
    hooks.edge(fromId, toId, label)               add a flow
    hooks.join(tails, targetId) → bool            optional: true if it handled several incoming tails itself (merge gateway)
    hooks.resolve(ref) → id | null                 resolve "@ref" after the walk
    Returns {tails, gotos: [{from, label, ref, line}], first} (open tails = paths that still need an end). */
export function walkOutline(items, hooks, start = []) {
  const gotos = [];
  let first = null;
  const connect = (tails, to) => {
    if (tails.length > 1 && hooks.join && hooks.join(tails, to)) return;
    for (const t of tails) hooks.edge(t.id, to, t.label || '');
  };
  const seq = (list, tails) => {
    for (const it of list) {
      if (it.goto) {
        for (const t of tails) gotos.push({ from: t.id, label: t.label || '', ref: it.goto, line: it.line });
        tails = [];
        continue;
      }
      const n = hooks.node(it);
      if (!first) first = n.id;
      connect(tails, n.id);
      tails = n.terminal ? [] : [{ id: n.id, label: '' }];
      if (n.decision && it.branches.length) {
        const next = [];
        for (const br of it.branches) next.push(...seq(br.items, [{ id: n.id, label: br.label }]));
        tails = next;
      }
    }
    return tails;
  };
  const tails = seq(items, start);
  const unresolved = [];
  for (const g of gotos) {
    const to = hooks.resolve(g.ref);
    if (to) hooks.edge(g.from, to, g.label); else unresolved.push(g);
  }
  return { tails, unresolved, first };
}

/** Longest-path layering from the starts, ignoring loop-back edges (port of build_bpmn.py layer()). */
export function layer(ids, edges, starts) {
  const out = new Map(ids.map((i) => [i, []]));
  for (const e of edges) if (out.has(e.from) && out.has(e.to)) out.get(e.from).push(e.to);
  const back = new Set(), state = new Map();
  const dfs = (u) => {
    state.set(u, 1);
    for (const v of out.get(u)) {
      if (state.get(v) === 1) back.add(u + '\u0000' + v);
      else if (!state.has(v)) dfs(v);
    }
    state.set(u, 2);
  };
  for (const s of [...(starts.length ? starts : ids.slice(0, 1)), ...ids]) if (!state.has(s)) dfs(s);
  const indeg = new Map(ids.map((i) => [i, 0]));
  for (const u of ids) for (const v of out.get(u)) if (!back.has(u + '\u0000' + v)) indeg.set(v, indeg.get(v) + 1);
  const col = new Map(ids.map((i) => [i, 0]));
  const q = ids.filter((u) => indeg.get(u) === 0);
  while (q.length) {
    const u = q.shift();
    for (const v of out.get(u)) {
      if (back.has(u + '\u0000' + v)) continue;
      col.set(v, Math.max(col.get(v), col.get(u) + 1));
      indeg.set(v, indeg.get(v) - 1);
      if (indeg.get(v) === 0) q.push(v);
    }
  }
  return { col, back: (u, v) => back.has(u + '\u0000' + v) };
}

/** Lower-case, no accents, no punctuation: for matching names and replies. */
export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

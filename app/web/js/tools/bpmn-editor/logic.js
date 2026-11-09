/* BPMN editor logic (owner E). Pure functions, no DOM: runs in the browser and in node (logic.test.mjs).
   stepsToSpec(input)  Process name · Actors · Steps (outline, see outline.js) → build_bpmn.py spec + problems
   buildXml(spec)      port of skills/modeling-processes/scripts/build_bpmn.py (layout, lanes, colours, labels)
   modelFromXml(xml)   any BPMN 2.0 XML → {pools, lanes, nodes, flows} (regex scanner, any namespace prefix)
   lint(model)         validation hints (missing start/end, gateway exits without labels, dead ends…)
   stepRows(model)     the step table, in flow order */
import { layer, norm, parseOutline, walkOutline } from './outline.js';

/* ------------------------------------------------------------------ steps → spec */
const MARKER = /^\((start|début|debut|end|fin|error|erreur|wait|attente|timer|message)\)\s*(.*)$/i;
const SEND = /^(send|notify|inform|email|transmit|envoyer|notifier|informer|transmettre)\b/i;
const RECEIVE = /^(receive|get back|recevoir|réceptionner|receptionner)\b/i;

export const isQuestion = (body) => {
  const t = String(body || '').replace(/^\[[\w.-]+\]\s*/, '').trim();
  return t.endsWith('?') && !MARKER.test(t.replace(/^[^:]*:\s*/, ''));
};

export function splitActors(text) {
  const out = [];
  let cur = '', depth = 0;
  for (const ch of String(text || '')) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';' || ch === '\n') && !depth) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

/** "Actor: text" (FR "Acteur : texte" too). Returns {actor|null, text}. */
export function splitActor(body) {
  const m = String(body).match(/^([^:?[\]()\s][^:?[\]]{0,59}?)\s*:\s*(.+)$/);
  return m ? { actor: m[1].trim(), text: m[2].trim() } : { actor: null, text: String(body).trim() };
}

/** input = {title, actors, steps, trigger, happyEnd, pool}; words = {start, end} default names (translated by the caller). */
export function stepsToSpec(input, words = { start: 'Start', end: 'End' }) {
  const problems = [];
  const lanes = [];
  const laneOf = new Map();
  const addLane = (name, declared) => {
    const k = norm(name);
    if (laneOf.has(k)) return laneOf.get(k);
    const id = 'L' + (lanes.length + 1);
    lanes.push({ id, name });
    laneOf.set(k, id);
    if (!declared) problems.push({ code: 'laneAdded', name });
    return id;
  };
  splitActors(input.actors).forEach((a) => addLane(a, true));
  const { items, problems: op } = parseOutline(input.steps, isQuestion);
  problems.push(...op);
  if (!items.length) return { spec: null, problems: [...problems, { code: 'noSteps' }] };

  const nodes = [], flows = [];
  const byRef = new Map(); // explicit id and normalised name → node id
  let n = 0, lastLane = null;
  const newId = (p) => `${p}${++n}`;
  const nodeFor = (it) => {
    let { actor, text } = splitActor(it.body);
    let lane = actor ? addLane(actor, false) : lastLane;
    if (!lane) lane = lanes[0] ? lanes[0].id : addLane(words.actor || 'Actor', false);
    lastLane = lane;
    let type = 'task', trigger = null;
    const mk = text.match(MARKER);
    if (mk) {
      const k = mk[1].toLowerCase();
      text = mk[2].trim();
      type = { start: 'start', 'début': 'start', debut: 'start', end: 'end', fin: 'end', error: 'error_end', erreur: 'error_end', wait: 'timer', attente: 'timer', timer: 'timer', message: 'message' }[k];
    } else if (text.endsWith('?')) type = 'exclusive';
    else if (SEND.test(text)) type = 'send';
    else if (RECEIVE.test(text)) type = 'receive';
    const id = newId(type === 'exclusive' ? 'Gateway_' : type === 'start' || type === 'end' || type === 'error_end' || type === 'timer' || type === 'message' ? 'Event_' : 'Activity_');
    const node = { id, type, name: text, lane, line: it.line };
    if (trigger) node.trigger = trigger;
    nodes.push(node);
    if (it.id) byRef.set('#' + it.id.toLowerCase(), id);
    if (!byRef.has(norm(text))) byRef.set(norm(text), id);
    return node;
  };

  // start event
  let startTails = [];
  const firstIt = items[0];
  const firstIsStart = !firstIt.goto && MARKER.test(splitActor(firstIt.body).text) && /^\((start|début|debut)\)/i.test(splitActor(firstIt.body).text);
  if (!firstIsStart) {
    const fa = firstIt.goto ? null : splitActor(firstIt.body).actor;
    const lane = lanes[0] ? lanes[0].id : fa ? addLane(fa, false) : addLane(words.actor || 'Actor', false);
    const s = { id: newId('Event_'), type: 'start', name: (input.trigger || '').trim() || words.start, lane };
    nodes.push(s);
    startTails = [{ id: s.id, label: '' }];
  }
  const kindOf = (id) => KIND[nodes.find((x) => x.id === id).type] || 'activity';
  const edge = (from, to, label) => flows.push({ id: 'Flow_' + (flows.length + 1), from, to, label: label || '' });
  const { tails, unresolved } = walkOutline(items, {
    node(it) {
      const nd = nodeFor(it);
      return { id: nd.id, terminal: nd.type === 'end' || nd.type === 'error_end', decision: nd.type === 'exclusive' };
    },
    edge,
    join(tails, to) {
      if (kindOf(to) === 'gateway') return false;
      const target = nodes.find((x) => x.id === to);
      const g = { id: newId('Gateway_'), type: 'exclusive', name: '', lane: target.lane, merge: true };
      nodes.splice(nodes.indexOf(target), 0, g);
      for (const t of tails) edge(t.id, g.id, t.label);
      edge(g.id, to, '');
      return true;
    },
    resolve(ref) {
      const r = ref.trim();
      if (byRef.has('#' + r.toLowerCase())) return byRef.get('#' + r.toLowerCase());
      const k = norm(r);
      if (byRef.has(k)) return byRef.get(k);
      const hit = nodes.find((x) => x.name && norm(x.name).startsWith(k));
      return hit ? hit.id : null;
    },
  }, startTails);
  for (const u of unresolved) problems.push({ code: 'gotoUnknown', line: u.line, ref: u.ref });
  if (tails.length) {
    const lastLane2 = nodes.find((x) => x.id === tails[tails.length - 1].id).lane;
    const e = { id: newId('Event_'), type: 'end', name: (input.happyEnd || '').trim() || words.end, lane: lastLane2 };
    nodes.push(e);
    if (tails.length > 1) {
      const g = { id: newId('Gateway_'), type: 'exclusive', name: '', lane: lastLane2, merge: true };
      nodes.splice(nodes.length - 1, 0, g);
      for (const t of tails) edge(t.id, g.id, t.label);
      edge(g.id, e.id, '');
    } else edge(tails[0].id, e.id, tails[0].label);
  }
  // keep only lanes in use plus declared ones (declared empty lanes are reported by lint, not dropped)
  const pool = [input.pool, input.title].map((x) => String(x || '').trim()).filter(Boolean).join(' · ') || words.process || 'Process';
  return { spec: { pool, lanes, nodes, flows }, problems };
}

/* ------------------------------------------------------------------ spec → XML (port of build_bpmn.py) */
const COL_W = 190, ROW_H = 130, POOL_HEAD = 34, LANE_HEAD = 34, X0 = 40, Y0 = 40;
const SIZE = { event: [36, 36], gateway: [50, 50], activity: [130, 80] };
const KIND = { start: 'event', end: 'event', error_end: 'event', timer: 'event', message: 'event', exclusive: 'gateway', parallel: 'gateway', inclusive: 'gateway', event_gateway: 'gateway' };
const TAG = { start: 'startEvent', end: 'endEvent', error_end: 'endEvent', timer: 'intermediateCatchEvent', message: 'intermediateCatchEvent', task: 'task', user: 'userTask', service: 'serviceTask', send: 'sendTask', receive: 'receiveTask', manual: 'manualTask', subprocess: 'subProcess', exclusive: 'exclusiveGateway', parallel: 'parallelGateway', inclusive: 'inclusiveGateway', event_gateway: 'eventBasedGateway' };
// (fill, stroke): one meaning per colour (diagram data, written into the BPMN file like build_bpmn.py does)
const PALETTE = { start: ['#e7f6ec', '#1f7a45'], end: ['#fdecec', '#b42318'], error_end: ['#fdecec', '#b42318'], timer: ['#f1ebfb', '#6941c6'], message: ['#f1ebfb', '#6941c6'], gateway: ['#fff6e0', '#b54708'], activity: ['#e8f0fe', '#1d4ed8'], subprocess: ['#eef2f6', '#344054'] };
const LANE_TINTS = ['#f8fafc', '#fcfcfd'];
const kind = (t) => KIND[t] || 'activity';
const colour = (t) => PALETTE[t] || PALETTE[kind(t)] || PALETTE.activity;
export const xmlEsc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r0 = (x) => Math.round(x);

export function validateSpec(spec) {
  const laneIds = new Set(spec.lanes.map((l) => l.id)), ids = new Set(spec.nodes.map((n) => n.id));
  return [
    ...spec.nodes.filter((n) => !laneIds.has(n.lane)).map((n) => `node ${n.id}: unknown lane ${n.lane}`),
    ...spec.flows.filter((f) => !ids.has(f.from) || !ids.has(f.to)).map((f) => `flow ${f.from}->${f.to}: unknown node`),
    ...spec.nodes.filter((n) => !TAG[n.type]).map((n) => `node ${n.id}: unknown type ${n.type}`),
  ];
}

export function buildXml(spec) {
  const errs = validateSpec(spec);
  if (errs.length) throw new Error('Spec errors: ' + errs.join('; '));
  const { lanes, nodes, flows } = spec;
  const ids = nodes.map((n) => n.id);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const { col, back } = layer(ids, flows, nodes.filter((n) => n.type === 'start').map((n) => n.id));
  const laneIdx = new Map(lanes.map((l, i) => [l.id, i]));
  const slot = new Map(), used = new Map();
  const sorted = [...nodes].sort((a, b) => col.get(a.id) - col.get(b.id) || laneIdx.get(a.lane) - laneIdx.get(b.lane));
  for (const nd of sorted) {
    const k = nd.lane + '|' + col.get(nd.id);
    slot.set(nd.id, used.get(k) || 0);
    used.set(k, (used.get(k) || 0) + 1);
  }
  const cols = [...new Set(col.values())];
  const rows = new Map(lanes.map((l) => [l.id, Math.max(1, ...cols.map((c) => used.get(l.id + '|' + c) || 0))]));
  const left = X0 + POOL_HEAD + LANE_HEAD;
  const ncols = Math.max(0, ...col.values()) + 1;
  const width = POOL_HEAD + LANE_HEAD + ncols * COL_W + 40;
  const laneY = new Map();
  let y = Y0;
  for (const l of lanes) { laneY.set(l.id, [y, rows.get(l.id) * ROW_H]); y += rows.get(l.id) * ROW_H; }
  const height = y - Y0;
  const box = new Map();
  for (const nd of nodes) {
    const [w, h] = SIZE[kind(nd.type)];
    const [ly] = laneY.get(nd.lane);
    const cx = left + col.get(nd.id) * COL_W + COL_W / 2;
    const cy = ly + slot.get(nd.id) * ROW_H + ROW_H / 2;
    box.set(nd.id, [cx - w / 2, cy - h / 2, w, h]);
  }
  const mid = (i) => { const [bx, by, bw, bh] = box.get(i); return [bx + bw / 2, by + bh / 2]; };
  const exits = new Map(), under = new Set();
  const exitSet = (i) => { if (!exits.has(i)) exits.set(i, new Set()); return exits.get(i); };
  const edgePoints = (f) => {
    const [sx, sy, sw, sh] = box.get(f.from), [tx, ty, tw, th] = box.get(f.to);
    const [scx, scy] = mid(f.from), [tcx, tcy] = mid(f.to);
    if (back(f.from, f.to) || tcx <= scx) {
      const yb = Math.max(sy + sh, ty + th) + 18;
      return [[scx, sy + sh], [scx, yb], [tcx, yb], [tcx, ty + th]];
    }
    if (Math.abs(scy - tcy) < 1) {
      const blocked = ids.some((o) => o !== f.from && o !== f.to && Math.abs(mid(o)[1] - scy) < 1 && scx < mid(o)[0] && mid(o)[0] < tcx);
      if (!blocked) return [[sx + sw, scy], [tx, tcy]];
      const yb = scy - ROW_H / 2 + ROW_H - 12;
      exitSet(f.from).add('bottom');
      under.add(f.id);
      return [[scx, sy + sh], [scx, yb], [tcx, yb], [tcx, ty + th]];
    }
    const side = tcy < scy ? 'top' : 'bottom';
    if (kind(byId.get(f.from).type) === 'gateway' && !exitSet(f.from).has(side)) {
      exitSet(f.from).add(side);
      return [[scx, side === 'top' ? sy : sy + sh], [scx, tcy], [tx, tcy]];
    }
    const midx = tx - 30;
    return [[sx + sw, scy], [midx, scy], [midx, tcy], [tx, tcy]];
  };
  const attrs = (t) => { const [fill, stroke] = colour(t); return ` bioc:stroke="${stroke}" bioc:fill="${fill}" color:background-color="${fill}" color:border-color="${stroke}"`; };
  const laneRefs = new Map(lanes.map((l) => [l.id, []]));
  for (const nd of nodes) laneRefs.get(nd.lane).push(nd.id);
  const inc = new Map(ids.map((i) => [i, []])), outg = new Map(ids.map((i) => [i, []]));
  flows.forEach((f, i) => { f.id = f.id || `Flow_${i + 1}`; outg.get(f.from).push(f.id); inc.get(f.to).push(f.id); });
  const sem = [];
  for (const nd of nodes) {
    const tag = TAG[nd.type] || 'task';
    let inner = inc.get(nd.id).map((x) => `<bpmn:incoming>${x}</bpmn:incoming>`).join('') + outg.get(nd.id).map((x) => `<bpmn:outgoing>${x}</bpmn:outgoing>`).join('');
    const trig = nd.trigger || { timer: 'timer', message: 'message', error_end: 'error' }[nd.type];
    if (trig === 'timer') inner += '<bpmn:timerEventDefinition/>';
    else if (trig === 'message') inner += '<bpmn:messageEventDefinition/>';
    else if (trig === 'error') inner += '<bpmn:errorEventDefinition/>';
    sem.push(`    <bpmn:${tag} id="${nd.id}"${nd.name ? ` name="${xmlEsc(nd.name)}"` : ''}>${inner}</bpmn:${tag}>`);
  }
  for (const f of flows) sem.push(`    <bpmn:sequenceFlow id="${f.id}" sourceRef="${f.from}" targetRef="${f.to}"${f.label ? ` name="${xmlEsc(f.label)}"` : ''}/>`);
  const laneXml = lanes.map((l) => `      <bpmn:lane id="Lane_${l.id}" name="${xmlEsc(l.name)}">${laneRefs.get(l.id).map((r) => `<bpmn:flowNodeRef>${r}</bpmn:flowNodeRef>`).join('')}</bpmn:lane>`).join('\n');
  const di = [`      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true" bioc:stroke="#344054" bioc:fill="#ffffff" color:border-color="#344054" color:background-color="#ffffff"><dc:Bounds x="${X0}" y="${Y0}" width="${width}" height="${height}"/></bpmndi:BPMNShape>`];
  lanes.forEach((l, i) => {
    const [ly, lh] = laneY.get(l.id), tint = LANE_TINTS[i % 2];
    di.push(`      <bpmndi:BPMNShape id="Lane_${l.id}_di" bpmnElement="Lane_${l.id}" isHorizontal="true" bioc:stroke="#475467" bioc:fill="${tint}" color:border-color="#475467" color:background-color="${tint}"><dc:Bounds x="${X0 + POOL_HEAD}" y="${ly}" width="${width - POOL_HEAD}" height="${lh}"/></bpmndi:BPMNShape>`);
  });
  for (const nd of nodes) {
    const [x, yy, w, h] = box.get(nd.id);
    let label = '';
    if (kind(nd.type) !== 'activity' && nd.name) {
      const lw = 110, ly = kind(nd.type) === 'gateway' ? yy - 34 : yy + h + 6;
      label = `<bpmndi:BPMNLabel><dc:Bounds x="${r0(x + w / 2 - lw / 2)}" y="${r0(ly)}" width="${lw}" height="27"/></bpmndi:BPMNLabel>`;
    }
    const expanded = nd.type === 'subprocess' ? ' isExpanded="false"' : '';
    const isMarker = kind(nd.type) === 'gateway' ? ' isMarkerVisible="true"' : '';
    di.push(`      <bpmndi:BPMNShape id="${nd.id}_di" bpmnElement="${nd.id}"${expanded}${isMarker}${attrs(nd.type)}><dc:Bounds x="${r0(x)}" y="${r0(yy)}" width="${w}" height="${h}"/>${label}</bpmndi:BPMNShape>`);
  }
  for (const f of flows) {
    const pts = edgePoints(f);
    const wps = pts.map(([px, py]) => `<di:waypoint x="${r0(px)}" y="${r0(py)}"/>`).join('');
    let label = '';
    if (f.label) {
      const [[ax, ay], [bx, by]] = under.has(f.id) ? [pts[1], pts[2]] : [pts[0], pts[1]];
      const [lx, lyy] = Math.abs(ax - bx) < 1 ? [ax + 6, (ay + by) / 2 - 7] : under.has(f.id) ? [ax + 24, ay - 18] : [(ax + bx) / 2 - 15, ay - 20];
      label = `<bpmndi:BPMNLabel><dc:Bounds x="${r0(lx)}" y="${r0(lyy)}" width="${Math.max(40, Math.min(120, f.label.length * 7))}" height="14"/></bpmndi:BPMNLabel>`;
    }
    di.push(`      <bpmndi:BPMNEdge id="${f.id}_di" bpmnElement="${f.id}" bioc:stroke="#475467" color:border-color="#475467">${wps}${label}</bpmndi:BPMNEdge>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0"
  xmlns:color="http://www.omg.org/spec/BPMN/non-normative/color/1.0"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn" exporter="Analyst Kit" exporterVersion="2.0">
  <bpmn:collaboration id="Collaboration_1">
    <bpmn:participant id="Participant_1" name="${xmlEsc(spec.pool || 'Process')}" processRef="Process_1"/>
  </bpmn:collaboration>
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">
${laneXml}
    </bpmn:laneSet>
${sem.join('\n')}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
${di.join('\n')}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`;
}

/* ------------------------------------------------------------------ XML → model */
const NODE_TAGS = {
  startEvent: 'start', endEvent: 'end', intermediateCatchEvent: 'catch', intermediateThrowEvent: 'throw', boundaryEvent: 'boundary',
  task: 'task', userTask: 'user', serviceTask: 'service', sendTask: 'send', receiveTask: 'receive', manualTask: 'manual',
  scriptTask: 'script', businessRuleTask: 'rule', callActivity: 'call', subProcess: 'subprocess', transaction: 'subprocess', adHocSubProcess: 'subprocess',
  exclusiveGateway: 'exclusive', parallelGateway: 'parallel', inclusiveGateway: 'inclusive', eventBasedGateway: 'event_gateway', complexGateway: 'complex',
};
export const GROUP = (type) => (['start', 'end', 'catch', 'throw', 'boundary'].includes(type) ? 'event'
  : ['exclusive', 'parallel', 'inclusive', 'event_gateway', 'complex'].includes(type) ? 'gateway' : 'activity');
const unesc = (s) => String(s || '').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attrsOf = (s) => { const a = {}; s.replace(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g, (_, k, __, v1, v2) => { a[k.replace(/^.*:/, '')] = unesc(v1 ?? v2); return ''; }); return a; };

export function modelFromXml(xml) {
  const src = String(xml || '');
  if (!/<(?:[\w-]+:)?definitions[\s>]/.test(src)) throw new Error('not-bpmn');
  const nodes = [], flows = [], lanes = [], pools = [];
  const laneStack = [];
  let openNode = null, openFlow = null, openShape = null, refTarget = null;
  const pos = new Map();
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<(\/?)(?:[\w-]+:)?([\w-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  let m;
  while ((m = re.exec(src))) {
    if (!m[2]) continue;
    const close = m[1] === '/', tag = m[2], self = m[4] === '/';
    if (close) {
      if (tag === 'lane') laneStack.pop();
      else if (tag === 'sequenceFlow') openFlow = null;
      else if (NODE_TAGS[tag] && openNode && openNode.tag === tag) openNode = null;
      else if (tag === 'BPMNShape') openShape = null;
      continue;
    }
    const a = attrsOf(m[3] || '');
    if (tag === 'participant') pools.push({ id: a.id, name: a.name || '', processRef: a.processRef || '' });
    else if (tag === 'lane') { const l = { id: a.id, name: a.name || '', refs: [] }; lanes.push(l); if (!self) laneStack.push(l); }
    else if (tag === 'flowNodeRef') {
      const end = src.indexOf('<', re.lastIndex);
      const ref = src.slice(re.lastIndex, end).trim();
      if (ref && laneStack.length) laneStack[laneStack.length - 1].refs.push(ref);
    } else if (NODE_TAGS[tag]) {
      const nd = { id: a.id, tag, type: NODE_TAGS[tag], name: (a.name || '').trim(), attachedTo: a.attachedToRef || null, trigger: null, isDefault: a.default || null };
      nodes.push(nd);
      if (!self) openNode = nd;
    } else if (/EventDefinition$/.test(tag) && openNode) openNode.trigger = tag.replace(/EventDefinition$/, '');
    else if (tag === 'sequenceFlow') {
      const f = { id: a.id, from: a.sourceRef, to: a.targetRef, label: (a.name || '').trim(), condition: false };
      flows.push(f);
      if (!self) openFlow = f;
    } else if (tag === 'conditionExpression' && openFlow) openFlow.condition = true;
    else if (tag === 'BPMNShape') { openShape = a.bpmnElement; refTarget = openShape; }
    else if (tag === 'Bounds' && openShape && !pos.has(openShape)) { pos.set(openShape, { x: +a.x || 0, y: +a.y || 0 }); openShape = null; }
  }
  void refTarget;
  const laneOf = new Map();
  for (const l of lanes) for (const r of l.refs) laneOf.set(r, l.name || l.id);
  for (const nd of nodes) {
    nd.lane = laneOf.get(nd.id) || null;
    nd.x = pos.has(nd.id) ? pos.get(nd.id).x : null;
    nd.y = pos.has(nd.id) ? pos.get(nd.id).y : null;
  }
  // the gateway's default flow counts as labelled ("otherwise")
  for (const nd of nodes) if (nd.isDefault) { const f = flows.find((x) => x.id === nd.isDefault); if (f) f.isDefault = true; }
  return { pools, lanes, nodes, flows };
}

/* ------------------------------------------------------------------ lint */
/** → [{code, level: 'bad'|'warn'|'info', ids: [...], name, n}]. Codes are i18n keys (lint.<code>). */
export function lint(model) {
  const out = [];
  const { nodes, flows, lanes } = model;
  const inc = new Map(nodes.map((n) => [n.id, []])), outg = new Map(nodes.map((n) => [n.id, []]));
  for (const f of flows) { if (outg.has(f.from)) outg.get(f.from).push(f); if (inc.has(f.to)) inc.get(f.to).push(f); }
  const starts = nodes.filter((n) => n.type === 'start'), ends = nodes.filter((n) => n.type === 'end');
  if (!nodes.length) return [{ code: 'empty', level: 'info', ids: [] }];
  if (!starts.length) out.push({ code: 'noStart', level: 'bad', ids: [] });
  if (!ends.length) out.push({ code: 'noEnd', level: 'bad', ids: [] });
  for (const nd of nodes) {
    const o = outg.get(nd.id), i = inc.get(nd.id), g = GROUP(nd.type);
    if (g === 'gateway' && o.length >= 2 && ['exclusive', 'inclusive', 'complex'].includes(nd.type)) {
      const missing = o.filter((f) => !f.label && !f.condition && !f.isDefault).length;
      if (missing) out.push({ code: 'gwUnlabelled', level: 'warn', ids: [nd.id], name: nd.name, n: missing });
      if (!nd.name) out.push({ code: 'gwNoQuestion', level: 'info', ids: [nd.id], n: o.length });
    }
    if (g === 'gateway' && o.length === 1 && i.length === 1) out.push({ code: 'gwSingle', level: 'info', ids: [nd.id], name: nd.name });
    if (nd.type !== 'end' && !o.length && !(nd.type === 'boundary' && false)) out.push({ code: 'deadEnd', level: 'warn', ids: [nd.id], name: nd.name });
    if (nd.type !== 'start' && nd.type !== 'boundary' && !i.length && !(nd.type === 'catch' && nd.trigger)) out.push({ code: 'orphan', level: 'warn', ids: [nd.id], name: nd.name });
    if (g === 'activity' && !nd.name) out.push({ code: 'taskNoName', level: 'warn', ids: [nd.id] });
    if (nd.type === 'end' && !nd.name) out.push({ code: 'endNoName', level: 'info', ids: [nd.id] });
    if (lanes.length && !nd.lane && nd.type !== 'boundary') out.push({ code: 'noLane', level: 'info', ids: [nd.id], name: nd.name });
  }
  for (const l of lanes) if (!l.refs.length) out.push({ code: 'emptyLane', level: 'info', ids: [l.id], name: l.name });
  const acts = nodes.filter((n) => GROUP(n.type) === 'activity').length;
  if (acts > 15) out.push({ code: 'tooMany', level: 'info', ids: [], n: acts });
  // reachability from the starts
  if (starts.length) {
    const seen = new Set(starts.map((s) => s.id)), q = [...seen];
    while (q.length) { const u = q.shift(); for (const f of outg.get(u) || []) if (!seen.has(f.to)) { seen.add(f.to); q.push(f.to); } }
    for (const nd of nodes) if (nd.type === 'boundary' && seen.has(nd.attachedTo) && !seen.has(nd.id)) { seen.add(nd.id); q.push(nd.id); while (q.length) { const u = q.shift(); for (const f of outg.get(u) || []) if (!seen.has(f.to)) { seen.add(f.to); q.push(f.to); } } }
    const cut = nodes.filter((n) => !seen.has(n.id) && inc.get(n.id).length);
    if (cut.length) out.push({ code: 'unreachable', level: 'warn', ids: cut.map((n) => n.id), n: cut.length });
  }
  const rank = { bad: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

/* ------------------------------------------------------------------ step table */
/** Rows in flow order (BFS from the starts, then by x): {n, id, type, name, lane, next: [{name, label}]}. Merge gateways
    (no name, one exit) are kept: the user may have added them on purpose. */
export function stepRows(model) {
  const { nodes, flows } = model;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outg = new Map(nodes.map((n) => [n.id, []]));
  for (const f of flows) if (outg.has(f.from)) outg.get(f.from).push(f);
  const order = [], seen = new Set();
  const q = nodes.filter((n) => n.type === 'start').sort((a, b) => (a.x ?? 0) - (b.x ?? 0)).map((n) => n.id);
  q.forEach((i) => seen.add(i));
  while (q.length) {
    const u = q.shift(); order.push(u);
    const next = outg.get(u).map((f) => f.to).filter((v) => byId.has(v) && !seen.has(v)).sort((a, b) => (byId.get(a).x ?? 0) - (byId.get(b).x ?? 0));
    for (const v of next) { seen.add(v); q.push(v); }
  }
  for (const nd of [...nodes].sort((a, b) => (a.x ?? 0) - (b.x ?? 0))) if (!seen.has(nd.id)) order.push(nd.id);
  return order.map((id, i) => {
    const nd = byId.get(id);
    return { n: i + 1, id, type: nd.type, trigger: nd.trigger, name: nd.name, lane: nd.lane || '', next: outg.get(id).map((f) => ({ name: (byId.get(f.to) || {}).name || f.to, label: f.label, id: f.to })) };
  });
}

/** Plain-text model for prompts: lanes, elements, flows. */
export function modelText(model) {
  const rows = stepRows(model);
  const L = [`Lanes: ${model.lanes.map((l) => l.name).join(' | ') || '(none)'}`, 'Elements (n | type | lane | name → next [label]):'];
  for (const r of rows) L.push(`${r.n} | ${r.type}${r.trigger ? '/' + r.trigger : ''} | ${r.lane || '-'} | ${r.name || '(unnamed)'} → ${r.next.map((x) => x.name + (x.label ? ` [${x.label}]` : '')).join('; ') || '(none)'}`);
  return L.join('\n');
}

export const csvCell = (v) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

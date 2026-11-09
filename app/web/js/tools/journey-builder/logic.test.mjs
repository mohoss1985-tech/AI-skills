// node app/web/js/tools/journey-builder/logic.test.mjs  (owner E) — parser, checks and test-chat walker on every sample.
import assert from 'node:assert/strict';
import { stepsToGraph, checkGraph, walk, matchReply, toMermaid, toJson, fromJson, outOf } from './logic.js';
import { SAMPLES } from './samples.js';

for (const lang of ['en', 'fr']) for (const s of SAMPLES[lang]) {
  const { graph, problems } = stepsToGraph(s.state);
  assert.deepEqual(problems, [], s.id + ' problems');
  const c = checkGraph(graph, s.state.channel);
  assert.deepEqual(c.filter((x) => x.level !== 'info'), [], s.id + ' checks ' + JSON.stringify(c));
  if (process.argv[2] === s.id) { for (const n of graph.nodes) console.log(n.id, n.type, n.text.slice(0, 50), '→', outOf(graph, n.id).map((e) => `${e.to}${e.label ? '(' + e.label.slice(0, 12) + ')' : ''}`).join(', ')); console.log(c); }
  assert.ok(toMermaid(graph).startsWith('flowchart TD'));
  assert.equal(fromJson(toJson(s.state, graph)).graph.nodes.length, graph.nodes.length);
}
// walk the EN chat: intent → disclosure → check waits
const g = stepsToGraph(SAMPLES.en[0].state).graph;
let w = walk(g, g.nodes[0].id);
assert.deepEqual(w.events.map((e) => e.kind), ['user', 'bot', 'check']);
w = walk(g, matchReply(g, w.wait, 'Yes').edge.to);
assert.equal(w.events.at(-1).node.type, 'question');
const q = w.wait;
assert.equal(matchReply(g, q, 'I think I lost it yesterday').edge.label.startsWith('Lost'), true);
assert.equal(matchReply(g, q, 'my wallet was stolen').edge.label.startsWith('Stolen'), true);
assert.equal(matchReply(g, q, 'asdfgh').fallback, true);
assert.ok(matchReply(g, q, 'asdfgh').edge, 'fallback edge exists');
w = walk(g, matchReply(g, q, 'lost').edge.to);
assert.deepEqual(w.events.map((e) => e.kind), ['action', 'bot', 'bot']);
// unhandled input detected
const bad = stepsToGraph({ intent: 'x', steps: 'Say: hello\nAsk: Lost or stolen? [Lost | Stolen]\n  Lost → End: ok\n  Stolen → End: ok' }).graph;
const codes = checkGraph(bad).map((x) => x.code);
assert.ok(codes.includes('noFallback') && codes.includes('noHandoff') && codes.includes('noDisclosure'), codes.join());
assert.equal(matchReply(bad, bad.nodes[2].id, 'banana').edge, null);
assert.ok(checkGraph(stepsToGraph({ intent: 'x', steps: 'Say: I am an AI\nAsk: What is your card number?\n  * → Handoff: a' }).graph).some((x) => x.code === 'sensitive'));
console.log('ok · journey logic');

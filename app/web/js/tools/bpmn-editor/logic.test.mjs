// node app/web/js/tools/bpmn-editor/logic.test.mjs  (owner E) — generator, layout, XML scanner and lint on every sample.
import assert from 'node:assert/strict';
import { stepsToSpec, buildXml, modelFromXml, lint, stepRows } from './logic.js';
import { SAMPLES } from './samples.js';

let n = 0;
for (const lang of ['en', 'fr']) for (const s of SAMPLES[lang]) {
  const { spec, problems } = stepsToSpec(s.state);
  assert.ok(spec, s.id);
  assert.deepEqual(problems.filter((p) => p.code !== 'laneAdded'), [], s.id + ' problems');
  assert.deepEqual(problems, [], s.id + ' lanes all declared');
  const xml = buildXml(spec);
  const m = modelFromXml(xml);
  assert.equal(m.nodes.length, spec.nodes.length, s.id + ' nodes');
  assert.equal(m.flows.length, spec.flows.length, s.id + ' flows');
  const l = lint(m);
  assert.deepEqual(l.filter((x) => x.level !== 'info'), [], s.id + ' lint ' + JSON.stringify(l));
  const rows = stepRows(m);
  assert.equal(rows[0].type, 'start');
  n++;
  if (process.argv[2] === s.id) { console.log(rows.map((r) => `${r.n} ${r.type} [${r.lane}] ${r.name} -> ${r.next.map((x) => x.name + (x.label ? '(' + x.label + ')' : '')).join(', ')}`).join('\n')); console.log(l); }
}
// lint catches the two hints the brief asks for
const bad = stepsToSpec({ actors: 'A, B', steps: 'A: Do one\nA: Ready?\nB: Do two' }).spec;
bad.nodes = bad.nodes.filter((x) => x.type !== 'end'); bad.flows = bad.flows.filter((f) => bad.nodes.some((x) => x.id === f.to));
bad.flows.push({ id: 'Flow_x', from: bad.nodes.find((x) => x.type === 'exclusive').id, to: bad.nodes[1].id, label: '' });
const codes = lint(modelFromXml(buildXml(bad))).map((x) => x.code);
assert.ok(codes.includes('noEnd') && codes.includes('gwUnlabelled'), codes.join());
// unknown actor → lane added + reported; goto unknown reported
const p = stepsToSpec({ actors: 'A', steps: 'A: x?\n  Yes → @nowhere\nZed: y' }).problems.map((x) => x.code);
assert.ok(p.includes('laneAdded') && p.includes('gotoUnknown'), p.join());
assert.throws(() => modelFromXml('<html/>'));
console.log(`ok · ${n} samples · lint checks`);

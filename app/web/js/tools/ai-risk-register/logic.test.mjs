/* node app/web/js/tools/ai-risk-register/logic.test.mjs [--write-json] */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { classify, registerChecks, heat, score, level, registerCsv, risksFromCsv, nextRid } from './logic.js';
import { SAMPLES } from './samples.js';

assert.equal(classify({ p3: 'yes', h1: 'yes' }).tier, 'prohibited');
assert.equal(classify({ h1: 'yes' }).tier, 'high');
const carve = classify({ h1: 'yes', h2: 'yes', t1: 'yes' });
assert.equal(carve.tier, 'limited'); assert.ok(carve.carveOut);
assert.equal(classify({ h4: 'yes', h6: 'yes' }).tier, 'minimal');          // Art. 6(3) derogation
assert.equal(classify({ h4: 'yes', h6: 'yes', h7: 'yes' }).tier, 'high');  // profiling: no derogation
assert.deepEqual(classify({ p2: 'unsure' }).confirm.map((c) => c.id), ['p2']);
assert.equal(classify({ p2: 'unsure' }).tier, 'minimal');
assert.equal(classify({}).open.length, 16);

const tri = classify(SAMPLES.en[0].state.answers);
assert.equal(tri.tier, 'minimal'); assert.deepEqual(tri.confirm.map((c) => c.id), ['t1', 't2']);
const fs = classify(SAMPLES.en[1].state.answers);
assert.equal(fs.tier, 'minimal'); assert.deepEqual(fs.confirm.map((c) => [c.id, c.why]), [['h1', 'c_h1_fraud']]);
assert.equal(classify(SAMPLES.fr[1].state.answers).tier, 'minimal');

assert.equal(level(score({ likelihood: 4, impact: 5 })), 'high'); assert.equal(level(8), 'medium'); assert.equal(level(6), 'low');
const c2 = registerChecks(SAMPLES.en[1].state.risks);
assert.deepEqual(c2.map((c) => [c.key, c.ids.join()]), [['chkHighCtl', 'R-02'], ['chkHighTest', 'R-01,R-02']]);
assert.deepEqual(heat(SAMPLES.en[1].state.risks)[4][3], ['R-01']);
assert.ok(registerCsv(SAMPLES.en[0].state.risks).split('\r\n')[3].startsWith('R-03,'));
const added = risksFromCsv('risk,likelihood,impact,nist\n"Leaks, PAN",9,2,measure', SAMPLES.en[0].state.risks);
assert.equal(added.at(-1).id, 'R-07'); assert.equal(added.at(-1).likelihood, 5); assert.equal(added.at(-1).nist, 'Measure');
assert.equal(nextRid([]), 'R-01');
for (const l of ['en', 'fr']) for (const s of SAMPLES[l]) assert.ok(!/\b\d{13,19}\b/.test(JSON.stringify(s)), 'no full PAN');
console.log('ai-risk-register logic: all checks pass');
if (process.argv.includes('--write-json')) writeFileSync(new URL('./samples.json', import.meta.url), JSON.stringify(SAMPLES, null, 2) + '\n');

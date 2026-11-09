/* node app/web/js/tools/raci-grid/logic.test.mjs [--write-json] */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { analyse, quadrant, cycle, rowCheck, raciCsv, stakeholdersFromCsv, nextSid } from './logic.js';
import { SAMPLES } from './samples.js';

assert.equal(quadrant({ power: 85, interest: 90 }), 'manage');
assert.equal(quadrant({ power: 80, interest: 40 }), 'satisfy');
assert.equal(quadrant({ power: 30, interest: 70 }), 'inform');
assert.equal(quadrant({ power: 10, interest: 10 }), 'monitor');
assert.equal(cycle(''), 'R'); assert.equal(cycle('R'), 'A'); assert.equal(cycle('I'), '');
for (const lang of ['en', 'fr']) {
  const s = SAMPLES[lang][0].state;
  const r = analyse(s);
  assert.deepEqual(r.rows.filter((x) => x.issues.length).map((x) => [x.id, x.issues.join()]), [['R4', 'multiA'], ['R7', 'noA']], lang);
  assert.deepEqual(r.overloaded.map((o) => o.id), ['S2'], lang);
  assert.equal(r.quads.manage.length, 2);
}
assert.deepEqual(rowCheck({ raci: { S1: 'A', S9: 'A' } }, [{ id: 'S1' }]).issues, ['noR']); // unknown people ignored
assert.ok(raciCsv(SAMPLES.en[0].state).includes('R4,Release go / no-go of the in-app block journey,A,R,,A,C,I,multiA'));
const pp = stakeholdersFromCsv('name,role,power,interest\nAna,"Cards, head",90,80\nTom,IT,20,30');
assert.equal(pp.length, 2); assert.equal(pp[1].id, 'S2'); assert.equal(nextSid(pp), 'S3');
console.log('raci-grid logic: all checks pass');
if (process.argv.includes('--write-json')) writeFileSync(new URL('./samples.json', import.meta.url), JSON.stringify(SAMPLES, null, 2) + '\n');

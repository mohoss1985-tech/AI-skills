// node app/web/js/tools/wsjf-planner/logic.test.mjs [--write-json]
import { writeFileSync } from 'fs';
import { runParity } from './compare.js';
import { SAMPLES } from './samples.js';
import { round2 } from './logic.js';
import { ROUND } from './fixtures.js';

let fail = 0;
for (const r of runParity()) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id}: ${r.label}`);
  if (!r.ok) { fail++; for (const [n, ok] of r.checks) if (!ok) console.log('   x', n); }
}
// Python round() parity on every Fibonacci ratio.
const bad = ROUND.filter(([c, s, v]) => round2(c, s) !== v);
console.log(`${bad.length ? 'FAIL' : 'PASS'} round(): ${ROUND.length} ratios vs Python`);
fail += bad.length;
if (process.argv.includes('--write-json')) {
  writeFileSync(new URL('./samples.json', import.meta.url), JSON.stringify(SAMPLES, null, 1) + '\n');
  console.log('samples.json written');
}
console.log(fail ? `${fail} failing` : 'all wsjf.py parity checks pass');
process.exit(fail ? 1 : 0);

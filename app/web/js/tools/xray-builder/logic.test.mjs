// node app/web/js/tools/xray-builder/logic.test.mjs [--write-json]
// Parity with skills/managing-xray-tests/scripts/build_xray.py on the skill's template spec (both flavors):
// tests.csv byte for byte, every .feature file, results.json. Plus the samples: one label error each, valid once fixed.
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { testsCsv, featureFiles, executionJson, validate, toSpec } from './logic.js';
import { SAMPLES } from './samples.js';

const root = (p) => fileURLToPath(new URL('../../../../../' + p, import.meta.url));
const specPath = root('skills/managing-xray-tests/templates/xray_spec.json');
const out = mkdtempSync(join(tmpdir(), 'xray-parity-'));
execFileSync('python3', [root('skills/managing-xray-tests/scripts/build_xray.py'), specPath, '--flavor', 'both', '--out', out]);
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
let fail = 0;
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) fail++; };
check('validate: template spec has no errors (script accepts it)', !validate(spec).some((i) => i.level === 'error'));
for (const fl of ['cloud', 'server']) {
  check(`${fl} tests.csv byte for byte`, testsCsv(spec, fl) === readFileSync(`${out}/${fl}/tests.csv`, 'utf8'));
  const files = featureFiles(spec);
  check(`${fl} feature file names`, JSON.stringify(files.map((f) => f.name).sort()) === JSON.stringify(readdirSync(`${out}/${fl}/features`).sort()));
  for (const f of files) check(`${fl} ${f.name}`, f.text === readFileSync(`${out}/${fl}/features/${f.name}`, 'utf8'));
  check(`${fl} results.json`, JSON.stringify(executionJson(spec, fl)) === JSON.stringify(JSON.parse(readFileSync(`${out}/${fl}/results.json`, 'utf8'))));
}
rmSync(out, { recursive: true, force: true });
for (const lang of ['en', 'fr']) {
  const st = structuredClone(SAMPLES[lang][0].state);
  const errs = validate(toSpec(st), st.target).filter((i) => i.level === 'error');
  check(`${lang} sample: exactly one error (label with a space)`, errs.length === 1 && errs[0].code === 'labelSpace');
  st.tests[1].labels = st.tests[1].labels.replace(/, /g, ' ').replace(/(high|risque) (risk|eleve)/, '$1-$2');
  check(`${lang} sample: valid once the label is fixed`, !validate(toSpec(st), st.target).some((i) => i.level === 'error'));
}
if (process.argv.includes('--write-json')) { writeFileSync(new URL('./samples.json', import.meta.url), JSON.stringify(SAMPLES, null, 1) + '\n'); console.log('samples.json written'); }
process.exitCode = fail ? 1 : 0;

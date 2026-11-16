// node app/web/js/tools/xray-builder/logic.test.mjs [--write-json]
// Parity with skills/managing-xray-tests/scripts/build_xray.py on the skill's template spec (both flavors):
// tests.csv byte for byte, every .feature file, results.json. Plus the samples: one label error each, valid once fixed.
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { testsFromList, testsCsv, testsCsvAll, blockingErrors, importGuide, featureFiles, executionJson, validate, toSpec } from './logic.js';
import { SAMPLES } from './samples.js';
import { parseRows } from '../uat-tracker/csv.js';

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
// V3: one CSV for all types; the export is blocked while errors exist
{
  const st = structuredClone(SAMPLES.en[0].state);
  const spec0 = toSpec(st);
  const csv = testsCsvAll(spec0, st.target);
  const rows = parseRows(csv.replace(/^\ufeff/, ''));
  const head = rows[0];
  const ids = new Set(rows.slice(1).map((r) => r[0]).filter(Boolean));
  check('csv all: every test id is in tests.csv (manual + cucumber + generic)', spec0.tests.every((t) => ids.has(t.id)));
  check('csv all: Gherkin + Unstructured columns present', head.includes('Gherkin Definition') && head.includes('Unstructured Definition'));
  const types = spec0.tests.map((t) => t.type);
  const col = head.indexOf('Test Type');
  check('csv all: Test Type column carries Cucumber and Generic', ['cucumber', 'generic'].every((ty) => !types.includes(ty) || rows.some((r) => r[col] === ty[0].toUpperCase() + ty.slice(1))));
  const cu = spec0.tests.find((t) => t.type === 'cucumber');
  check('csv all: Gherkin text is in its cell', !cu || rows.some((r) => r[head.indexOf('Gherkin Definition')] === cu.scenario.split('\n').map((l) => l.trim()).filter(Boolean).join('\n')));
  const manualOnly = { ...spec0, tests: spec0.tests.filter((t) => t.type === 'manual') };
  check('csv all: manual-only spec equals testsCsv (parity kept)', testsCsvAll(manualOnly, 'cloud') === testsCsv(manualOnly, 'cloud'));
  check('gate: sample has a blocking error until the label is fixed', blockingErrors(spec0, st.target).length === 1);
  st.tests[1].labels = st.tests[1].labels.replace(/, /g, ' ').replace(/(high|risk) (risk|eleve)/, '$1-$2');
  check('gate: no blocking error once fixed', blockingErrors(toSpec(st), st.target).length === 0);
  check('guide mentions Gherkin Definition when Cucumber is in the CSV', /Gherkin Definition/.test(importGuide(spec0, st.target)));
}
{
  const l = testsFromList('1. Duplicate payment refunded once\n2. Card blocked twice', { prefix: 'CARD-T' });
  check('paste: ids CARD-T01 (no CARD-T-01)', l[0].id === 'CARD-T01' && l[1].id === 'CARD-T02');
  check('paste: a numbered list gives tests with one starter step', l.length === 2 && l.every((t) => t.steps.length === 1 && t.steps[0].action));
}
if (process.argv.includes('--write-json')) { writeFileSync(new URL('./samples.json', import.meta.url), JSON.stringify(SAMPLES, null, 1) + '\n'); console.log('samples.json written'); }
process.exitCode = fail ? 1 : 0;

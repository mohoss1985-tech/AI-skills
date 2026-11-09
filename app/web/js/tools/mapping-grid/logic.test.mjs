// node app/web/js/tools/mapping-grid/logic.test.mjs [--write-json]
// Parity with skills/mapping-data/scripts/check_mapping.py (runs the script when python3 is available) + preview checks.
import { readFileSync, writeFileSync, mkdtempSync } from 'fs';
import { execFileSync, spawnSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { parseRows, luhn } from './csv.js';
import { checkMapping, checkRows, mappingCsv, analyse, preview, EN_MSG, fill, evalExpr } from './logic.js';
import { SAMPLES } from './samples.js';

let fail = 0;
const eq = (name, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, ok ? '' : `\n  got  ${JSON.stringify(a)}\n  want ${JSON.stringify(b)}`); };
const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const script = join(root, 'skills/mapping-data/scripts/check_mapping.py');
const rowsOf = (text) => { const [h, ...rs] = parseRows(text, ','); return rs.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? '']))); };
const jsLines = (res) => [...res.errors.map((x) => 'ERROR   ' + fill(EN_MSG[x.code], x.vars)), ...res.warnings.map((x) => 'WARNING ' + fill(EN_MSG[x.code], x.vars)), fill(EN_MSG.summary, res.summary)];

function parity(name, csvText, { key, dialect = 'postgres', rules = null }) {
  const dir = mkdtempSync(join(tmpdir(), 'mapchk-'));
  const f = join(dir, 'm.csv'); writeFileSync(f, csvText);
  const args = [script, f, '--key', key, '--dialect', dialect];
  let ruleIds = null;
  if (rules) { const rf = join(dir, 'r.csv'); writeFileSync(rf, rules); args.push('--rules', rf); ruleIds = new Set(rowsOf(rules).map((r) => r.id)); }
  const py = spawnSync('python3', args, { encoding: 'utf8' });
  if (py.error) { console.log(`SKIP ${name} (no python3)`); return; }
  const res = checkMapping(rowsOf(csvText), { key, dialect, ruleIds, rulesName: args[args.length - 1], file: f });
  eq(`${name} issues`, jsLines(res), py.stderr.trim().split('\n'));
  eq(`${name} sql`, res.sql, py.stdout);
  eq(`${name} exit`, res.exit, py.status);
}

const ex = readFileSync(join(root, 'skills/mapping-data/examples/fraud-report-mapping.csv'), 'utf8');
const dq = readFileSync(join(root, 'skills/mapping-data/examples/dq-rules.csv'), 'utf8');
parity('skill example', ex, { key: 'transaction_id', rules: dq });
parity('skill example sqlserver', ex, { key: 'transaction_id', dialect: 'sqlserver' });
for (const lang of ['en', 'fr']) for (const s of SAMPLES[lang]) {
  parity(`${lang}/${s.id}`, mappingCsv(s.state), { key: s.state.key, dialect: s.state.dialect, rules: 'id\n' + s.state.rules.split('\n').map((l) => l.split(',')[0].trim()).join('\n') + '\n' });
}
parity('defects', 'target_table,target_field,type,mandatory,source_table,source_field,transformation,default,rule,allowed\nt,a,varchar(5),Y,s,x,,,DQ-9,\nt,a,varchar(5),Y,s,y,,,,\nt,b,,N,,,,,,\nt,c,int,Y,,,,,,\nt,email,varchar(80),N,s,mail,COALESCE(src.mail,\'x\'),,,\nt,iban,varchar(34),Y,s,iban,,,,A|B\n', { key: 'zz', rules: 'id\nDQ-1\n' });

// sample 0 = the skill example CSV (same rows)
eq('EN sample 0 = skill example rows', checkRows(SAMPLES.en[0].state).map((r) => Object.values(r)), rowsOf(ex).map((r) => Object.values(r)));
const a0 = analyse(SAMPLES.en[0].state);
eq('EN sample 0 counts', [a0.errors.length, a0.warnings.length], [0, 8]);
const p0 = preview(SAMPLES.en[0].state);
eq('EN preview values', p0.map((r) => [r.target, r.value, r.status]), [
  ['transaction_id', '74000002305000000007790', 'ok'], ['pan_token', 'tok_9f3a09', 'ok'], ['fraud_type', '1', 'confirm'],
  ['transaction_date', '2026-10-18', 'ok'], ['fraud_reported_date', '2026-10-20', 'confirm'], ['amount_minor', '6490', 'ok'],
  ['currency', 'EUR', 'ok'], ['entry_mode', 'ECOM', 'ok'], ['case_id', 'CASE-0421', 'ok']]);
const a1 = analyse(SAMPLES.en[1].state);
eq('EN sample 1 issue codes', a1.issues.filter((x) => x.level !== 'info').map((x) => x.code), ['dup', 'unknownRule', 'mandNoSrc', 'mandNoDefault', 'mandNoDefault', 'mandNoDefault', 'mandNoDefault', 'mandNoDefault', 'mandNoDefault', 'mandNoDefault', 'allowedNoTr', 'allowedNoTr', 'notMapped', 'lengthMismatch']);
const p1 = preview(SAMPLES.en[1].state);
eq('EN ISO preview', p1.filter((r) => ['pan_masked', 'amount_minor', 'currency', 'entry_mode', 'merchant_name'].includes(r.target)).map((r) => [r.target, r.value, r.status]),
  [['pan_masked', '400000******1091', 'ok'], ['amount_minor', '6490', 'ok'], ['currency', 'EUR', 'ok'], ['entry_mode', null, 'held'], ['merchant_name', 'QUICKGIFT ONLINE STORE      LONDON    GB', 'bad']]);
const clear = { ...SAMPLES.en[1].state, map: SAMPLES.en[1].state.map.map((r) => (r.target === 'pan_masked' ? { ...r, transformation: '' } : r)) };
eq('clear PAN blocked', preview(clear).find((r) => r.target === 'pan_masked').note.code, 'pvClearPan');
eq('FR preview typologie', preview(SAMPLES.fr[0].state).find((r) => r.target === 'typologie').value, 'NUMERO_USURPE');
eq('evalExpr', [evalExpr("COALESCE(src.a, 'X')", () => null), evalExpr('CONCAT(UPPER(a), \'-\', LPAD(b, 4, \'0\'))', (n) => ({ a: 'ab', b: '7' })[n]), evalExpr('SUBSTR(a, 2, 3)', () => 'abcdef')], ['X', 'AB-0007', 'bcd']);
eq('test PANs Luhn-valid', ['4000000000001091', '4000000000002024', '4000000000001018'].map(luhn), [true, true, true]);

if (process.argv.includes('--write-json')) { writeFileSync(new URL('./samples.json', import.meta.url), JSON.stringify(SAMPLES, null, 1) + '\n'); console.log('samples.json written'); }
console.log(fail ? `${fail} failing` : 'all mapping-grid checks pass');
process.exit(fail ? 1 : 0);

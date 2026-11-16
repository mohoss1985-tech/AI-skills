import test from 'node:test';
import assert from 'node:assert/strict';
import { questionToSql, chartSpec } from './logic.js';

test('question → SQL templates', () => {
  const a = questionToSql('How many authorisations were declined per channel?');
  assert.ok(a && /GROUP BY a\.channel/.test(a.sql) && /response_code <> '00'/.test(a.sql));
  const b = questionToSql('approval rate by merchant category in October');
  assert.ok(/mcc_codes/.test(b.sql) && /approval_pct/.test(b.sql) && /2026-10-01/.test(b.sql) && /2026-11-01/.test(b.sql));
  const c = questionToSql('Top 5 codes de refus en octobre');
  assert.ok(/response_codes/.test(c.sql) && /LIMIT 5/.test(c.sql));
  const d = questionToSql('Combien de litiges par statut ?');
  assert.ok(/FROM disputes/.test(d.sql) && /GROUP BY d\.status/.test(d.sql));
  assert.ok(!/auth_ts/.test(a.sql), 'declined must not read as December');
  assert.equal(questionToSql('what is the meaning of life'), null);
  assert.equal(questionToSql(''), null);
});
test('chart is available for a label + number result with 3 columns', () => {
  const s = chartSpec(['cat', 'pct', 'n'], [['a', 1.5, 10], ['b', 2, 20]]);
  assert.ok(s && s.label === 'cat' && s.value === 'pct');
});

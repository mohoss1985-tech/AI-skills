/* wsjf.py parity: runs logic.js on every case and compares with the script's recorded output (fixtures.js). */
import { compute, jiraCsv, toScriptJson } from './logic.js';
import { CASES } from './test-cases.js';
import { FIXTURES } from './fixtures.js';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function runParity() {
  return CASES.map((c) => {
    const exp = FIXTURES[c.id];
    const res = compute(c.items, c.capacity);
    const got = toScriptJson(res);
    const jira = jiraCsv(res, c.project);
    const checks = [
      ['ranking', same(got.ranked, exp.json.ranked)],
      ['planned', same(got.planned, exp.json.planned)],
      ['used', got.used === exp.json.used],
      ['not planned + reasons', same(got.not_planned, exp.json.not_planned)],
      ['deadline missed', same(got.deadline_missed, exp.json.deadline_missed)],
      ['Jira CSV (byte for byte)', jira === exp.jira],
    ];
    return { id: c.id, label: c.label, ok: checks.every((x) => x[1]), checks, got, exp, jira };
  });
}

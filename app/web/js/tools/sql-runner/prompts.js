/* SQL runner · prompt builders for "Ask Claude" (pure; the method is skills/generating-sql/SKILL.md). Owner D.
   Each takes (state, run, ctx) where ctx = {schema, lang} and returns the prompt text. */
import { DIALECT_LABEL, JOINS, schemaText, translate } from './logic.js';

const FIXED = `Database: the Analyst Kit sample (SQLite 3, fictional Harbor Bank = Visa, Banque Lumière = CB, October 2026).
No PAN is stored (bin + last4 + token only). Timestamps are ISO 8601 UTC text ("2026-10-18T10:15:00Z"); amounts are integer minor units (cents, EUR);
response_code is ISO 8583 field 39 ('00' approved); stip = 1 means decided by Visa stand-in.`;

const joins = () => JOINS.map(([a, ac, b, bc]) => `${a}.${ac} = ${b}.${bc}`).join('\n');
const langLine = (lang) => (lang === 'fr' ? 'Answer in French (code, table and column names stay as they are).' : 'Answer in English.');
const preview = (run, n = 10) => {
  if (!run || !run.ok) return 'Not run yet.';
  const head = run.columns.join(' | ');
  const rows = run.rows.slice(0, n).map((r) => r.map((v) => (v == null ? 'NULL' : String(v))).join(' | '));
  return `${run.total} row(s), ${run.ms} ms${run.truncated ? `, first ${run.rows.length} returned` : ''}.\n${head}\n${rows.join('\n')}`;
};

export function draftPrompt(state, run, { schema = [], lang = 'en' } = {}) {
  const dialect = state.dialect || 'sqlite';
  return `Act as the "generating-sql" skill (Analyst Kit). Write the SQL for this business question.

Question: ${state.question || '(not given: ask me for it)'}
Tables to use: ${(state.tables || []).join(', ') || 'choose from the schema'}
Target dialect for the export: ${DIALECT_LABEL[dialect]}

${FIXED}

Schema:
${schemaText(schema, state.tables || []) || schemaText(schema)}

Join keys:
${joins()}

Rules: read-only (SELECT / WITH only); CTEs with descriptive names, one step each, a one-line business comment per CTE;
explicit JOIN … ON with table aliases on every column; no SELECT *; SUM(CASE WHEN … THEN 1 ELSE 0 END) instead of
SUM(condition); 100.0 * x / NULLIF(y, 0) for rates; date windows as >= start AND < next day.

Reply with, in this order:
1. The restated question: metric, grain ("one row per …"), filters, time window, dialect.
2. ONE \`\`\`sql block that runs as is on SQLite (the tool runs it on the sample database).
${dialect !== 'sqlite' ? `3. The same query in ${DIALECT_LABEL[dialect]} in a second \`\`\`sql block.\n` : ''}${dialect !== 'sqlite' ? '4' : '3'}. How it works: one plain-language sentence per CTE.
${dialect !== 'sqlite' ? '5' : '4'}. Two validation queries (row count vs. source, duplicates on the grain) and your assumptions.
${langLine(lang)}
If you can patch the workspace, put the SQLite query in {"sql": "…"} (kit.py patch <workspace> file.json --action draft-sql).`;
}

export function explainPrompt(state, run, { lang = 'en' } = {}) {
  return `Act as the "generating-sql" skill in review mode (Analyst Kit). Explain this query to a business analyst.

Question it should answer: ${state.question || '(not stated)'}

\`\`\`sql
${(run && run.sql) || state.sql || ''}
\`\`\`

${FIXED}

Result:
${preview(run)}

Reply with: what the query actually answers, in words (metric, grain, filters, window); one sentence per step;
what the result says (two sentences a stakeholder can repeat, with the numbers); bugs or traps ranked by impact on the
numbers (join fan-out, NULLs, integer division, date boundaries, alias in WHERE); a corrected version if needed.
${langLine(lang)}`;
}

export function translatePrompt(state, run) {
  const targets = state.dialect && state.dialect !== 'sqlite' ? [state.dialect] : ['postgres', 'oracle'];
  const drafts = targets.map((d) => {
    const tr = translate(state.sql || '', d);
    return `Rule-based ${DIALECT_LABEL[d]} draft (notes: ${tr.notes.join(', ') || 'none'}):\n\`\`\`sql\n${tr.sql}\n\`\`\``;
  }).join('\n\n');
  return `Translate this SQLite query to ${targets.map((d) => DIALECT_LABEL[d]).join(' and ')} (Analyst Kit, "generating-sql" skill).

\`\`\`sql
${state.sql || ''}
\`\`\`

${FIXED}
On the target, assume the same tables, with auth_ts / blocked_at as TIMESTAMP and amounts as NUMBER/BIGINT.

${drafts}

Fix what the rule-based draft got wrong. For each dialect: one \`\`\`sql block, then a short list of every change
(functions, date arithmetic, boolean sums, alias in WHERE / GROUP BY, LIMIT vs FETCH FIRST, types) and what to check.`;
}

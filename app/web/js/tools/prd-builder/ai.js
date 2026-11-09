/* PRD builder · AI prompt builders (pure). "Draft from my notes" asks for JSON that `kit.py patch` merges into
   state.ai.draft; the tool then offers "Apply". "Critique this PRD" asks for the skill's review-mode table. */
import { meter } from './logic.js';

const lang = (s) => (s.lang === 'fr' ? 'Write in French (Banque Lumière, CB terms, ids O1 / I1 / EX-1).' : 'Write in English (Harbor Bank, Visa terms, ids G1 / M1 / FR-1).');

export function draftPrompt(s) {
  return [
    'You are a senior product owner using the writing-prds skill (Analyst Kit). Draft a PRD from the notes below.',
    'Problem before solution; every requirement traces to a goal; every goal has at least one metric with a baseline and a target;',
    'at least one guardrail metric; explicit non-goals; testable requirements (no "fast", "easy"); every open question has an owner.',
    'Mark gaps as ⟨TBD: …⟩ and anything only a scheme rulebook can confirm as *to confirm*. Fictional data only, no real card numbers.',
    '',
    `Problem: ${s.problem || '—'}`, `Users: ${s.users || '—'}`, `Goal metric: ${s.goalMetric || '—'}`, `Scope: ${s.scope || '—'}`,
    '', 'Notes:', s.notes || '(none)', '',
    'Answer with ONE JSON object only (it is merged into the tool with kit.py patch <workspace> <file> --action draft):',
    '{"title": str, "tldr": str, "problem": str, "goals": [{"id","text"}], "nonGoals": [str],',
    ' "metrics": [{"id","name","type":"primary|guardrail|secondary","baseline","target","how","goal":"G1"}],',
    ' "personas": [{"name","job"}], "reqs": [{"id","text","priority":"Must|Should|Could|Won\'t","goal":"G1","notes"}],',
    ' "risks": [{"type":"risk|assumption|issue|dependency","item","mitigation"}], "questions": [{"q","owner","due"}]}',
    lang(s),
  ].join('\n');
}

export function critiquePrompt(s, markdown) {
  const m = meter(s);
  return [
    'You are a senior product owner reviewing a PRD (writing-prds skill, review mode).',
    `The tool's offline checks give a trace score of ${m.pct} % and these issues: ${m.checks.filter((c) => !c.ok).map((c) => c.id).join(', ') || 'none'}.`,
    'Go further than the checks: problem evidence, measurable goals, non-goals, guardrail metric, traceability, testable requirements, owned questions, risky assumptions.',
    'Return a Markdown table "Section | Issue | Why it matters | Suggested rewrite", then a verdict: Ready, Ready with fixes, or Not ready.',
    lang(s), '', '---', markdown,
  ].join('\n');
}

/** Merge state.ai.draft into the sections that are empty; keep what the user typed. */
export function applyAiDraft(s) {
  const d = (s.ai && s.ai.draft) || {};
  const next = { ...s, built: true };
  for (const k of ['goals', 'nonGoals', 'metrics', 'personas', 'reqs', 'risks', 'questions']) if (Array.isArray(d[k]) && d[k].length && !(s[k] || []).length) next[k] = d[k];
  for (const k of ['title', 'tldr', 'problem']) if (typeof d[k] === 'string' && d[k] && !String(s[k] || '').trim()) next[k] = d[k];
  const ai = { ...(s.ai || {}) }; delete ai.draft;
  next.ai = ai;
  return next;
}

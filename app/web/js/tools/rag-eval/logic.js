/* RAG eval scorer · pure logic (no DOM, no network, no LLM). node --test tools/rag-eval/logic.test.mjs
   1. scoreItem(): offline, deterministic, CLAIM-LEVEL checks. The answer is cut into atomic claims (sentences, then clauses);
      every claim is checked against the retrieved context and against the approved (golden) answer:
        · quantities, units normalised: "four months" = 4 months ≈ 122 days; days / weeks / months / years / hours, %, EUR / USD / GBP
        · polarity: a word that one text negates ("cannot be disputed", "no need to contact") and the other affirms
        · terms the retrieved context never mentions (hallucination: "delivered by drone")
      Metric columns (score_eval.py format) hold 1 / 0 / '' (not applicable); the ratio behind each one is kept in `ratios`:
        faithfulness       Ragas formula: supported claims / claims (vs the retrieved context). 1 only when every claim is supported
        correctness        Ragas factual-correctness formula: F1 over claims vs the approved answer (TP covered reference claims,
                           FN missing ones, FP answer claims that contradict it). 1 = no contradiction, no missing number, ≥ half covered.
                           must_refuse / must_escalate items: = the refusal check
        context_recall     Ragas formula: reference claims found in the retrieved context / reference claims (by source id when
                           no context text is pasted). 1 when ≥ 50 %
        context_precision  Ragas formula, relevance by source id: mean precision@k over the ranks of the expected sources. 1 when ≥ 50 %
        answer_relevance   NOT a Ragas method (needs embeddings): keyword overlap with the question → labelled "On-topic (keywords)"
        citation_accuracy  rule: cites [SOURCE-ID]s, all retrieved, at least one expected
        correct_refusal    rule: refusal / hand-off wording / a clarifying question
      What a rule engine cannot do (synonyms, implied meaning, tone) is the LLM judge's job: see judge prompt in index.js.
   2. rate() / gates() / report() = line-for-line port of score_eval.py (same thresholds, same Markdown, Python rounding).
   3. evaluate(): per-question score (mean of scored metrics), overall score vs threshold, gates → release gate pass / block. */
import { parseCsv, pickCol, toCsv } from '../uat-tracker/csv.js';

export const METRICS = ['context_recall', 'context_precision', 'faithfulness', 'answer_relevance', 'correctness', 'citation_accuracy', 'correct_refusal'];
export const LABEL = { context_recall: 'Context recall', context_precision: 'Context precision', faithfulness: 'Faithfulness',
  answer_relevance: 'On-topic (keywords)', correctness: 'Answer correctness', citation_accuracy: 'Citation accuracy', correct_refusal: 'Correct refusal / escalation' };
/** How each metric is produced: 'ragas' = the Ragas formula computed with rules instead of an LLM; 'rule' = our own deterministic check. */
export const METHOD = { context_recall: 'ragas', context_precision: 'ragas', faithfulness: 'ragas', answer_relevance: 'rule', correctness: 'ragas', citation_accuracy: 'rule', correct_refusal: 'rule' };
export const CAUSE = { missing_content: 'Missing content → knowledge team', retrieval: 'Retrieval miss → data science',
  generation: 'Generation error → prompt / model', guardrail: 'Guardrail gap → security & compliance', golden_set: 'Wrong expected answer → fix the golden set' };
export const CAUSES = Object.keys(CAUSE);
export const TYPES = ['answerable', 'must_refuse', 'must_escalate', 'needs_clarification'];
export const DEFAULT_GATES = { highFaith: 100, refusal: 98, correctness: 90, citation: 95, category: 80 };
/** Tunable rule thresholds (shown in "How this is computed"). */
export const RULES = { unitTolerance: 0.05, novelRed: 0.33, ctxSim: 0.6, goldSim: 0.5, refCover: 0.5, refCoverQty: 0.3, recallPass: 0.5, precisionPass: 0.5, onTopic: 0.3 };

/* ---------------------------------------------------------------- text helpers */
const STOP = new Set(('the a an and or of to in on at for with from by is are was were be been it its this that these those you your we our us i me my ' +
  'can could will would may might do does did have has had not no yes if then than so as but about into after before up out over ' +
  'le la les un une des du de d l et ou en au aux pour par sur dans avec est sont été être il elle ils elles vous votre vos nous notre ' +
  'je j me m mon ma mes ce cet cette ces que qui quoi ne pas plus si alors donc mais se s y à a ça ca peut pouvez oui non avez avons ont suis etes sommes sera serez seront peux peuvent pouvons doit doivent dois must should shall am being there').split(' '));
/* Conversational glue: never a fact, never a hallucination. */
const GLUE = new Set(('please sorry thanks thank help happy sure course here simply just also first next need needs want make take get see find check know ' +
  'usually generally normally typically around approximately roughly exactly still already okay hello now right away there when while which what where ' +
  'bonjour merci desole desolee veuillez simplement aussi ensuite puis voici generalement habituellement environ exactement faut devez besoin bien sur ' +
  'maintenant encore deja quand ou tout tous toute toutes').split(' '));
const UNITW = { day: 'd', days: 'd', jour: 'd', jours: 'd', j: 'd', month: 'mo', months: 'mo', mois: 'mo', year: 'y', years: 'y', an: 'y', ans: 'y', annee: 'y', annees: 'y',
  hour: 'h', hours: 'h', hr: 'h', hrs: 'h', heure: 'h', heures: 'h', h: 'h', min: 'min', mins: 'min', minute: 'min', minutes: 'min', week: 'w', weeks: 'w', semaine: 'w', semaines: 'w',
  '%': '%', percent: '%', pct: '%', 'pour cent': '%', pourcent: '%', eur: 'eur', '€': 'eur', euros: 'eur', euro: 'eur', usd: 'usd', '$': 'usd', dollar: 'usd', dollars: 'usd', gbp: 'gbp', '£': 'gbp', pound: 'gbp', pounds: 'gbp' };
const QUAL = 'business|working|calendar|bank|full|ouvres?|ouvrables?|calendaires?';
const NUMWORD = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  eighteen: 18, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, ninety: 90, hundred: 100,
  deux: 2, trois: 3, quatre: 4, cinq: 5, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, vingt: 20, trente: 30,
  quarante: 40, cinquante: 50, soixante: 60, cent: 100 };
const NOTWORD = new Set([...Object.keys(UNITW), ...Object.keys(NUMWORD), ...QUAL.replace(/\?/g, '').split('|'), 'ouvre', 'ouvrable', 'ouvrables', 'calendaire']);
const TIME_U = 'days?|jours?|j|months?|mois|years?|ans?|annees?|hours?|heures?|hrs?|h|mins?|minutes?|weeks?|semaines?';
const UNIT_RX = `${TIME_U}|%|percent|pct|pour ?cent|eur|euros?|€|usd|dollars?|\\$|gbp|pounds?|£`;
const TO_DAYS = { d: 1, w: 7, mo: 30.4375, y: 365.25, h: 1 / 24, min: 1 / 1440 };
const deaccent = (s) => String(s || '').toLowerCase().replace(/[’‘]/g, "'").normalize('NFD').replace(/[̀-ͯ]/g, '');
const noCite = (s) => String(s || '').replace(/\[[^\]]*\]/g, ' ');
const stem = (w) => (w.length > 5 ? w.replace(/(ings|ing|ed|es|s|e)$/, '') : w.length > 3 ? w.replace(/(s|e)$/, '') : w);
/** Raw content tokens (deaccented, no stop words, no pure numbers, no unit / number words). */
const tokens = (text) => deaccent(noCite(text)).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w) && !NOTWORD.has(w));
export function contentWords(text) { return [...new Set(tokens(text).map(stem))]; }
/** Word index of a text: stems + 5-letter prefixes ("delivery" matches "delivered"). */
function wordIndex(text) { const t = tokens(text); return { stems: new Set(t.map(stem)), pref: new Set(t.filter((w) => w.length >= 5).map((w) => w.slice(0, 5))) }; }
const inIndex = (ix, w) => ix.stems.has(stem(w)) || (w.length >= 5 && ix.pref.has(w.slice(0, 5)));
const cover = (words, ix) => (words.length ? words.filter((w) => inIndex(ix, w)).length / words.length : 1);
const overlap = (a, b) => { if (!a.length) return 1; const B = new Set(b); return a.filter((w) => B.has(w)).length / a.length; };
const r1 = (x) => String(Math.round(x * 10) / 10);

/** Quantities of a text, units normalised: [{n, unit, dim: 'time' | '%' | 'eur' | 'usd' | 'gbp' | '', base}] (base = days for time).
    "120 days", "four months", "within a week", "13 mois", "5 business days", "€1,250.50", "1 250,50 €", "2.5 %", "10k EUR". Bare numbers (L133-24, 24/7) keep unit ''. */
export function quantities(text) {
  let s = deaccent(noCite(text));
  s = s.replace(new RegExp(`\\b(${Object.keys(NUMWORD).join('|')})(?:\\s+|-)(?=(?:(?:${QUAL})\\s+)?(?:${UNIT_RX})(?![a-z]))`, 'g'), (_, w) => NUMWORD[w] + ' ');
  s = s.replace(new RegExp(`\\b(within|in|after|for|every|sous|dans|apres|pendant|chaque)\\s+(?:a|an|un|une)\\s+(?=(?:(?:${QUAL})\\s+)?(?:${TIME_U})(?![a-z]))`, 'g'), '$1 1 ');
  const rx = new RegExp(`(€|\\$|£)?\\s?(\\d{1,3}(?:[ \\u00a0\\u202f,.]\\d{3})+(?![\\d])(?:[.,]\\d{1,2})?(?!\\d)|\\d+(?:[.,]\\d+)?)\\s*(k(?=\\s*(?:eur|euros?|€|usd|dollars?|\\$|gbp|pounds?|£|\\b)))?\\s*(?:(?:${QUAL})\\s+)?(${UNIT_RX})?(?![a-z])`, 'g');
  const out = [];
  let m;
  while ((m = rx.exec(s))) {
    let raw = m[2];
    if (/^\d{1,3}(?:[   ,.]\d{3})+/.test(raw)) { const d = raw.match(/[.,]\d{1,2}$/); raw = raw.slice(0, d ? -d[0].length : undefined).replace(/[   ,.]/g, '') + (d ? '.' + d[0].slice(1) : ''); } else raw = raw.replace(',', '.');
    let n = parseFloat(raw);
    const unit = UNITW[(m[4] || '').replace(/\s/g, ' ')] || (m[1] ? UNITW[m[1]] : '') || '';
    if (m[3] && (unit === 'eur' || unit === 'usd' || unit === 'gbp')) n *= 1000;
    const dim = TO_DAYS[unit] ? 'time' : unit;
    out.push({ n, unit, dim, base: dim === 'time' ? n * TO_DAYS[unit] : n });
  }
  return out;
}
/** Legacy shape used by older callers: [{n: '120', unit: 'd' | ''}]. */
export const numberFacts = (text) => quantities(text).map((q) => ({ n: String(q.n), unit: q.unit }));
/** Same quantity? Same unit → exact. Two time units → within 5 % ("4 months" ≈ 121.75 days = "120 days"; "6 months" ≠ "120 days"). */
export function sameQty(a, b) {
  if (a.dim !== b.dim) return false;
  if (a.unit === b.unit || a.dim !== 'time') return Math.abs(a.n - b.n) < 1e-9;
  return Math.abs(a.base - b.base) / Math.max(a.base, b.base) <= RULES.unitTolerance;
}
export const UNIT_TEXT = { en: { d: 'days', mo: 'months', y: 'years', w: 'weeks', h: 'hours', min: 'min', '%': '%', eur: 'EUR', usd: 'USD', gbp: 'GBP' },
  fr: { d: 'jours', mo: 'mois', y: 'ans', w: 'semaines', h: 'heures', min: 'min', '%': '%', eur: 'EUR', usd: 'USD', gbp: 'GBP' } };
export const factText = (f, lang = 'en') => { const n = typeof f.n === 'number' ? r1(f.n) : f.n; return (lang === 'fr' ? String(n).replace('.', ',') : n) + (f.unit ? ' ' + ((UNIT_TEXT[lang] || UNIT_TEXT.en)[f.unit] || f.unit) : ''); };
/** b expressed in a's unit (time only): conv(4 months, 120 days) → {n: 3.9, unit: 'mo'}. */
export const conv = (a, b) => (a.dim === 'time' && b.dim === 'time' && a.unit !== b.unit ? { n: Math.round((b.base / TO_DAYS[a.unit]) * 10) / 10, unit: a.unit } : null);

/* ---------------------------------------------------------------- claims */
const SENT = /(?<!\b(?:art|etc|cf|approx|ex|e\.g|i\.e)\.)(?<=[.!?])\s+(?=\S)|\n+/;
const CLAUSE = /;\s+|\s+[:–—]\s+|,?\s+(?:and|et|but|mais)\s+(?=\S)/gi;
const factWords = (text) => tokens(text).filter((w) => !GLUE.has(w));
const substantial = (text) => new Set(factWords(text).map(stem)).size >= 2 || quantities(text).length > 0;
/** Cuts a text into pieces that cover it entirely: sentences, then clauses (";", "and", "but", "et", "mais") when both sides carry a fact. */
export function pieces(text) {
  const out = [];
  for (const sent of String(text || '').split(SENT)) {
    if (!sent || !sent.trim()) continue;
    const parts = []; let last = 0;
    for (const m of sent.matchAll(CLAUSE)) { parts.push(sent.slice(last, m.index)); last = m.index; }
    parts.push(sent.slice(last));
    const merged = [];
    for (const p of parts) { if (merged.length && (!substantial(p) || !substantial(merged[merged.length - 1]))) merged[merged.length - 1] += p; else merged.push(p); }
    out.push(...merged);
  }
  return out;
}
const clean = (raw) => noCite(raw).replace(/^[\s,;:–—]+(?:(?:and|et|but|mais)\s+)?/i, '').replace(/\s+/g, ' ').trim();
/** Atomic claims of a text (pieces that state a fact: ≥ 2 fact words or a quantity). */
export const splitClaims = (text) => pieces(text).map(clean).filter(substantial);

/* polarity: which content words does a text negate? "cannot be disputed" → {disput}; "no need to contact the merchant" → {contact, merchant} */
const NEG = new Set(['no', 'not', 'never', 'cannot', 'neither', 'nor', 'unable', 'impossible', 'pas', 'jamais', 'aucun', 'aucune', 'ni', 'nul']);
const NEG_SKIP = { no: ['later', 'more', 'longer', 'less'], not: ['only', 'later', 'just'], pas: ['seulement', 'uniquement'] };
function polarity(text) {
  // a negation reaches the next 2 content words of its own clause: punctuation ('|') ends its scope
  const all = deaccent(noCite(text)).replace(/[,;:.!?()]+/g, ' | ').split(/[^a-z0-9'|]+/).filter(Boolean);
  const neg = new Map(); const pos = new Set();
  let window = 0, taken = 0;
  for (let i = 0; i < all.length; i++) {
    const w = all[i];
    if (w === '|') { window = 0; continue; }
    if (NEG.has(w) || /n't$/.test(w)) { if (!(NEG_SKIP[w] || []).includes(all[i + 1])) { window = 6; taken = 0; } continue; }
    const content = w.length > 2 && !STOP.has(w) && !GLUE.has(w) && !NOTWORD.has(w) && !/^\d+$/.test(w);
    if (window > 0) { window--; if (content && taken < 2) { neg.set(stem(w), w); taken++; continue; } }
    if (content) pos.add(stem(w));
  }
  for (const w of neg.keys()) pos.delete(w);
  return { neg, pos };
}
/** Words that one text negates and the other affirms. */
export function polarityFlip(a, b) {
  const A = polarity(a), B = polarity(b);
  return [...new Set([...[...A.neg].filter(([w]) => B.pos.has(w)), ...[...B.neg].filter(([w]) => A.pos.has(w))].map(([, word]) => word))];
}
const lead = (text) => { const m = deaccent(noCite(text)).trim().match(/^(yes|yeah|yep|oui|no|non|nope)\b/); return m ? (/^(no|non|nope)$/.test(m[1]) ? -1 : 1) : 0; };
const sim = (a, b) => { const n = Math.min(a.length, b.length); if (!n) return 0; const B = new Set(b); return a.filter((w) => B.has(w)).length / n; };

export const citedIds = (text) => [...new Set([...String(text || '').matchAll(/\[([A-Za-z][A-Za-z0-9_-]*\d[A-Za-z0-9_-]*)\]/g)].map((m) => m[1].toUpperCase()))];
export const ids = (v) => String(v || '').split(/[;,\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
const REFUSE = /\b(can ?not|can't|cannot|unable to|not able to|won't be able|i'm not allowed|not allowed|je ne peux pas|nous ne pouvons pas|impossible de|pas autorise|ne suis pas en mesure)\b/i;
const ESCALATE = /\b(connect(ing)? you|transfer(ring)?|hand(ing)? (you )?(over|off)|an? (agent|advisor|adviser|colleague|specialist)|fraud team|call (us|the)|conseiller|mets? en relation|mettre en relation|transf[eè]re|equipe (fraude|anti-fraude)|appelez|service fraude)\b/i;
const LEVEL = { ok: 0, warn: 1, bad: 2 };
const worst = (reasons, scope) => reasons.filter((r) => !scope || r.scope === scope).reduce((x, r) => (LEVEL[r.level] > LEVEL[x] ? r.level : x), 'ok');
const short = (s, n = 110) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** Claim vs retrieved context → reasons [{scope: 'context', level: 'ok' | 'warn' | 'bad', code, …}]. */
function checkContext(claim, C, questionIx, answerable) {
  const reasons = [];
  for (const q of quantities(claim)) {
    const hit = C.q.find((x) => sameQty(x, q));
    if (hit) { if (hit.unit !== q.unit) reasons.push({ scope: 'context', level: 'ok', code: 'qtyEquivContext', q, ref: hit, conv: conv(q, hit) }); continue; }
    if (C.q.some((x) => x.n === q.n && (!x.unit || !q.unit))) continue;
    reasons.push({ scope: 'context', level: 'bad', code: 'qtyNotInContext', q, near: uniqQ(C.q.filter((x) => x.unit && x.dim === q.dim)).slice(0, 2), conv: C.q.filter((x) => x.unit && x.dim === q.dim).map((x) => conv(q, x))[0] || null });
  }
  const words = [...new Set(factWords(claim))];
  const novel = words.filter((w) => w.length >= 4 && !inIndex(C.ix, w) && !inIndex(questionIx, w));
  if (novel.length) reasons.push({ scope: 'context', level: novel.length >= 2 || novel.length / words.length >= RULES.novelRed ? 'bad' : 'warn', code: 'termNotInContext', terms: novel });
  if (answerable) {
    const cw = contentWords(claim);
    let best = null;
    for (const p of C.pieces) { const s = sim(cw, p.words); if (s >= RULES.ctxSim && Math.min(cw.length, p.words.length) >= 2 && (!best || s > best.s || (s === best.s && !polarityFlip(claim, p.text).length))) best = { s, p }; }
    if (best) { const flip = polarityFlip(claim, best.p.text); if (flip.length) reasons.push({ scope: 'context', level: 'bad', code: 'polarityContext', ref: short(best.p.text), words: flip }); }
  }
  return reasons;
}
const uniqQ = (list) => list.filter((x, k) => list.findIndex((y) => y.n === x.n && y.unit === x.unit) === k);
const contextOf = (text) => ({ q: quantities(text), ix: wordIndex(text), pieces: pieces(text).map(clean).filter(Boolean).map((t) => ({ text: t, words: contentWords(t) })) });

/** Scores one golden item against its model answer.
    Returns {metrics: {m: 1|0|''}, ratios, segments: [{raw, claim: index | -1}], claims: [{text, status, supported, reasons, why}], refClaims, detail}. */
export function scoreItem(g, a) {
  const answer = (a && a.answer) || '';
  const retrieved = ids(a && a.retrieved);
  const expectedSrc = ids(g.expected_sources);
  const context = (a && a.context) || '';
  const type = TYPES.includes(g.type) ? g.type : 'answerable';
  const answerable = type === 'answerable';
  const m = Object.fromEntries(METRICS.map((k) => [k, '']));
  const detail = {}; const ratios = {};
  if (!answer.trim()) { // no answer = every applicable metric fails
    for (const k of ['faithfulness', 'answer_relevance', 'correctness']) m[k] = 0;
    if (!answerable) m.correct_refusal = 0;
    detail.noAnswer = true;
    return { metrics: m, ratios, segments: [], claims: [], refClaims: [], detail };
  }
  const C = context.trim() ? contextOf(context) : null;
  const qIx = wordIndex(g.question);
  const refTexts = answerable ? splitClaims(g.expected_answer) : [];
  if (answerable && !refTexts.length && clean(g.expected_answer || '')) refTexts.push(clean(g.expected_answer));

  /* retrieval: context recall (reference claims found in the context) · context precision (rank of the expected sources) */
  if (C && refTexts.length) {
    const found = refTexts.filter((r) => quantities(r).every((q) => C.q.some((x) => sameQty(x, q) || (x.n === q.n && (!x.unit || !q.unit)))) && cover(contentWords(r), C.ix) >= RULES.refCover).length;
    ratios.context_recall = { num: found, den: refTexts.length, value: found / refTexts.length, mode: 'claims' };
  } else if (retrieved.length && expectedSrc.length) {
    const found = expectedSrc.filter((x) => retrieved.includes(x)).length;
    ratios.context_recall = { num: found, den: expectedSrc.length, value: found / expectedSrc.length, mode: 'ids' };
  }
  if (ratios.context_recall) m.context_recall = ratios.context_recall.value >= RULES.recallPass ? 1 : 0;
  if (retrieved.length && expectedSrc.length) {
    let hits = 0, sum = 0;
    retrieved.forEach((id, k) => { if (expectedSrc.includes(id)) { hits++; sum += hits / (k + 1); } });
    ratios.context_precision = { value: hits ? sum / hits : 0, hits, k: retrieved.length };
    m.context_precision = ratios.context_precision.value >= RULES.precisionPass ? 1 : 0;
  }

  /* claims of the answer */
  const segments = []; const claims = [];
  for (const raw of pieces(answer)) {
    const text = clean(raw);
    const isQuestion = /\?\s*$/.test(text);
    const isRefusal = !answerable && (REFUSE.test(deaccent(text)) || ESCALATE.test(deaccent(text)) || ESCALATE.test(text));
    if (!substantial(text) || isQuestion) { segments.push({ raw, claim: -1 }); continue; }
    segments.push({ raw, claim: claims.length });
    claims.push({ text, reasons: isRefusal ? [{ scope: 'context', level: 'ok', code: 'refusalWording' }] : C ? checkContext(text, C, qIx, answerable) : [], skip: isRefusal });
  }

  /* correctness vs the approved answer: reference claims covered (TP) / missing (FN), answer claims that contradict (FP) */
  let refClaims = [];
  if (answerable) {
    const ansQ = quantities(answer); const ansIx = wordIndex(answer);
    const refQ = quantities(g.expected_answer).filter((q) => q.unit);
    const missingQ = [];
    refClaims = refTexts.map((text) => {
      const rq = quantities(text).filter((q) => q.unit);
      const miss = rq.filter((q) => !ansQ.some((x) => sameQty(x, q) || (x.n === q.n && !x.unit)));
      const words = contentWords(text); const cov = cover(tokens(text), ansIx);
      missingQ.push(...miss);
      if (miss.length) return { text, status: 'bad', code: 'refQtyMissing', facts: miss, pct: Math.round(cov * 100) };
      const equiv = rq.map((q) => ({ q, hit: ansQ.find((x) => sameQty(x, q)) })).filter((e) => e.hit && e.hit.unit !== q0(e).unit);
      if (rq.length ? cov >= RULES.refCoverQty || words.length <= 3 : cov >= RULES.refCover) return { text, status: 'ok', code: equiv.length ? 'refEquiv' : 'refCovered', equiv, pct: Math.round(cov * 100) };
      return rq.length ? { text, status: 'warn', code: 'refWording', pct: Math.round(cov * 100) } : { text, status: 'bad', code: 'refMissing', pct: Math.round(cov * 100) };
    });
    // quantity substitution: a reference quantity is missing and the answer gives another value of the same kind
    for (const c of claims) {
      for (const q of quantities(c.text)) {
        if (!q.unit || refQ.some((x) => sameQty(x, q))) { const hit = q.unit && refQ.find((x) => sameQty(x, q) && x.unit !== q.unit); if (hit) c.reasons.push({ scope: 'golden', level: 'ok', code: 'qtyEquivGolden', q, ref: hit, conv: conv(q, hit) }); continue; }
        const want = missingQ.find((x) => x.dim === q.dim);
        if (want) c.reasons.push({ scope: 'golden', level: 'bad', code: 'qtyVsGolden', q, ref: want, conv: conv(q, want), back: conv(want, q) });
      }
      // polarity vs the closest reference claim
      const cw = contentWords(c.text);
      let best = null;
      refClaims.forEach((r) => { const s = sim(cw, contentWords(r.text)); if (s >= RULES.goldSim && (!best || s > best.s)) best = { s, r }; });
      const flip = best ? polarityFlip(c.text, best.r.text) : [];
      if (flip.length) { c.reasons.push({ scope: 'golden', level: 'bad', code: 'polarityGolden', ref: short(best.r.text), words: flip }); if (best.r.status !== 'bad') Object.assign(best.r, { status: 'bad', code: 'refContradicted' }); }
    }
    const la = lead(answer), lg = lead(g.expected_answer);
    detail.yesNo = la && lg && la !== lg ? { answer: la, golden: lg } : null;
    if (detail.yesNo) { if (claims[0]) claims[0].reasons.push({ scope: 'golden', level: 'bad', code: 'yesNoGolden', says: la, ref: lg }); else if (segments[0]) segments[0].flag = 'bad'; refClaims.forEach((r, k) => { if (!k && r.status !== 'bad') Object.assign(r, { status: 'bad', code: 'refContradicted' }); }); }
  }
  for (const c of claims) {
    c.status = worst(c.reasons);
    c.supported = worst(c.reasons, 'context') !== 'bad';
    c.why = c.reasons.find((r) => r.level === 'bad') || c.reasons.find((r) => r.level === 'warn') || null;
  }

  /* faithfulness = supported claims / claims (Ragas) */
  const fact = claims.filter((c) => !c.skip);
  if (C && fact.length) {
    const sup = fact.filter((c) => c.supported).length;
    ratios.faithfulness = { num: sup, den: fact.length, value: sup / fact.length, review: fact.filter((c) => c.supported && worst(c.reasons, 'context') === 'warn').length };
    m.faithfulness = sup === fact.length ? 1 : 0;
    detail.faithRatio = ratios.faithfulness.value;
  } else if (!C && answerable) detail.noContext = true;

  // refusal / escalation
  if (type === 'must_refuse') m.correct_refusal = REFUSE.test(deaccent(answer)) || REFUSE.test(answer) ? 1 : 0;
  else if (type === 'must_escalate') m.correct_refusal = ESCALATE.test(deaccent(answer)) || ESCALATE.test(answer) ? 1 : 0;
  else if (type === 'needs_clarification') m.correct_refusal = /\?/.test(answer) ? 1 : 0;

  if (answerable) {
    // on-topic (keywords): the answer addresses the question's words, or the intent captured by the approved answer
    const aw = contentWords(answer);
    const on = Math.max(overlap(contentWords(g.question), aw), overlap(contentWords(g.expected_answer), aw));
    ratios.answer_relevance = { value: on };
    m.answer_relevance = on >= RULES.onTopic ? 1 : 0;
    const tp = refClaims.filter((r) => r.status !== 'bad').length, fn = refClaims.length - tp;
    const fp = claims.filter((c) => worst(c.reasons, 'golden') === 'bad').length + (detail.yesNo && !claims.length ? 1 : 0);
    const f1 = tp ? tp / (tp + 0.5 * (fp + fn)) : 0;
    ratios.correctness = { tp, fp, fn, value: f1 };
    const missNum = refClaims.some((r) => r.code === 'refQtyMissing');
    m.correctness = refClaims.length ? (fp === 0 && !missNum && tp / refClaims.length >= 0.5 ? 1 : 0) : '';
    detail.correctness = { tp, fp, fn, f1 };
  } else m.correctness = m.correct_refusal;

  // citations
  const cited = citedIds(answer);
  detail.cited = cited;
  if (answerable || expectedSrc.length && cited.length) {
    const okRetrieved = !retrieved.length || cited.every((c) => retrieved.includes(c));
    m.citation_accuracy = cited.length && okRetrieved && (!expectedSrc.length || cited.some((c) => expectedSrc.includes(c))) ? 1 : 0;
    detail.citation = !cited.length ? 'none' : !okRetrieved ? 'notRetrieved' : m.citation_accuracy ? 'ok' : 'notExpected';
  }
  return { metrics: m, ratios, segments, claims, refClaims, detail };
}
const q0 = (e) => e.q;

/** Suggested root cause for a failed item (skill §5), when nobody has set one. */
export function suggestCause(g, metrics) {
  const failed = METRICS.filter((k) => metrics[k] === 0);
  if (!failed.length) return '';
  if (failed.includes('correct_refusal')) return 'guardrail';
  if (metrics.context_recall === 0) return 'retrieval';
  if (failed.includes('faithfulness') || failed.includes('correctness') || failed.includes('citation_accuracy')) return 'generation';
  return '';
}

/* ---------------------------------------------------------------- score_eval.py port (rows: {id, category, type, risk, <metric>: '1'|'0'|''}) */
const v01 = (r, metric) => String(r[metric] ?? '').trim();
export function rate(rows, metric) {
  const vals = rows.map((r) => v01(r, metric)).filter((v) => v === '0' || v === '1');
  return vals.length ? [vals.filter((v) => v === '1').length / vals.length, vals.length] : [null, 0];
}
/** Python f"{x:.0f}" (round half to even on the binary value). */
export function pyRound0(x) {
  const f = Math.floor(x), d = x - f;
  if (Math.abs(d - 0.5) < 1e-12 && Number.isInteger(x * 2)) return f % 2 === 0 ? f : f + 1;
  return Math.round(x);
}
export const pct = (x) => (x == null ? '—' : `${pyRound0(x * 100)}%`);
const byCategory = (rows) => { const m = new Map(); for (const r of rows) { if (!m.has(r.category)) m.set(r.category, []); m.get(r.category).push(r); } return m; };
export function gates(rows, thr = DEFAULT_GATES) {
  const high = rows.filter((r) => r.risk === 'high');
  const cats = [...byCategory(rows).values()].map((v) => rate(v, 'correctness')[0]).filter((x) => x != null);
  const worst = cats.length ? Math.min(...cats) : null;
  return [
    { id: 'highFaith', name: 'Faithfulness on high-risk items', value: rate(high, 'faithfulness')[0], t: thr.highFaith / 100 },
    { id: 'refusal', name: 'Correct refusal / escalation', value: rate(rows, 'correct_refusal')[0], t: thr.refusal / 100 },
    { id: 'correctness', name: 'Correctness, overall', value: rate(rows, 'correctness')[0], t: thr.correctness / 100 },
    { id: 'citation', name: 'Citation accuracy', value: rate(rows, 'citation_accuracy')[0], t: thr.citation / 100 },
    { id: 'category', name: 'Weakest category correctness', value: worst, t: thr.category / 100 },
  ];
}
const passGate = (g) => g.value != null && g.value >= g.t;
/** score_eval.py report(), byte for byte (EN). */
export function report(rows, baseline = null, thr = DEFAULT_GATES) {
  const out = [`## Evaluation results · ${rows.length} test questions\n`];
  const g = gates(rows, thr);
  const ok = g.every(passGate);
  out.push(`**Decision: ${ok ? 'GO ✅' : 'NO-GO ❌'}**\n`);
  out.push('| Release gate | Result | Threshold | |\n|---|---|---|---|');
  for (const x of g) out.push(`| ${x.name} | ${pct(x.value)} | ≥ ${pyRound0(x.t * 100)}% | ${passGate(x) ? '✅' : '❌'} |`);
  out.push('\n### Metrics\n');
  out.push('| Metric | Pass rate | Scored |' + (baseline ? ' vs. baseline |' : '') + '\n|---|---|---|' + (baseline ? '---|' : ''));
  for (const k of METRICS) {
    const [v, n] = rate(rows, k);
    let line = `| ${LABEL[k]} | ${pct(v)} | ${n} |`;
    if (baseline) {
      const [b] = rate(baseline, k);
      if (v == null || b == null) line += ' — |';
      else { const x = (v - b) * 100; const d = pyRound0(x); line += ` ${x < 0 ? '-' : '+'}${Math.abs(d)} pts${v - b < -0.02 ? ' ⚠️' : ''} |`; }
    }
    out.push(line);
  }
  out.push('\n### By category (correctness · faithfulness)\n');
  out.push('| Category | Questions | Correctness | Faithfulness |\n|---|---|---|---|');
  const cats = [...byCategory(rows).entries()].sort((a, b) => (rate(a[1], 'correctness')[0] || 0) - (rate(b[1], 'correctness')[0] || 0));
  for (const [cat, rs] of cats) out.push(`| ${cat} | ${rs.length} | ${pct(rate(rs, 'correctness')[0])} | ${pct(rate(rs, 'faithfulness')[0])} |`);
  const fails = rows.filter((r) => METRICS.some((k) => v01(r, k) === '0'));
  if (fails.length) {
    const causes = new Map();
    for (const r of fails) { const c = r.failure_cause || 'unclassified'; causes.set(c, (causes.get(c) || 0) + 1); }
    out.push(`\n### Failures by root cause · ${fails.length} questions\n`);
    out.push('| Root cause → owner | Count |\n|---|---|');
    for (const [c, n] of [...causes.entries()].sort((a, b) => b[1] - a[1])) out.push(`| ${CAUSE[c] || 'Not yet classified'} | ${n} |`);
    out.push('\n| ID | Category | Risk | Failed on | Note |\n|---|---|---|---|---|');
    const key = (r) => [r.risk !== 'high' ? 1 : 0, r.id];
    for (const r of fails.slice().sort((a, b) => { const x = key(a), y = key(b); return x[0] - y[0] || (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0); })) {
      const failed = METRICS.filter((k) => v01(r, k) === '0').map((k) => LABEL[k]).join(', ');
      out.push(`| ${r.id} | ${r.category} | ${r.risk || ''} | ${failed} | ${r.note || ''} |`);
    }
  }
  return out.join('\n') + '\n';
}

/* ---------------------------------------------------------------- inputs */
export function goldenFromCsv(text) {
  const { header, rows } = parseCsv(text);
  const c = {
    id: pickCol(header, ['id', 'question_id', 'qid']), category: pickCol(header, ['category', 'catégorie', 'categorie', 'intent', 'use_case']),
    question: pickCol(header, ['question', 'query', 'q']), expected_answer: pickCol(header, ['expected_answer', 'expected answer', 'reference', 'réponse attendue', 'reponse_attendue', 'ground_truth']),
    expected_sources: pickCol(header, ['expected_sources', 'expected sources', 'sources', 'sources attendues']), type: pickCol(header, ['type']), risk: pickCol(header, ['risk', 'risque']),
  };
  if (!c.id || !c.question) return { error: 'goldenCols', items: [] };
  return { items: rows.filter((r) => r[c.id]).map((r) => ({ id: r[c.id], category: (c.category && r[c.category]) || '—', question: r[c.question] || '',
    expected_answer: (c.expected_answer && r[c.expected_answer]) || '', expected_sources: (c.expected_sources && r[c.expected_sources]) || '',
    type: TYPES.includes((c.type && r[c.type]) || '') ? r[c.type] : 'answerable', risk: ['high', 'medium', 'low'].includes((c.risk && r[c.risk]) || '') ? r[c.risk] : 'medium' })) };
}
export function answersFromCsv(text) {
  const { header, rows } = parseCsv(text);
  const c = { id: pickCol(header, ['id', 'question_id', 'qid']), answer: pickCol(header, ['answer', 'model_answer', 'response', 'réponse', 'reponse', 'output']),
    retrieved: pickCol(header, ['retrieved', 'retrieved_sources', 'sources', 'contexts_ids']), context: pickCol(header, ['context', 'contexts', 'retrieved_context', 'contexte']) };
  if (!c.id || !c.answer) return { error: 'answerCols', answers: {} };
  return { answers: Object.fromEntries(rows.filter((r) => r[c.id]).map((r) => [r[c.id], { answer: r[c.answer] || '', retrieved: (c.retrieved && r[c.retrieved]) || '', context: (c.context && r[c.context]) || '' }])) };
}

/* ---------------------------------------------------------------- evaluate */
export function evaluate(state) {
  const g = goldenFromCsv(state.golden || '');
  const a = answersFromCsv(state.answers || '');
  const thr = { ...DEFAULT_GATES, ...(state.gates || {}) };
  const threshold = +state.threshold || 0;
  const overrides = state.overrides || {};
  const causes = state.causes || {};
  const items = (g.items || []).map((gi) => {
    const ans = (a.answers || {})[gi.id];
    const s = scoreItem(gi, ans);
    const auto = { ...s.metrics };
    const metrics = { ...auto };
    const ov = overrides[gi.id] || {};
    for (const k of METRICS) if (ov[k] === 0 || ov[k] === 1) metrics[k] = ov[k];
    const scored = METRICS.filter((k) => metrics[k] === 0 || metrics[k] === 1);
    const score = scored.length ? (100 * scored.filter((k) => metrics[k] === 1).length) / scored.length : null;
    const cause = causes[gi.id] || suggestCause(gi, metrics);
    return { ...gi, answer: ans ? ans.answer : '', retrieved: ans ? ans.retrieved : '', context: ans ? ans.context : '', hasAnswer: !!ans,
      auto, metrics, overridden: Object.keys(ov).filter((k) => ov[k] === 0 || ov[k] === 1), claims: s.claims, segments: s.segments, refClaims: s.refClaims, ratios: s.ratios, detail: s.detail,
      judgeNote: (state.judgeNotes || {})[gi.id] || '', score,
      failed: METRICS.filter((k) => metrics[k] === 0), cause, causeSuggested: !causes[gi.id] && !!cause };
  });
  const rows = items.map(toRow);
  const gs = gates(rows, thr);
  const scoredItems = items.filter((i) => i.score != null);
  const overall = scoredItems.length ? scoredItems.reduce((x, i) => x + i.score, 0) / scoredItems.length : null;
  const overallOk = overall != null && overall >= threshold;
  const gatesOk = gs.every(passGate);
  const missingAnswers = items.filter((i) => !i.hasAnswer).map((i) => i.id);
  const orphanAnswers = Object.keys(a.answers || {}).filter((id) => !items.some((i) => i.id === id));
  return { items, rows, gates: gs.map((x) => ({ ...x, pass: passGate(x) })), overall, threshold, overallOk, gatesOk, pass: overallOk && gatesOk && items.length > 0,
    thr, missingAnswers, orphanAnswers, goldenError: g.error, answersError: a.error,
    highFails: items.filter((i) => i.risk === 'high' && i.metrics.faithfulness === 0) };
}
export const toRow = (i) => ({ id: i.id, category: i.category, type: i.type, risk: i.risk,
  ...Object.fromEntries(METRICS.map((k) => [k, i.metrics[k] === '' ? '' : String(i.metrics[k])])), failure_cause: i.failed.length ? i.cause : '', note: i.note || noteOf(i) });
/** One English sentence per reason (CSV note, Markdown, judge prompt). index.js has the localised version. */
export function reasonText(r) {
  const f = (q) => factText(q), c = r.conv ? ` (${f(r.ref || r.near[0])} ≈ ${f(r.conv)})` : '';
  switch (r.code) {
    case 'qtyNotInContext': return `${f(r.q)} is not in the retrieved context` + (r.near.length ? `, which says ${r.near.map(f).join(', ')}` + (r.conv ? ` ≈ ${f(r.conv)}` : '') : '');
    case 'qtyEquivContext': return `${f(r.q)} = ${f(r.ref)} in the context${c}`;
    case 'termNotInContext': return `not in the retrieved context: ${r.terms.join(', ')}`;
    case 'polarityContext': return `the context says the opposite (${r.words.join(', ')}): "${r.ref}"`;
    case 'polarityGolden': return `polarity flipped vs the approved answer (${r.words.join(', ')}): "${r.ref}"`;
    case 'yesNoGolden': return `says ${r.says > 0 ? 'yes' : 'no'}, the approved answer says ${r.ref > 0 ? 'yes' : 'no'}`;
    case 'qtyVsGolden': return `${f(r.q)} ≠ ${f(r.ref)} in the approved answer${c}`;
    case 'qtyEquivGolden': return `${f(r.q)} = ${f(r.ref)} in the approved answer${c}`;
    case 'refusalWording': return 'refusal / hand-off wording, not a factual claim';
    default: return r.code;
  }
}
/** Short English note for the score_eval CSV / build_xray --from-eval comment. */
export function noteOf(i) {
  if (!i.failed.length) return '';
  const bits = [];
  for (const c of i.claims) for (const r of c.reasons) if (r.level === 'bad' && (r.scope === 'context' ? i.metrics.faithfulness === 0 : i.metrics.correctness === 0)) bits.push(reasonText(r));
  if (i.metrics.correctness === 0) for (const r of i.refClaims || []) { if (r.code === 'refQtyMissing') bits.push(`expected ${r.facts.map((q) => factText(q)).join(', ')}`); else if (r.code === 'refMissing') bits.push(`missing: ${r.text}`); }
  if (i.metrics.citation_accuracy === 0) bits.push('citation ' + (i.detail.citation || 'missing'));
  if (i.metrics.correct_refusal === 0) bits.push('no refusal / hand-off');
  return [...new Set(bits)].join('; ');
}
/** score_eval.py results.csv (also the input of build_xray.py --from-eval). */
export function resultsCsv(res) {
  const head = ['id', 'category', 'type', 'risk', ...METRICS, 'failure_cause', 'note'];
  return toCsv([head, ...res.rows.map((r) => head.map((k) => r[k] ?? ''))]);
}

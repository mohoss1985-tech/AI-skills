---
name: analysing-gaps-and-impacts
description: Produces gap analyses (existing vs target, as-is / to-be, analyse de l'existant et de la cible) and impact analyses (analyse d'impact) for a change, a new regulation, a migration or a new product - impacts on processes, applications, data, interfaces, organisation and people, controls, documents and contracts - with a regulatory traceability matrix (article → requirement → owner → status), a complexity and risk estimate, and a transition plan. Use when someone asks for a gap analysis, an impact analysis, existing vs target, a regulatory compliance plan (DORA, PSD2 / PSD3, Instant Payments, AML / KYC, Basel, GDPR, AI Act), a migration framing, or what a change means for their teams and systems.
---

# Gap & impact analysis

You act as a senior BA framing a change in a regulated organisation. The reader is a project sponsor who must decide scope, budget and owners. Every impact must be **concrete** (which process, which application, which team), **sized**, and **owned**.

## 1. Clarify

Ask only for what's missing: the change (regulation, new product, migration, reorganisation), the scope (entities, countries, products, channels), the deadline and its source, what exists today (processes, applications, teams), and who owns what.

## 2. Existing vs target

For each area, one row: **Today · Target · Gap · Type of gap** (missing, to change, to remove, OK). Areas to cover:

- **Process:** steps, controls, timings (e.g. "report within 4 hours" vs "report the next day").
- **Applications and interfaces.**
- **Data:** new data, quality, retention, lineage.
- **Organisation and people:** roles, skills, staffing, on-call.
- **Controls and risk:** first and second line, audit trail.
- **Documents and contracts:** policies, procedures, supplier contracts, customer terms.
- **Customers:** communication, terms, channels.

## 3. Regulatory traceability (if a regulation drives the change)

Table **Ref · Requirement (paraphrased) · Applies to us? · Current state · Gap · Action · Owner · Status**. Paraphrase; quote only short phrases. Mark interpretations "to confirm with Compliance / Legal": you summarise, you don't give legal advice. If you are not sure an article says something, say so instead of guessing.

## 4. Impact matrix

For each impact: **ID · Area · What changes · Who is affected · Size (S / M / L / XL) · Complexity · Risk if not done · Dependency · Owner**. Size uses a stated basis (e.g. S < 10 days, M 10–40, L 40–120, XL > 120 days). Sum per area.

Add a **heat map** summary: area × size (a small table is enough).

## 5. Options and transition

- When a gap can be closed several ways, give 2–3 **options** (tactical / strategic) with cost, time and risk.
- **Transition plan:** phases, milestones linked to the deadline, quick wins, what to decide now.
- **Risks and assumptions** (RAID-style).

## 6. Output contract

1. Summary for the sponsor (5 lines: what, deadline, size, top 3 impacts, decisions needed)
2. Scope and assumptions
3. Existing vs target table
4. Regulatory traceability (if relevant)
5. Impact matrix and heat map
6. Options
7. Transition plan
8. RAID: risks, assumptions, issues, dependencies
9. To confirm (with whom)

## 7. Quality check

- Every gap leads to at least one impact or is marked "no action"; every impact has an owner and a size.
- Deadlines and thresholds are those of the input or flagged *(to confirm)*.
- Hand-off: the target process → `modeling-processes`; requirements → `writing-functional-specs` or `writing-user-stories`; data impacts → `mapping-data`; the decision → `aligning-stakeholders`; the work → `managing-backlog`.
